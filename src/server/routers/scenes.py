import csv
import json
import logging
import os
import re
import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, constr

from src.compiler.gemini_client import GeminiCompilerClient
from src.compiler.models import SceneConfig, SceneDecomposition, SceneLayer, SpriteMetadata
from src.config import PROJECT_ROOT
from src.server.dependencies import asset_logger, get_user_assets

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


class GenerateSceneRequest(BaseModel):
    name: constr(max_length=100)
    prompt: constr(max_length=2000)


class OptimizeRequest(BaseModel):
    prompt_guidance: Optional[str] = None


# --- Endpoints ---


@router.get("/scenes", response_model=List[SceneInfo])
async def list_scenes(user_assets=Depends(get_user_assets)):
    scenes_dir, _ = user_assets
    scenes = []
    logger.info(f"Scanning scenes in {scenes_dir}")

    if scenes_dir.exists():
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

                scenes.append(
                    SceneInfo(
                        name=name,
                        has_config=config_path.exists(),
                        has_original=has_original,
                        original_ext=original_ext,
                        config=config,
                        used_sprites=used_sprites,
                    )
                )

    return scenes


@router.post("/scenes/upload")
async def upload_scene(
    name: str = Form(...), file: UploadFile = File(...), user_assets=Depends(get_user_assets)
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

    asset_logger.log_action("scenes", safe_name, "CREATE", "Scene created", f"Filename: {filename}")
    return {"name": safe_name, "message": "Scene created successfully"}


@router.post("/scenes/generate")
async def generate_scene(request: GenerateSceneRequest, user_assets=Depends(get_user_assets)):
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
        "scenes", safe_name, "CREATE", "Scene generated w/ AI", f"Prompt: {request.prompt[:50]}..."
    )
    return {"name": safe_name, "message": "Scene generated successfully"}


@router.post("/scenes/{name}/optimize")
def optimize_scene(
    name: str, request: OptimizeRequest = OptimizeRequest(), user_assets=Depends(get_user_assets)
):
    scenes_dir, sprites_dir = user_assets
    logger.info(f"Starting scene optimization for {name}")
    asset_logger.log_action(
        "scenes",
        name,
        "OPTIMIZE_START",
        "Starting scene optimization",
        f"Guidance: {request.prompt_guidance}",
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

        # 1. Decompose Scene
        logger.info("Step 1: Analyzing scene composition...")
        try:
            prompt_content = (
                PROJECT_ROOT / "assets" / "prompts" / "SceneDecomposition.prompt"
            ).read_text()
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="SceneDecomposition.prompt not found")

        if request.prompt_guidance:
            prompt_content += (
                f"\n\nADDITIONAL USER GUIDANCE: {request.prompt_guidance}\n"
                "Ensure the decomposition respects the above guidance."
            )

        decomposition_json = client.decompose_scene(str(original_path), prompt_content)

        try:
            cleaned_json = decomposition_json.strip()
            if cleaned_json.startswith("```json"):
                cleaned_json = cleaned_json.split("```json")[1]
            if cleaned_json.endswith("```"):
                cleaned_json = cleaned_json.rsplit("```", 1)[0]

            decomp_data = json.loads(cleaned_json)
            decomposition = SceneDecomposition(**decomp_data)
        except Exception as e:
            logger.error(f"Failed to parse decomposition JSON: {decomposition_json} -> {e}")
            raise HTTPException(
                status_code=500, detail="Failed to parse scene decomposition from AI."
            )

        # 2. Extract Background
        logger.info("Step 2: Extracting background...")
        bg_prompt_tmpl = (
            PROJECT_ROOT / "assets" / "prompts" / "BackgroundExtraction.prompt"
        ).read_text()
        objects_desc = "\n".join(
            [f"- {s.description} ({s.location_hint})" for s in decomposition.sprites]
        )
        bg_prompt = bg_prompt_tmpl.replace("{{foreground_objects_list}}", objects_desc)

        if request.prompt_guidance:
            bg_prompt += f"\n\nAdditional nuance: {request.prompt_guidance}"

        bg_bytes = client.extract_element_image(
            str(original_path), bg_prompt, "You are a professional image editor."
        )

        bg_sprite_name = f"{name}_background"
        bg_sprite_dir = sprites_dir / bg_sprite_name
        bg_sprite_dir.mkdir(parents=True, exist_ok=True)

        with open(bg_sprite_dir / f"{bg_sprite_name}.png", "wb") as f:
            f.write(bg_bytes)

        bg_meta = SpriteMetadata(
            name=bg_sprite_name,
            target_height=1080,
            tile_horizontal=False,
            opacity=1.0,
            amplitude_y=0,
            frequency=0.1,
            rotation_range=(0.0, 0.0),
            z_depth=1,
        )
        with open(bg_sprite_dir / f"{bg_sprite_name}.prompt.json", "w") as f:
            f.write(bg_meta.model_dump_json(indent=2))

        # 3. Extract Sprites
        valid_sprites = []
        sprite_extraction_tmpl = (
            PROJECT_ROOT / "assets" / "prompts" / "SpriteExtraction.prompt"
        ).read_text()

        for sprite_info in decomposition.sprites:
            logger.info(
                f"Step 3.{len(valid_sprites) + 1}: Extracting sprite '{sprite_info.name}'..."
            )

            s_name = re.sub(r"[^a-zA-Z0-9_]", "_", sprite_info.name.lower())

            if not s_name or len(s_name) < 2:
                continue

            sprite_prompt = sprite_extraction_tmpl.replace(
                "{{sprite_description}}", sprite_info.description
            )
            sprite_prompt = sprite_prompt.replace("{{location_hint}}", sprite_info.location_hint)

            try:
                sprite_bytes = client.extract_element_image(
                    str(original_path),
                    sprite_prompt,
                    "You are a professional image editor.",
                    aspect_ratio="1:1",
                )

                s_dir = sprites_dir / s_name
                s_dir.mkdir(parents=True, exist_ok=True)

                with open(s_dir / f"{s_name}.png", "wb") as f:
                    f.write(sprite_bytes)

                with open(s_dir / f"{s_name}.original.png", "wb") as f:
                    f.write(sprite_bytes)

                s_meta = SpriteMetadata(
                    name=s_name,
                    target_height=300,
                    amplitude_y=5,
                    frequency=1.0,
                    rotation_range=(-5.0, 5.0),
                    z_depth=5,
                )
                with open(s_dir / f"{s_name}.prompt.json", "w") as f:
                    f.write(s_meta.model_dump_json(indent=2))

                valid_sprites.append(s_name)

            except Exception as e:
                logger.error(f"Failed to extract sprite {s_name}: {e}")
                continue

        # 4. Update Scene Config
        scene_config_path = scene_dir / "scene.json"

        current_config = SceneConfig(name=name, layers=[])
        if scene_config_path.exists():
            try:
                with open(scene_config_path, "r") as f:
                    data = json.load(f)
                    current_config = SceneConfig(**data)
            except Exception:
                pass

        new_layers = []

        new_layers.append(
            SceneLayer(sprite_name=bg_sprite_name, z_depth=1, is_background=True, scroll_speed=0.1)
        )

        for i, s_name in enumerate(valid_sprites):
            new_layers.append(SceneLayer(sprite_name=s_name, z_depth=5 + i, x_offset=0, y_offset=0))

        current_config.layers = new_layers

        with open(scene_config_path, "w") as f:
            f.write(current_config.model_dump_json(indent=2))

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

        asset_logger.log_action(
            "scenes",
            name,
            "OPTIMIZE_COMPLETE",
            "Scene decomposed and extracted",
            f"Found {len(valid_sprites)} sprites",
        )

        return {
            "name": name,
            "sprites_found": valid_sprites,
            "decomposition": decomposition.model_dump(),
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
        )
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail=f"Optimization failed: {error_detail}. Hint: {hint}"
        )


@router.delete("/scenes/{name}")
def delete_scene(name: str, mode: str = "delete_scene", user_assets=Depends(get_user_assets)):
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
            # Delete everything except original files
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
            "scenes", name, "DELETE", f"Scene deleted (mode={mode})", f"Kept: {kept_sprites}"
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
async def update_scene_config(name: str, config: dict, user_assets=Depends(get_user_assets)):
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

        asset_logger.log_action("scenes", name, "UPDATE_CONFIG", "Scene config updated", "")
        return {"name": name, "message": "Config updated successfully", "config": config}
    except Exception as e:
        logger.error(f"Failed to update config for {name}: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid config: {str(e)}")
