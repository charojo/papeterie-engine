import logging
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel, constr

from src.compiler.engine import SpriteCompiler
from src.config import PROJECT_ROOT
from src.server import image_processing as img_proc
from src.server.dependencies import (
    asset_logger,
    get_community_assets,
    get_current_user,
    get_user_assets,
)

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
    image_url: Optional[str] = None
    original_url: Optional[str] = None
    is_community: bool = False
    creator: Optional[str] = None


class ProcessRequest(BaseModel):
    remove_background: bool = False
    optimize: bool = False


class CompileRequest(BaseModel):
    name: constr(max_length=100)
    prompt: constr(max_length=2000)


# --- Endpoints ---


@router.get("/sprites", response_model=List[SpriteInfo])
async def list_sprites(
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
    community_assets=Depends(get_community_assets),
):
    _, sprites_dir = user_assets
    _, community_sprites = community_assets

    sprites = []

    def scan_dir(directory: Path, is_comm: bool = False, owner_id: str = "default"):
        logger.info(f"Scanning sprites in {directory} (community={is_comm})")
        found = []
        if not directory.exists():
            return found

        for item in directory.iterdir():
            if item.is_dir():
                name = item.name
                image_path = item / f"{name}.png"
                metadata_path = item / f"{name}.prompt.json"
                prompt_text_path = item / f"{name}.prompt.txt"
                original_path = item / f"{name}.original.png"

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

                base_uid = "community" if is_comm else owner_id
                image_url = None
                if image_path.exists():
                    image_url = f"/assets/users/{base_uid}/sprites/{name}/{name}.png"

                original_url = None
                if original_path.exists():
                    original_url = f"/assets/users/{base_uid}/sprites/{name}/{name}.original.png"

                found.append(
                    SpriteInfo(
                        name=name,
                        has_image=image_path.exists(),
                        has_metadata=metadata_path.exists(),
                        has_original=original_path.exists(),
                        metadata=metadata,
                        prompt_text=prompt_text,
                        image_url=image_url,
                        original_url=original_url,
                        is_community=is_comm,
                        creator=None if is_comm else owner_id,
                    )
                )
        return found

    # User sprites first
    sprites.extend(scan_dir(sprites_dir, is_comm=False, owner_id=user_id))

    # Community sprites
    community_list = scan_dir(community_sprites, is_comm=True)
    # Avoid duplicates if user has a sprite with the same name (user version takes precedence)
    user_sprite_names = {s.name for s in sprites}
    for s in community_list:
        if s.name not in user_sprite_names:
            sprites.append(s)

    logger.info(f"Found {len(sprites)} sprites")
    return sprites


@router.post("/sprites/{name}/share")
async def share_sprite(
    name: str,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
    community_assets=Depends(get_community_assets),
):
    _, sprites_dir = user_assets
    _, community_sprites = community_assets

    src_dir = sprites_dir / name
    if not src_dir.exists():
        raise HTTPException(status_code=404, detail="Sprite not found in your library")

    dest_dir = community_sprites / name
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Copy files
    for item in src_dir.iterdir():
        if item.is_file():
            shutil.copy2(item, dest_dir / item.name)

    asset_logger.log_action(
        "sprites", name, "share", f"Sprite shared to community by {user_id}", user_id=user_id
    )

    return {"status": "success", "message": f"Sprite '{name}' shared to community"}


@router.post("/sprites/upload")
async def upload_sprite(
    name: str = Form(...),
    file: UploadFile = File(...),
    remove_background: bool = Form(False),
    optimize: bool = Form(False),
    user_id: str = Depends(get_current_user),
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

        image = img_proc.image_from_bytes(contents)
        if remove_background:
            asset_logger.log_info("sprites", safe_name, "Removing background...", user_id=user_id)
            logger.info(f"Removing background for sprite {safe_name}")
            image = img_proc.remove_green_screen(image)
        if optimize:
            asset_logger.log_info("sprites", safe_name, "Optimizing image...", user_id=user_id)
            logger.info(f"Optimizing image for sprite {safe_name}")
            image = img_proc.optimize_image(image)

        if image.mode != "RGBA":
            image = image.convert("RGBA")

        image.save(image_path, "PNG")
        asset_logger.log_info("sprites", safe_name, "Processing complete.", user_id=user_id)

        asset_logger.log_action(
            "sprites",
            safe_name,
            "UPLOAD",
            "Sprite uploaded and processed",
            f"Method: {processing_method}",
            user_id=user_id,
        )

    except Exception as e:
        logger.error(f"Failed to process upload for {safe_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Image processing failed. Check server logs.")

    return {"name": safe_name, "message": "Sprite image uploaded and processed successfully"}


@router.post("/sprites/{name}/process")
def process_sprite(
    name: str,
    request: ProcessRequest,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
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

            asset_logger.clear_logs("sprites", name, user_id=user_id)
            gemini = GeminiCompilerClient()
            try:
                # prompt_text = "Optimize this sprite."
                system_prompt = None
                prompt_path = PROJECT_ROOT / "assets" / "prompts" / "SpriteOptimization.prompt"
                if prompt_path.exists():
                    system_prompt = prompt_path.read_text(encoding="utf-8")

                asset_logger.log_info(
                    "sprites",
                    name,
                    "Step 1: Contacting Gemini for optimization...",
                    user_id=user_id,
                )
                try:
                    img_data = gemini.edit_image(
                        input_image_path=str(original_path),
                        prompt=(
                            "Optimize this sprite for a paper theatre game. "
                            "Clean up lines and make it pop."
                        ),
                        system_instruction=system_prompt,
                    )

                    asset_logger.log_info(
                        "sprites",
                        name,
                        "Step 2: AI Generation successful, removing green screen...",
                        user_id=user_id,
                    )
                    image = img_proc.image_from_bytes(img_data)
                    logger.info("AI Generation successful, proceeding to remove green screen")
                    processing_method = "ai_gemini"

                    image = img_proc.remove_green_screen(image)

                except Exception as e:
                    import traceback

                    tb = traceback.format_exc()
                    asset_logger.log_info(
                        "sprites",
                        name,
                        "AI Optimization failed, falling back to manual removal.",
                        user_id=user_id,
                    )
                    logger.error(
                        f"AI Optimization failed: {e}\n{tb}. "
                        "Falling back to manual green screen removal."
                    )

                    image = Image.open(original_path)
                    image = img_proc.remove_green_screen(image)
                    processing_method = "fallback_manual"
                    error_msg = f"{str(e)}\nTraceback: {tb}"

            except Exception as e:
                logger.error(f"Optimization flow error: {e}")
                image = Image.open(original_path)
                image = img_proc.remove_green_screen(image)
                processing_method = "fallback_error"
                error_msg = str(e)

        else:
            if request.remove_background:
                image = img_proc.remove_green_screen(image)

        if image.mode != "RGBA":
            image = image.convert("RGBA")

        image.save(image_path, "PNG")

        asset_logger.log_action(
            "sprites",
            name,
            "PROCESS",
            "Sprite processed",
            f"Method: {processing_method}\nError: {error_msg}",
            user_id=user_id,
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
async def update_sprite_config(
    name: str,
    config: dict,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
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

        asset_logger.log_action(
            "sprites", name, "UPDATE_CONFIG", "Sprite metadata updated", "", user_id=user_id
        )
        return {"name": name, "message": "Metadata updated successfully", "metadata": config}
    except Exception as e:
        logger.error(f"Failed to update metadata for {name}: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid metadata: {str(e)}")


@router.post("/sprites/compile")
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
def delete_sprite(
    name: str,
    mode: str = "delete",
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
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

        asset_logger.log_action(
            "sprites", name, "DELETE", f"Sprite processed (mode={mode})", "", user_id=user_id
        )
        return {"name": name, "message": f"Sprite processed (mode={mode})"}

    except Exception as e:
        logger.error(f"Delete failed for {name}: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")


class RotateRequest(BaseModel):
    angle: int  # 90, 180, 270, -90, etc.


@router.post("/sprites/{name}/rotate")
async def rotate_sprite(
    name: str,
    request: RotateRequest,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    """
    Rotate the sprite image (and original if it exists) by the specified angle.
    Positive angle is clockwise (PIL rotate is counter-clockwise, so we negate).
    """
    _, sprites_dir = user_assets
    sprite_dir = sprites_dir / name
    image_path = sprite_dir / f"{name}.png"
    original_path = sprite_dir / f"{name}.original.png"

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Sprite image not found")

    try:
        # Rotate primary image
        img = Image.open(image_path)
        # PIL rotate is counter-clockwise. User expects clockwise for positive values usually?
        # Actually standard mathematical is CCW.
        # But UI usually has "Rotate Right" -> Clockwise (negative math angle).
        # Let's assume input is degrees CW or let's stick to standard.
        # ImageViewer UI: Rotate Right (+90 in state? No, ImageViewer implement shows +90).
        # CSS rotate(90deg) is Clockwise.
        # PIL rotate(90) is Counter-Clockwise.
        # So to match CSS rotate(90), we need PIL rotate(-90).
        rotated_img = img.rotate(-request.angle, expand=True)
        rotated_img.save(image_path)

        # Rotate original if exists
        if original_path.exists():
            orig_img = Image.open(original_path)
            rotated_orig = orig_img.rotate(-request.angle, expand=True)
            rotated_orig.save(original_path)

        asset_logger.log_action(
            "sprites",
            name,
            "ROTATE",
            f"Sprite rotated by {request.angle} degrees",
            "",
            user_id=user_id,
        )

        return {"name": name, "message": f"Sprite rotated by {request.angle} degrees"}

    except Exception as e:
        logger.error(f"Rotation failed for {name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Rotation failed: {e}")
