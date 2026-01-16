import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from PIL import Image

from src.server.dependencies import (
    asset_logger,
    get_current_user,
    get_user_assets,
)

from .models import RotateRequest

logger = logging.getLogger("papeterie")
router = APIRouter()


@router.put("/{name}/config")
async def update_scene_config(
    name: str,
    config: dict,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    from src.compiler.models import SceneConfig

    scenes_dir, _ = user_assets
    scene_dir = scenes_dir / name
    if not scene_dir.exists():
        raise HTTPException(status_code=404, detail="Scene not found")

    config_path = scene_dir / "scene.json"

    try:
        # Load existing for diffing
        old_config = None
        if config_path.exists():
            try:
                with open(config_path, "r") as f:
                    old_config = json.load(f)
            except Exception:
                pass

        # Validate with Pydantic
        scene_config = SceneConfig(**config)

        with open(config_path, "w") as f:
            f.write(scene_config.model_dump_json(indent=2))

        # Generate descriptive log
        log_msg = "Scene config updated"
        if old_config:
            old_layers = {layer.get("sprite_name") for layer in old_config.get("layers", [])}
            new_layers = {layer.get("sprite_name") for layer in config.get("layers", [])}

            added = new_layers - old_layers
            removed = old_layers - new_layers

            if added:
                log_msg = f"Added sprites: {', '.join(added)}"
            elif removed:
                log_msg = f"Removed sprites: {', '.join(removed)}"
            else:
                log_msg = "Modified layer behaviors or properties"

        asset_logger.log_action("scenes", name, "UPDATE_CONFIG", log_msg, "", user_id=user_id)
        return {
            "name": name,
            "message": "Config updated successfully",
            "config": config,
        }

    except Exception as e:
        logger.error(f"Failed to update config for {name}: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid config: {str(e)}")


@router.post("/{name}/rotate")
async def rotate_scene(
    name: str,
    request: RotateRequest,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    scenes_dir, _ = user_assets
    scene_dir = scenes_dir / name

    if not scene_dir.exists():
        logger.warning(f"Rotate Request: Scene dir {scene_dir} not found. Returning 404.")
        raise HTTPException(
            status_code=404,
            detail=f"Scene '{name}' not found.",
        )

    logger.info(f"Rotate Request: Processing scene '{name}' in {scene_dir}")

    rotated_count = 0
    files_to_rotate = []

    # 1. Try strict strict naming convention
    strict_candidates = [
        scene_dir / f"{name}.original.png",
        scene_dir / f"{name}.original.jpg",
    ]
    for p in strict_candidates:
        if p.exists():
            files_to_rotate.append(p)

    # 2. If no strict matches, strict scan for ANY original
    if not files_to_rotate:
        logger.info(f"No strict matches found for {name}. Scanning directory...")
        for item in scene_dir.iterdir():
            if item.name.endswith(".original.png") or item.name.endswith(".original.jpg"):
                files_to_rotate.append(item)

    if not files_to_rotate:
        logger.error(f"Rotate Request: No original files found in {scene_dir}")
        raise HTTPException(status_code=400, detail="No original image found to rotate.")

    for image_path in files_to_rotate:
        try:
            logger.info(f"Rotating: {image_path}")
            img = Image.open(image_path)
            # Use -angle for CW rotation (visual expectation)
            rotated_img = img.rotate(-request.angle, expand=True)
            rotated_img.save(image_path)
            rotated_count += 1
            logger.info(f"Successfully rotated {image_path.name}")
        except Exception as e:
            logger.error(f"Failed to rotate {image_path.name}: {e}")

    if rotated_count == 0:
        raise HTTPException(
            status_code=500, detail="Failed to rotate image files due to server error."
        )

    asset_logger.log_action(
        "scenes", name, "rotate", f"Scene rotated by {request.angle} degrees", user_id=user_id
    )
    return {"status": "success", "message": f"Scene rotated by {request.angle} degrees"}
