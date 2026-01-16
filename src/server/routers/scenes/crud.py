import json
import logging
import os
import shutil
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from src.compiler.gemini_client import GeminiCompilerClient
from src.config import ASSETS_DIR
from src.server.dependencies import (
    asset_logger,
    get_current_user,
    get_user_assets,
)

from .models import GenerateSceneRequest, SceneInfo

logger = logging.getLogger("papeterie")
router = APIRouter()


@router.get("", response_model=List[SceneInfo])
async def list_scenes(
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    scenes_dir, _ = user_assets

    scenes = []

    logger.info(f"Scanning scenes in {scenes_dir}")
    if not scenes_dir.exists():
        return scenes

    for item in scenes_dir.iterdir():
        if item.is_dir():
            name = item.name
            config_path = item / "scene.json"

            original_png = item / f"{name}.original.png"
            original_jpg = item / f"{name}.original.jpg"

            original_ext = None
            if original_png.exists():
                original_ext = "png"
            elif original_jpg.exists():
                original_ext = "jpg"

            has_original = original_ext is not None

            config = None
            used_sprites = []

            if config_path.exists():
                try:
                    with open(config_path, "r") as f:
                        config = json.load(f)

                    if config and "layers" in config:
                        for layer in config["layers"]:
                            if "sprite_name" in layer:
                                used_sprites.append(layer["sprite_name"])

                    used_sprites = list(set(used_sprites))

                except Exception as e:
                    logger.error(f"Failed to load scene config for {name}: {e}")

            original_url = None
            if has_original:
                original_url = (
                    f"/assets/users/{user_id}/scenes/{name}/{name}.original.{original_ext}"
                )

            scenes.append(
                SceneInfo(
                    name=name,
                    has_config=config_path.exists(),
                    has_original=has_original,
                    original_ext=original_ext,
                    config=config,
                    used_sprites=used_sprites,
                    original_url=original_url,
                    is_community=False,  # Community concept is dropped
                    creator=user_id,
                )
            )

    logger.info(f"Found {len(scenes)} scenes")
    return scenes


@router.post("/upload")
async def upload_scene(
    name: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    scenes_dir, _ = user_assets
    safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid scene name")

    scene_dir = scenes_dir / safe_name

    if scene_dir.exists():
        raise HTTPException(status_code=400, detail="Scene already exists")

    scene_dir.mkdir(parents=True, exist_ok=True)

    filename = file.filename
    ext = ".jpg"
    if filename and filename.lower().endswith(".png"):
        ext = ".png"

    original_path = scene_dir / f"{safe_name}.original{ext}"

    try:
        contents = await file.read()
        with open(original_path, "wb") as f:
            f.write(contents)

        logger.info(f"Saved original scene art for {safe_name} to {original_path}")

        config_path = scene_dir / "scene.json"

        default_config = {"name": safe_name, "layers": []}
        with open(config_path, "w") as f:
            json.dump(default_config, f, indent=2)

    except Exception as e:
        logger.error(f"Failed to create scene {safe_name}: {e}")
        if scene_dir.exists():
            shutil.rmtree(scene_dir)
        raise HTTPException(status_code=500, detail="Scene creation failed. Check server logs.")

    asset_logger.log_action(
        "scenes",
        safe_name,
        "CREATE",
        "Scene created",
        f"Filename: {filename}",
        user_id=user_id,
    )
    return {"name": safe_name, "message": "Scene created successfully"}


@router.post("/generate")
async def generate_scene(
    request: GenerateSceneRequest,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    scenes_dir, _ = user_assets
    safe_name = "".join(c for c in request.name if c.isalnum() or c in ("_", "-")).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid scene name")

    scene_dir = scenes_dir / safe_name

    if scene_dir.exists():
        raise HTTPException(status_code=400, detail="Scene already exists")

    scene_dir.mkdir(parents=True, exist_ok=True)
    original_path = scene_dir / f"{safe_name}.original.png"

    try:
        try:
            client = GeminiCompilerClient()
            image_bytes = client.generate_image(request.prompt)
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

        with open(original_path, "wb") as f:
            f.write(image_bytes)

        logger.info(f"Saved generated scene art for {safe_name} to {original_path}")

        config_path = scene_dir / "scene.json"
        default_config = {"name": safe_name, "layers": []}
        with open(config_path, "w") as f:
            json.dump(default_config, f, indent=2)

    except Exception as e:
        logger.error(f"Failed to create generated scene {safe_name}: {e}")
        if scene_dir.exists():
            shutil.rmtree(scene_dir)
        if original_path.exists():
            if os.path.exists(original_path):
                os.remove(original_path)

        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Scene generation failed. Check server logs.")

    asset_logger.log_action(
        "scenes",
        safe_name,
        "CREATE",
        "Scene generated w/ AI",
        f"Prompt: {request.prompt[:50]}...",
        user_id=user_id,
    )
    return {"name": safe_name, "message": "Scene generated successfully"}


@router.delete("/{name}")
def delete_scene(
    name: str,
    mode: str = "delete_scene",
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    """
    Delete a scene with various modes:
    - delete_scene: Deletes the scene folder only.
    - delete_all: Deletes scene folder AND sprites (if not shared).
    - reset: Deletes generated files, keeps original.
    """
    scenes_dir, sprites_dir = user_assets
    logger.info(f"Deleting scene {name} with mode {mode}")
    scene_dir = scenes_dir / name

    if not scene_dir.exists():
        raise HTTPException(status_code=404, detail="Scene not found")

    kept_sprites = []
    deleted_sprites = []

    try:
        if mode == "delete_all":
            # 1. Identify candidates
            candidates = []
            config_path = scene_dir / "scene.json"
            if config_path.exists():
                try:
                    with open(config_path, "r") as f:
                        config = json.load(f)
                    if config and "layers" in config:
                        for layer in config["layers"]:
                            if "sprite_name" in layer:
                                candidates.append(layer["sprite_name"])
                    candidates = list(set(candidates))
                except Exception:
                    logger.warning(f"Could not read config for {name} during delete identification")

            # 2. Check usage in OTHER scenes
            usage_map = set()
            for item in scenes_dir.iterdir():
                if item.is_dir() and item.name != name:
                    c_path = item / "scene.json"
                    if c_path.exists():
                        try:
                            with open(c_path, "r") as f:
                                c = json.load(f)
                            if c and "layers" in c:
                                for layer in c["layers"]:
                                    if "sprite_name" in layer:
                                        usage_map.add(layer["sprite_name"])
                        except Exception:
                            pass

            # 3. Delete safe sprites
            for s_name in candidates:
                if s_name in usage_map:
                    kept_sprites.append(s_name)
                    logger.info(f"Preserving sprite {s_name} (used in other scenes)")
                else:
                    s_dir = sprites_dir / s_name
                    if s_dir.exists():
                        shutil.rmtree(s_dir)
                        deleted_sprites.append(s_name)
                        logger.info(f"Deleted sprite {s_name}")

            # 4. Delete scene dir
            shutil.rmtree(scene_dir)

        elif mode == "delete_scene":
            shutil.rmtree(scene_dir)

        elif mode == "reset":
            # REUSE DEPENDENCY CHECK LOGIC from delete_all
            # 1. Identify candidates
            candidates = []
            config_path = scene_dir / "scene.json"
            if config_path.exists():
                try:
                    with open(config_path, "r") as f:
                        config = json.load(f)
                    if config and "layers" in config:
                        for layer in config["layers"]:
                            if "sprite_name" in layer:
                                candidates.append(layer["sprite_name"])
                    candidates = list(set(candidates))
                except Exception:
                    logger.warning(f"Could not read config for {name} during reset identification")
                logger.warning(
                    f"Scene config missing for {name} during reset. "
                    "Cannot identify unique sprites to delete."
                )

            # 2. Check usage in OTHER scenes
            usage_map = {}  # Map sprite_name -> list of scenes using it
            for item in scenes_dir.iterdir():
                if item.is_dir() and item.name != name:
                    c_path = item / "scene.json"
                    if c_path.exists():
                        try:
                            with open(c_path, "r") as f:
                                c = json.load(f)
                            if c and "layers" in c:
                                for layer in c["layers"]:
                                    if "sprite_name" in layer:
                                        s_name_ref = layer["sprite_name"]
                                        if s_name_ref not in usage_map:
                                            usage_map[s_name_ref] = []
                                        usage_map[s_name_ref].append(item.name)
                        except Exception:
                            pass

            # 3. Delete safe sprites
            for s_name in candidates:
                if s_name in usage_map:
                    kept_sprites.append(s_name)
                    callers = ", ".join(usage_map[s_name])
                    logger.info(f"Preserving sprite {s_name} in reset (used in: {callers})")
                else:
                    s_dir = sprites_dir / s_name
                    if s_dir.exists():
                        shutil.rmtree(s_dir)
                        deleted_sprites.append(s_name)
                        logger.info(f"Deleted sprite {s_name} in reset")

            # 4. Delete generated files in scene (keep original)
            for item in scene_dir.iterdir():
                if not item.name.endswith(".original.png") and not item.name.endswith(
                    ".original.jpg"
                ):
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        os.remove(item)

        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

        asset_logger.log_action(
            "scenes",
            name,
            "DELETE",
            f"Scene processed (mode={mode})",
            f"Kept: {kept_sprites}, Deleted: {deleted_sprites}",
            user_id=user_id,
        )

        return {
            "name": name,
            "message": f"Scene processed (mode={mode})",
            "kept_sprites": kept_sprites,
            "deleted_sprites": deleted_sprites,
        }

    except Exception as e:
        logger.error(f"Delete failed for {name}: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")


@router.post("/{name}/share")
async def share_scene(
    name: str,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    scenes_dir, _ = user_assets
    scene_dir = scenes_dir / name

    if not scene_dir.exists():
        raise HTTPException(status_code=404, detail="Scene not found")

    # Community directory
    community_dir = ASSETS_DIR / "users" / "community" / "scenes"
    community_dir.mkdir(parents=True, exist_ok=True)
    target_dir = community_dir / name

    try:
        if target_dir.exists():
            shutil.rmtree(target_dir)  # Overwrite

        shutil.copytree(scene_dir, target_dir)

        asset_logger.log_action(
            "scenes", name, "SHARE", "Scene shared to community", "", user_id=user_id
        )
        return {"name": name, "message": "Scene shared to community successfully"}
    except Exception as e:
        logger.error(f"Share failed for {name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Share failed: {e}")
