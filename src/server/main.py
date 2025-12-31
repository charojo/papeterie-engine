from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from pathlib import Path
import logging

# Import compiler engine
from src.compiler.engine import SpriteCompiler
from src.compiler.models import SpriteMetadata

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("papeterie.server")

app = FastAPI(title="Papeterie Engine Editor")

# Configurable origins
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
PROJECT_ROOT = Path(__file__).parent.parent.parent
SPRITES_DIR = PROJECT_ROOT / "assets" / "sprites"
ORIGINALS_DIR = PROJECT_ROOT / "assets" / "originals"
ASSETS_DIR = PROJECT_ROOT / "assets"

SPRITES_DIR.mkdir(parents=True, exist_ok=True)
ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)

# Mount static files
from fastapi.staticfiles import StaticFiles
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

class SpriteInfo(BaseModel):
    name: str
    has_image: bool
    has_metadata: bool
    has_original: bool = False
    metadata: Optional[dict] = None
    prompt_text: Optional[str] = None

class CompileRequest(BaseModel):
    name: str
    prompt: str

class ProcessRequest(BaseModel):
    remove_background: bool = False
    optimize: bool = False

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/api/sprites", response_model=List[SpriteInfo])
async def list_sprites():
    sprites = []
    # Iterate over subdirectories in assets/sprites
    logger.info(f"Scanning sprites in {SPRITES_DIR}")
    for item in SPRITES_DIR.iterdir():
        if item.is_dir():
            name = item.name
            image_path = item / f"{name}.png"
            metadata_path = item / f"{name}.prompt.json"
            prompt_text_path = item / f"{name}.prompt.txt"
            original_path = item / f"{name}.original.png"
            
            # Debug logging for image detection
            if not image_path.exists():
                logger.warning(f"Sprite '{name}' missing image at {image_path}")
            
            metadata = None
            if metadata_path.exists():
                try:
                    import json
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to load metadata for {name}: {e}")
            
            prompt_text = None
            if prompt_text_path.exists():
                try:
                    prompt_text = prompt_text_path.read_text(encoding='utf-8')
                except Exception as e:
                    logger.error(f"Failed to load prompt text for {name}: {e}")

            sprites.append(SpriteInfo(
                name=name,
                has_image=image_path.exists(),
                has_metadata=metadata_path.exists(),
                has_original=original_path.exists(),
                metadata=metadata,
                prompt_text=prompt_text
            ))
    
    logger.info(f"Found {len(sprites)} sprites")
    return sprites

# ... (upload_sprite remains unchanged)

@app.post("/api/upload")
async def upload_sprite(
    name: str = Form(...), 
    file: UploadFile = File(...),
    remove_background: bool = Form(False),
    optimize: bool = Form(False)
):
    # Sanitize name
    safe_name = "".join(c for c in name if c.isalnum() or c in ('_', '-')).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid sprite name")
    
    # Save to assets/sprites/<name>/<name>.png
    sprite_dir = SPRITES_DIR / safe_name
    sprite_dir.mkdir(parents=True, exist_ok=True)
    
    image_path = sprite_dir / f"{safe_name}.png"
    
    try:
        # Load image into PIL
        from PIL import Image
        import io
        from src.server.image_processing import remove_green_screen, optimize_image

        contents = await file.read()
        
        # If processing is requested, save the original first
        if remove_background or optimize:
            original_path = ORIGINALS_DIR / f"{safe_name}.png"
            with open(original_path, "wb") as f:
                f.write(contents)
            logger.info(f"Saved original for {safe_name} to {original_path}")
        
        image = Image.open(io.BytesIO(contents))
        
        # Process if requested
        if remove_background:
            logger.info(f"Removing background for sprite {safe_name}")
            image = remove_green_screen(image)
            
        if optimize:
            logger.info(f"Optimizing image for sprite {safe_name}")
            image = optimize_image(image)
            
        # Save processed image
        # Ensure RGBA for consistency (especially for transparent images)
        if image.mode != "RGBA":
            image = image.convert("RGBA")
            
        image.save(image_path, "PNG")
        
    except Exception as e:
        logger.error(f"Failed to process upload for {safe_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")
        
    return {"name": safe_name, "message": "Sprite image uploaded and processed successfully"}

@app.post("/api/sprites/{name}/process")
async def process_sprite(name: str, request: ProcessRequest):
    sprite_dir = SPRITES_DIR / name
    image_path = sprite_dir / f"{name}.png"
    original_path = sprite_dir / f"{name}.original.png"
    
    if not image_path.exists():
         raise HTTPException(status_code=404, detail="Sprite image not found")

    error_msg = None
    processing_method = "manual"

    try:
        # Ensure original exists
        if not original_path.exists():
            logger.info(f"Creating original for {name} from current image")
            shutil.copy(image_path, original_path)
            
        # Load from original
        from PIL import Image
        import io # Added import for io
        from src.server.image_processing import remove_green_screen, optimize_image
        
        image = Image.open(original_path)
        
        if request.optimize:
            # We want to optimize!
            from src.compiler.gemini_client import GeminiCompilerClient # Moved import here
            gemini = GeminiCompilerClient() # Initialize gemini client here
            try:
                # Load System Prompt
                prompt_text = "Optimize this sprite."
                system_prompt = None
                prompt_path = PROJECT_ROOT / "assets" / "prompts" / "SpriteOptimization.prompt"
                if prompt_path.exists():
                    system_prompt = prompt_path.read_text(encoding='utf-8')
                
                # Call Gemini
                # User Prompt: "Optimize this sprite"
                try:
                    img_data = gemini.edit_image(
                        input_image_path=str(original_path), 
                        prompt="Optimize this sprite for a paper theatre game. Clean up lines and make it pop.", 
                        system_instruction=system_prompt
                    )
                    
                    # Load returned image
                    image = Image.open(io.BytesIO(img_data))
                    logger.info("AI Generation successful, proceeding to remove green screen")
                    processing_method = "ai_gemini"
                    
                    # Automatically remove green screen from the AI output
                    image = remove_green_screen(image)
                    
                except Exception as e:
                    import traceback
                    tb = traceback.format_exc()
                    logger.error(f"AI Optimization failed: {e}\n{tb}. Falling back to manual green screen removal.")
                    
                    # Fallback: Assume the user provided a green screen image and just key it out manually
                    image = Image.open(original_path)
                    image = remove_green_screen(image)
                    processing_method = "fallback_manual"
                    error_msg = f"{str(e)}\nTraceback: {tb}"

            except Exception as e:
                 # Outer try block just in case system prompt read fails or something
                 logger.error(f"Optimization flow error: {e}")
                 image = Image.open(original_path)
                 image = remove_green_screen(image)
                 processing_method = "fallback_error"
                 error_msg = str(e)

        else:
            # Manual processing logic (request.remove_background only)
            if request.remove_background:
                image = remove_green_screen(image)
        
        # Ensure RGBA
        if image.mode != "RGBA":
             image = image.convert("RGBA")
             
        image.save(image_path, "PNG")
        
        return {
            "name": name, 
            "message": "Sprite processed successfully",
            "method": processing_method,
            "error_details": error_msg
        }
    except Exception as e:
        logger.error(f"Processing failed for {name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system-prompt")
async def get_system_prompt():
    prompt_path = PROJECT_ROOT / "assets" / "prompts" / "SpriteOptimization.prompt"
    if prompt_path.exists():
        return {"content": prompt_path.read_text(encoding='utf-8')}
    return {"content": "Optimize this sprite."}

@app.post("/api/sprites/{name}/revert")
async def revert_sprite(name: str):
    sprite_dir = SPRITES_DIR / name
    image_path = sprite_dir / f"{name}.png"
    original_path = sprite_dir / f"{name}.original.png"
    
    if not original_path.exists():
        raise HTTPException(status_code=404, detail="Original image not found")
        
    try:
        shutil.copy(original_path, image_path)
        return {"name": name, "message": "Sprite reverted to original"}
    except Exception as e:
         logger.error(f"Revert failed for {name}: {e}")
         raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compile")
def compile_sprite(request: CompileRequest):
    """
    Synchronous endpoint to run the compiler.
    FastAPI runs this in a threadpool.
    """
    try:
        compiler = SpriteCompiler(
            sprite_dir=str(SPRITES_DIR),
            prompt_dir=str(PROJECT_ROOT / "assets" / "prompts")
        )
        
        # Save the raw prompt text for future reference
        sprite_dir = SPRITES_DIR / request.name
        sprite_dir.mkdir(parents=True, exist_ok=True)
        (sprite_dir / f"{request.name}.prompt.txt").write_text(request.prompt, encoding='utf-8')
        
        # This will query Gemini and auto-save metadata
        metadata = compiler.compile_sprite(request.name, request.prompt)
        
        # Ensure it saves to disk
        compiler.save_metadata(metadata)
        
        return metadata
    except Exception as e:
        logger.error(f"Compilation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.server.main:app", host="0.0.0.0", port=8000, reload=True)
