import io
import logging
import shutil
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel, constr

from src.compiler.engine import SpriteCompiler
from src.config import PROJECT_ROOT
from src.server.dependencies import asset_logger, get_user_assets
from src.server.image_processing import optimize_image, remove_green_screen

logger = logging.getLogger("papeterie")
router = APIRouter(tags=["sprites"])

# --- Models ---


class SpriteInfo(BaseModel):
    name: str
    has_image: bool
    has_metadata: bool
    has_original: bool = False
    metadata: Optional[dict] = None
    prompt_text: Optional[str] = None


class ProcessRequest(BaseModel):
    remove_background: bool = False
    optimize: bool = False


class CompileRequest(BaseModel):
    name: constr(max_length=100)
    prompt: constr(max_length=2000)


# --- Endpoints ---


@router.get("/sprites", response_model=List[SpriteInfo])
async def list_sprites(user_assets=Depends(get_user_assets)):
    _, sprites_dir = user_assets
    sprites = []
    logger.info(f"Scanning sprites in {sprites_dir}")
    if sprites_dir.exists():
        for item in sprites_dir.iterdir():
            if item.is_dir():
                name = item.name
                image_path = item / f"{name}.png"
                metadata_path = item / f"{name}.prompt.json"
                prompt_text_path = item / f"{name}.prompt.txt"
                original_path = item / f"{name}.original.png"

                if not image_path.exists():
                    logger.warning(f"Sprite '{name}' missing image at {image_path}")

                metadata = None
                if metadata_path.exists():
                    try:
                        import json

                        with open(metadata_path, "r") as f:
                            metadata = json.load(f)
                    except Exception as e:
                        logger.error(f"Failed to load metadata for {name}: {e}")

                prompt_text = None
                if prompt_text_path.exists():
                    try:
                        prompt_text = prompt_text_path.read_text(encoding="utf-8")
                    except Exception as e:
                        logger.error(f"Failed to load prompt text for {name}: {e}")

                sprites.append(
                    SpriteInfo(
                        name=name,
                        has_image=image_path.exists(),
                        has_metadata=metadata_path.exists(),
                        has_original=original_path.exists(),
                        metadata=metadata,
                        prompt_text=prompt_text,
                    )
                )

    logger.info(f"Found {len(sprites)} sprites")
    return sprites


@router.post("/upload")
async def upload_sprite(
    name: str = Form(...),
    file: UploadFile = File(...),
    remove_background: bool = Form(False),
    optimize: bool = Form(False),
    user_assets=Depends(get_user_assets),
):
    _, sprites_dir = user_assets
    safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid sprite name")

    sprite_dir = sprites_dir / safe_name
    sprite_dir.mkdir(parents=True, exist_ok=True)

    image_path = sprite_dir / f"{safe_name}.png"
    processing_method = "upload_raw"  # Default

    try:
        contents = await file.read()

        if remove_background or optimize:
            original_path = sprite_dir / f"{safe_name}.original.png"
            with open(original_path, "wb") as f:
                f.write(contents)
            logger.info(f"Saved original for {safe_name} to {original_path}")
            processing_method = "upload_processed"

        image = Image.open(io.BytesIO(contents))

        if remove_background:
            logger.info(f"Removing background for sprite {safe_name}")
            image = remove_green_screen(image)

        if optimize:
            logger.info(f"Optimizing image for sprite {safe_name}")
            image = optimize_image(image)

        if image.mode != "RGBA":
            image = image.convert("RGBA")

        image.save(image_path, "PNG")

        asset_logger.log_action(
            "sprites",
            safe_name,
            "UPLOAD",
            "Sprite uploaded and processed",
            f"Method: {processing_method}",
        )

    except Exception as e:
        logger.error(f"Failed to process upload for {safe_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Image processing failed. Check server logs.")

    return {"name": safe_name, "message": "Sprite image uploaded and processed successfully"}


@router.post("/sprites/{name}/process")
def process_sprite(name: str, request: ProcessRequest, user_assets=Depends(get_user_assets)):
    _, sprites_dir = user_assets
    sprite_dir = sprites_dir / name
    image_path = sprite_dir / f"{name}.png"
    original_path = sprite_dir / f"{name}.original.png"

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Sprite image not found")

    error_msg = None
    processing_method = "manual"

    try:
        if not original_path.exists():
            logger.info(f"Creating original for {name} from current image")
            shutil.copy(image_path, original_path)

        image = Image.open(original_path)

        if request.optimize:
            from src.compiler.gemini_client import GeminiCompilerClient

            gemini = GeminiCompilerClient()
            try:
                # prompt_text = "Optimize this sprite."
                system_prompt = None
                prompt_path = PROJECT_ROOT / "assets" / "prompts" / "SpriteOptimization.prompt"
                if prompt_path.exists():
                    system_prompt = prompt_path.read_text(encoding="utf-8")

                try:
                    img_data = gemini.edit_image(
                        input_image_path=str(original_path),
                        prompt=(
                            "Optimize this sprite for a paper theatre game. "
                            "Clean up lines and make it pop."
                        ),
                        system_instruction=system_prompt,
                    )

                    image = Image.open(io.BytesIO(img_data))
                    logger.info("AI Generation successful, proceeding to remove green screen")
                    processing_method = "ai_gemini"

                    image = remove_green_screen(image)

                except Exception as e:
                    import traceback

                    tb = traceback.format_exc()
                    logger.error(
                        f"AI Optimization failed: {e}\n{tb}. "
                        "Falling back to manual green screen removal."
                    )

                    image = Image.open(original_path)
                    image = remove_green_screen(image)
                    processing_method = "fallback_manual"
                    error_msg = f"{str(e)}\nTraceback: {tb}"

            except Exception as e:
                logger.error(f"Optimization flow error: {e}")
                image = Image.open(original_path)
                image = remove_green_screen(image)
                processing_method = "fallback_error"
                error_msg = str(e)

        else:
            if request.remove_background:
                image = remove_green_screen(image)

        if image.mode != "RGBA":
            image = image.convert("RGBA")

        image.save(image_path, "PNG")

        asset_logger.log_action(
            "sprites",
            name,
            "PROCESS",
            "Sprite processed",
            f"Method: {processing_method}\nError: {error_msg}",
        )
        return {
            "name": name,
            "message": "Sprite processed successfully",
            "method": processing_method,
            "error_details": error_msg,
        }
    except Exception as e:
        logger.error(f"Processing failed for {name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Processing failed. Check server logs.")


@router.post("/sprites/{name}/revert")
async def revert_sprite(name: str, user_assets=Depends(get_user_assets)):
    _, sprites_dir = user_assets
    sprite_dir = sprites_dir / name
    image_path = sprite_dir / f"{name}.png"
    original_path = sprite_dir / f"{name}.original.png"

    if not original_path.exists():
        raise HTTPException(status_code=404, detail="Original image not found")

    try:
        shutil.copy(original_path, image_path)
        return {"name": name, "message": "Sprite reverted to original"}
    except Exception as e:
        logger.error(f"Revert failed for {name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Revert failed. Check server logs.")


@router.put("/sprites/{name}/config")
async def update_sprite_config(name: str, config: dict, user_assets=Depends(get_user_assets)):
    from src.compiler.models import SpriteMetadata

    _, sprites_dir = user_assets
    sprite_dir = sprites_dir / name
    if not sprite_dir.exists():
        raise HTTPException(status_code=404, detail="Sprite not found")

    metadata_path = sprite_dir / f"{name}.prompt.json"

    try:
        # Validate with Pydantic
        metadata = SpriteMetadata(**config)

        with open(metadata_path, "w") as f:
            f.write(metadata.model_dump_json(indent=2))

        asset_logger.log_action("sprites", name, "UPDATE_CONFIG", "Sprite metadata updated", "")
        return {"name": name, "message": "Metadata updated successfully", "metadata": config}
    except Exception as e:
        logger.error(f"Failed to update metadata for {name}: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid metadata: {str(e)}")


@router.post("/compile")
def compile_sprite(request: CompileRequest, user_assets=Depends(get_user_assets)):
    try:
        _, sprites_dir = user_assets
        compiler = SpriteCompiler(sprite_dir=sprites_dir)  # Scoped to user
        # TODO: Update compiler to support user-scoped directories!

        sprite_dir = sprites_dir / request.name
        sprite_dir.mkdir(parents=True, exist_ok=True)
        (sprite_dir / f"{request.name}.prompt.txt").write_text(request.prompt, encoding="utf-8")

        metadata = compiler.compile_sprite(request.name, request.prompt)
        compiler.save_metadata(metadata)

        return metadata
    except Exception as e:
        logger.error(f"Compilation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Compilation failed. Check server logs.")


@router.delete("/sprites/{name}")
def delete_sprite(name: str, mode: str = "delete", user_assets=Depends(get_user_assets)):
    """
    Delete a sprite.
    - delete: Completely remove.
    - reset: Remove generated files, keep original.
    """
    logger.info(f"Deleting sprite {name} with mode {mode}")
    _, sprites_dir = user_assets
    sprite_dir = sprites_dir / name

    if not sprite_dir.exists():
        raise HTTPException(status_code=404, detail="Sprite not found")

    try:
        if mode == "delete":
            shutil.rmtree(sprite_dir)
        elif mode == "reset":
            import os

            for item in sprite_dir.iterdir():
                if not item.name.endswith(".original.png"):
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        os.remove(item)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

        asset_logger.log_action("sprites", name, "DELETE", f"Sprite processed (mode={mode})", "")
        return {"name": name, "message": f"Sprite processed (mode={mode})"}

    except Exception as e:
        logger.error(f"Delete failed for {name}: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")
