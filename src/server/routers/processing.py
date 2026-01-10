import base64
import io
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

from src.compiler.gemini_client import GeminiCompilerClient

# Import existing core logic
# We might need to refactor SpriteCompiler if it's too tied to filesystem,
# but for now we'll assume we can use parts of it or duplicate the stateless logic.
# Actually, SpriteCompiler is heavily file-based.
# We should rely on 'local_processor' for image work and 'gemini_client' for metadata.
from src.server.local_processor import LocalImageProcessor

router = APIRouter(prefix="/processing", tags=["processing"])
logger = logging.getLogger("papeterie.processing")


@router.post("/sprite")
async def process_sprite_stateless(
    file: UploadFile = File(...),
    prompt: str = Form(None),
    mode: str = Form("local"),  # 'local' or 'ai' (for future)
):
    """
    Stateless sprite processing.
    Accepts an image, removes background, (optionally) generates metadata.
    Returns the processed image (base64) and metadata (json).
    Does NOT save to server disk.
    """
    try:
        logger.info(f"Processing sprite stateless: {file.filename} (mode={mode})")

        # 1. Read Image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # 2. Remove Background (Local)
        # We always use local processor for background removal to save costs/time
        # unless we specifically want Gemini to do it (which is slower/costlier).
        processor = LocalImageProcessor()

        # extract_sprite returns (bytes, mask) - but it composites to green screen for some reason?
        # improving existing logic: extract_sprite in local_processor composites to green.
        # We probably want the TRANSPARENT png for the web.
        # Let's check LocalImageProcessor methods.
        # remove_background returns (PIL Image, mask)

        subject, mask = processor.remove_background(image, crop=True)

        # Convert subject (RGBA) to base64 for response
        buffered = io.BytesIO()
        subject.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")

        # 3. Generate Metadata
        # If no prompt provided, use filename as basic description
        description = prompt or f"A sprite named {file.filename}"

        # We use GeminiClient directly to avoid file I/O of SpriteCompiler
        client = GeminiCompilerClient()

        # We'll use a simplified flow: Direct metadata generation
        # We need the system prompt. Ideally, we shouldn't duplicate this string.
        # But SpriteCompiler._get_prompt_template reads from file.
        # We can instantiate a helper to get prompts.

        from src.compiler.engine import SpriteCompiler

        # Instantiate just to access helper methods?
        # SpriteCompiler __init__ creates directories, which is benign.
        compiler = SpriteCompiler()
        meta_prompt = compiler._get_prompt_template("MetaPrompt")

        raw_metadata = client.generate_metadata(meta_prompt, description)

        # Simple validation
        # (we can use compiler's logic if we refactor, but for now duplicate simple implementation)
        # Actually compiler._validate_and_fix is useful.
        # Let's reuse it if possible.
        # The 'name' in metadata might need to be set.
        name = file.filename.rsplit(".", 1)[0]
        metadata = compiler._validate_and_fix(name, raw_metadata)

        return {
            "name": name,
            "image_base64": f"data:image/png;base64,{img_str}",
            "metadata": metadata.model_dump(),
        }

    except Exception as e:
        logger.error(f"Stateless processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
