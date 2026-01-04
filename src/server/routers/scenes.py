import csv
import json
import logging
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, constr

from src.compiler.gemini_client import GeminiCompilerClient
from src.compiler.models import (
    SceneConfig,
    SceneLayer,
    SpriteMetadata,
)
from src.config import PROJECT_ROOT
from src.server import image_processing as img_proc
from src.server.dependencies import (
    asset_logger,
    get_community_assets,
    get_current_user,
    get_user_assets,
)

logger = logging.getLogger("papeterie")
router = APIRouter(tags=["scenes"])

# --- Models ---


class SceneInfo(BaseModel):
    name: str
    has_config: bool
    has_original: bool = False
    original_ext: Optional[str] = None
    config: Optional[dict] = None
    used_sprites: List[str] = []
    original_url: Optional[str] = None
    is_community: bool = False
    creator: Optional[str] = None


class GenerateSceneRequest(BaseModel):
    name: constr(max_length=100)
    prompt: constr(max_length=2000)


class OptimizeRequest(BaseModel):
    prompt_guidance: Optional[str] = None


# --- Endpoints ---


@router.get("/scenes", response_model=List[SceneInfo])
async def list_scenes(
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
    community_assets=Depends(get_community_assets),
):
    scenes_dir, _ = user_assets
    community_scenes, _ = community_assets

    scenes = []

    def scan_dir(directory: Path, is_comm: bool = False, owner_id: str = "default"):
        logger.info(f"Scanning scenes in {directory} (community={is_comm})")
        found = []
        if not directory.exists():
            return found

        for item in directory.iterdir():
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

                base_uid = "community" if is_comm else owner_id
                original_url = None
                if has_original:
                    original_url = (
                        f"/assets/users/{base_uid}/scenes/{name}/{name}.original.{original_ext}"
                    )

                found.append(
                    SceneInfo(
                        name=name,
                        has_config=config_path.exists(),
                        has_original=has_original,
                        original_ext=original_ext,
                        config=config,
                        used_sprites=used_sprites,
                        original_url=original_url,
                        is_community=is_comm,
                        creator=None if is_comm else owner_id,
                    )
                )
        return found

    # User scenes first
    scenes.extend(scan_dir(scenes_dir, is_comm=False, owner_id=user_id))

    # Community scenes
    community_list = scan_dir(community_scenes, is_comm=True)
    user_scene_names = {s.name for s in scenes}
    for s in community_list:
        if s.name not in user_scene_names:
            scenes.append(s)

    logger.info(f"Found {len(scenes)} scenes")
    return scenes


@router.post("/scenes/{name}/share")
async def share_scene(
    name: str,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
    community_assets=Depends(get_community_assets),
):
    scenes_dir, _ = user_assets
    community_scenes, _ = community_assets

    src_dir = scenes_dir / name
    if not src_dir.exists():
        raise HTTPException(status_code=404, detail="Scene not found in your library")

    dest_dir = community_scenes / name
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Copy files
    for item in src_dir.iterdir():
        if item.is_file():
            shutil.copy2(item, dest_dir / item.name)

    asset_logger.log_action(
        "scenes", name, "share", f"Scene shared to community by {user_id}", user_id=user_id
    )

    return {"status": "success", "message": f"Scene '{name}' shared to community"}


@router.post("/scenes/upload")
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


@router.post("/scenes/generate")
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


@router.post("/scenes/{name}/optimize")
def optimize_scene(
    name: str,
    request: OptimizeRequest = OptimizeRequest(),
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    scenes_dir, sprites_dir = user_assets
    logger.info(f"Starting scene optimization for {name}")
    asset_logger.clear_logs("scenes", name, user_id=user_id)
    asset_logger.log_action(
        "scenes",
        name,
        "OPTIMIZE_START",
        "Starting scene optimization",
        f"Guidance: {request.prompt_guidance}",
        user_id=user_id,
    )
    start_time = datetime.now()

    scene_dir = scenes_dir / name
    original_png = scene_dir / f"{name}.original.png"
    original_jpg = scene_dir / f"{name}.original.jpg"

    original_path = None
    if original_png.exists():
        original_path = original_png
    elif original_jpg.exists():
        original_path = original_jpg
    else:
        raise HTTPException(
            status_code=404, detail="Original scene image not found. Cannot optimize."
        )

    try:
        client = GeminiCompilerClient()

        # 1. Stage 1: Descriptive Analysis (Creative)
        logger.info("Step 1: Analyzing scene composition (Creative Stage)...")
        try:
            stage1_prompt = (
                PROJECT_ROOT / "assets" / "prompts" / "SceneDescriptiveAnalysis.prompt"
            ).read_text()
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="SceneDescriptiveAnalysis.prompt not found")

        asset_logger.log_info(
            "scenes", name, "Step 1: Getting creative description from Gemini...", user_id=user_id
        )
        stage1_response_text = client.descriptive_scene_analysis(str(original_path), stage1_prompt)

        # Parse Stage 1 JSON
        try:
            cleaned_s1 = stage1_response_text.strip()
            if cleaned_s1.startswith("```json"):
                cleaned_s1 = cleaned_s1.split("```json")[1]
            if cleaned_s1.endswith("```"):
                cleaned_s1 = cleaned_s1.rsplit("```", 1)[0]

            stage1_data = json.loads(cleaned_s1)
            # Expected: { "background": {...}, "sprites": [ ... ] }
        except Exception as e:
            logger.error(f"Failed to parse Stage 1 JSON: {stage1_response_text} -> {e}")
            raise HTTPException(
                status_code=500, detail="Failed to parse creative analysis from AI."
            )

        # 2. Stage 2: Behavior Structuring (Technical)
        logger.info("Step 2: Structuring behaviors (Technical Stage)...")
        try:
            stage2_prompt = (
                PROJECT_ROOT / "assets" / "prompts" / "BehaviorStructuring.prompt"
            ).read_text()
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="BehaviorStructuring.prompt not found")

        asset_logger.log_info(
            "scenes", name, "Step 2: Converting descriptions to behaviors...", user_id=user_id
        )
        # Pass the raw Stage 1 text (or cleaned JSON string) to Stage 2
        stage2_response_text = client.structure_behaviors(
            json.dumps(stage1_data, indent=2), stage2_prompt
        )

        # Parse Stage 2 JSON
        try:
            cleaned_s2 = stage2_response_text.strip()
            if cleaned_s2.startswith("```json"):
                cleaned_s2 = cleaned_s2.split("```json")[1]
            if cleaned_s2.endswith("```"):
                cleaned_s2 = cleaned_s2.rsplit("```", 1)[0]

            from src.compiler.models import StructuredSceneData

            stage2_dict = json.loads(cleaned_s2)
            structured_data = StructuredSceneData(**stage2_dict)
        except Exception as e:
            logger.error(f"Failed to parse Stage 2 JSON: {stage2_response_text} -> {e}")
            raise HTTPException(status_code=500, detail="Failed to structure behaviors from AI.")

        # 3. Extract Background
        logger.info("Step 3: Extracting background...")
        bg_prompt_tmpl = (
            PROJECT_ROOT / "assets" / "prompts" / "BackgroundExtraction.prompt"
        ).read_text()

        # Reconstruct objects description from Stage 1 for the negative prompt context
        objects_desc_list = []
        if "sprites" in stage1_data:
            for s in stage1_data["sprites"]:
                # Use robust key access
                desc = s.get("visual_description", "")
                loc = s.get("location_description", "")
                objects_desc_list.append(f"- {desc} ({loc})")

        objects_desc = "\n".join(objects_desc_list)
        bg_prompt = bg_prompt_tmpl.replace("{{foreground_objects_list}}", objects_desc)

        if request.prompt_guidance:
            bg_prompt += f"\n\nAdditional nuance: {request.prompt_guidance}"

        asset_logger.log_info("scenes", name, "Step 3: Extracting background...", user_id=user_id)
        bg_bytes = client.extract_element_image(
            str(original_path), bg_prompt, "You are a professional image editor."
        )

        bg_sprite_name = f"{name}_background"
        bg_sprite_dir = sprites_dir / bg_sprite_name
        bg_sprite_dir.mkdir(parents=True, exist_ok=True)

        with open(bg_sprite_dir / f"{bg_sprite_name}.png", "wb") as f:
            f.write(bg_bytes)

        # Create basic metadata for background (behaviors will come from scene_config)
        bg_meta = SpriteMetadata(
            name=bg_sprite_name,
            target_height=1080,
            tile_horizontal=False,
            z_depth=1,
            behaviors=[],  # Background behaviors are usually on the scene layer, or could be here
        )
        with open(bg_sprite_dir / f"{bg_sprite_name}.prompt.json", "w") as f:
            f.write(bg_meta.model_dump_json(indent=2))

        # --- Initialize Scene Config Early for Incremental Updates ---
        from src.compiler.models import BackgroundBehavior, LocationBehavior

        # Determine initial layers (just background)
        initial_layers = [
            SceneLayer(
                sprite_name=bg_sprite_name,
                behaviors=[
                    LocationBehavior(z_depth=1),
                    BackgroundBehavior(scroll_speed=0.1),
                ],
            )
        ]

        # Load existing config to preserve name/duration if exists
        scene_config_path = scene_dir / "scene.json"
        active_config = SceneConfig(name=name, layers=initial_layers)

        if scene_config_path.exists():
            try:
                with open(scene_config_path, "r") as f:
                    data = json.load(f)
                    # Preserve existing non-layer settings
                    existing_config = SceneConfig(**data)
                    active_config.duration_sec = existing_config.duration_sec
                    active_config.sounds = existing_config.sounds
                    # We intentionally reset layers to just background as we are re-optimizing
            except Exception:
                pass

        active_config.layers = initial_layers

        # Save initial state
        with open(scene_config_path, "w") as f:
            f.write(active_config.model_dump_json(indent=2, exclude_none=True))

        # 4. Extract Sprites
        valid_sprites = []
        sprite_extraction_tmpl = (
            PROJECT_ROOT / "assets" / "prompts" / "SpriteExtraction.prompt"
        ).read_text()

        # Iterate through Stage 1 sprites for extraction prompts
        for i, sprite_info in enumerate(stage1_data.get("sprites", [])):
            s_raw_name = sprite_info.get("name", f"sprite_{i}")
            s_desc = sprite_info.get("visual_description", "An object")
            s_loc = sprite_info.get("location_description", "In the scene")

            msg = f"Step 4.{len(valid_sprites) + 1}: Extracting sprite '{s_raw_name}'..."
            logger.info(msg)
            asset_logger.log_info("scenes", name, msg, user_id=user_id)

            s_name = re.sub(r"[^a-zA-Z0-9_]", "_", s_raw_name.lower())

            if not s_name or len(s_name) < 2:
                continue

            sprite_prompt = sprite_extraction_tmpl.replace("{{sprite_description}}", s_desc)
            sprite_prompt = sprite_prompt.replace("{{location_hint}}", s_loc)

            try:
                sprite_bytes = client.extract_element_image(
                    str(original_path),
                    sprite_prompt,
                    "You are a professional image editor.",
                    aspect_ratio="1:1",
                )

                s_img = img_proc.image_from_bytes(sprite_bytes)
                s_img = img_proc.remove_green_screen(s_img)

                s_dir = sprites_dir / s_name
                s_dir.mkdir(parents=True, exist_ok=True)

                s_img.save(s_dir / f"{s_name}.png", "PNG")
                s_img.save(s_dir / f"{s_name}.original.png", "PNG")

                # Find matching behaviors from Stage 2 structured data
                matching_struct = next(
                    (s for s in structured_data.sprites if s.sprite_name == s_raw_name), None
                )

                # Default behaviors if not found
                s_behaviors = []
                if matching_struct:
                    s_behaviors = matching_struct.behaviors
                else:
                    # Fallback default
                    from src.compiler.models import LocationBehavior

                    s_behaviors = [LocationBehavior(z_depth=50)]

                s_meta = SpriteMetadata(name=s_name, target_height=300, behaviors=s_behaviors)
                with open(s_dir / f"{s_name}.prompt.json", "w") as f:
                    f.write(s_meta.model_dump_json(indent=2))

                valid_sprites.append(s_name)

                # --- INCREMENTAL UPDATE START ---
                # Add this sprite to the scene config immediately
                active_config.layers.append(
                    SceneLayer(
                        sprite_name=s_name,
                        behaviors=s_behaviors,  # Use the same behaviors we derived
                    )
                )

                # Write updated scene config to disk
                with open(scene_config_path, "w") as f:
                    f.write(active_config.model_dump_json(indent=2, exclude_none=True))

                asset_logger.log_info(
                    "scenes", name, f"Added '{s_name}' to scene.", user_id=user_id
                )
                # --- INCREMENTAL UPDATE END ---

            except Exception as e:
                logger.error(f"Failed to extract sprite {s_name}: {e}")
                continue

        # 5. Collect Token Stats
        ledger_stats = []
        try:
            log_file = PROJECT_ROOT / "logs" / "token_ledger.csv"
            if log_file.exists():
                with open(log_file, "r") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        try:
                            ts = datetime.fromisoformat(row["timestamp"])
                            if ts >= start_time:
                                ledger_stats.append(row)
                        except Exception:
                            pass
        except Exception as e:
            logger.error(f"Failed to read ledger: {e}")

        logger.info(f"Optimization complete. Found {len(valid_sprites)} sprites.")
        asset_logger.log_info(
            "scenes",
            name,
            f"Optimization complete. Found {len(valid_sprites)} sprites.",
            user_id=user_id,
        )

        asset_logger.log_action(
            "scenes",
            name,
            "OPTIMIZE_COMPLETE",
            "Scene decomposed and extracted",
            f"Found {len(valid_sprites)} sprites",
            user_id=user_id,
        )

        return {
            "name": name,
            "sprites_found": valid_sprites,
            "decomposition": stage1_data,
            "ledger_stats": ledger_stats,
        }

    except BaseException as e:
        import traceback

        traceback.print_exc()
        logger.error(f"Optim failed: {e}")
        error_detail = str(e)
        hint = "Failed to decompose scene. Check API keys, image complexity, or server timeout."
        asset_logger.log_action(
            "scenes",
            name,
            "OPTIMIZE_FAILED",
            "Optimization failed",
            f"Error: {error_detail}\nHint: {hint}",
            user_id=user_id,
        )
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail=f"Optimization failed: {error_detail}. Hint: {hint}"
        )


@router.delete("/scenes/{name}")
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


@router.put("/scenes/{name}/config")
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
        # Validate with Pydantic
        scene_config = SceneConfig(**config)

        with open(config_path, "w") as f:
            f.write(scene_config.model_dump_json(indent=2))

        asset_logger.log_action(
            "scenes", name, "UPDATE_CONFIG", "Scene config updated", "", user_id=user_id
        )
        return {
            "name": name,
            "message": "Config updated successfully",
            "config": config,
        }

    except Exception as e:
        logger.error(f"Failed to update config for {name}: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid config: {str(e)}")


class RotateRequest(BaseModel):
    angle: int


@router.post("/scenes/{name}/rotate")
async def rotate_scene(
    name: str,
    request: RotateRequest,
    user_id: str = Depends(get_current_user),
    user_assets=Depends(get_user_assets),
):
    from PIL import Image

    scenes_dir, _ = user_assets
    scene_dir = scenes_dir / name

    if not scene_dir.exists():
        # Check if it might be a community asset
        logger.warning(f"Rotate Request: Scene dir {scene_dir} not found. Returning 404.")
        raise HTTPException(
            status_code=404,
            detail=f"Scene '{name}' not found. Note: Community assets cannot be edited directly.",
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
