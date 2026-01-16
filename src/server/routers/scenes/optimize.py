import csv
import json
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from src.compiler.gemini_client import GeminiCompilerClient
from src.compiler.models import (
    BackgroundBehavior,
    LocationBehavior,
    SceneConfig,
    SceneLayer,
    SpriteMetadata,
    StructuredSceneData,
)
from src.config import PROJECT_ROOT
from src.server import image_processing as img_proc
from src.server.dependencies import (
    asset_logger,
    get_current_user,
    get_user_assets,
)
from src.server.local_processor import LocalImageProcessor

from .models import OptimizeRequest

logger = logging.getLogger("papeterie")
router = APIRouter()


@router.post("/{name}/optimize")
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
        f"Guidance: {request.prompt_guidance}, Mode: {request.processing_mode}",
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

            stage2_dict = json.loads(cleaned_s2)
            structured_data = StructuredSceneData(**stage2_dict)
        except Exception as e:
            logger.error(f"Failed to parse Stage 2 JSON: {stage2_response_text} -> {e}")
            raise HTTPException(status_code=500, detail="Failed to structure behaviors from AI.")

        # 3. Extract Background
        logger.info("Step 3: Extracting background...")
        asset_logger.log_info(
            "scenes",
            name,
            f"Step 3: Extracting background (mode={request.processing_mode})...",
            user_id=user_id,
        )

        if request.processing_mode == "local":
            # Local processing: Use rembg + inpainting (zero API cost)
            local_proc = LocalImageProcessor()
            scene_image = img_proc.image_from_bytes(original_path.read_bytes())
            bg_bytes = local_proc.extract_background(scene_image)
        else:
            # LLM processing: Use Gemini (high quality, API cost)
            bg_prompt_tmpl = (
                PROJECT_ROOT / "assets" / "prompts" / "BackgroundExtraction.prompt"
            ).read_text()

            # Reconstruct objects description for the negative prompt context
            objects_desc_list = []
            if "sprites" in stage1_data:
                for s in stage1_data["sprites"]:
                    desc = s.get("visual_description", "")
                    loc = s.get("location_description", "")
                    objects_desc_list.append(f"- {desc} ({loc})")

            objects_desc = "\n".join(objects_desc_list)
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
                if request.processing_mode == "local":
                    # Local processing: Use rembg (zero API cost)
                    # Note: For local mode, we extract the full image and let rembg isolate
                    if "local_proc" not in dir():
                        local_proc = LocalImageProcessor()
                    scene_image = img_proc.image_from_bytes(original_path.read_bytes())
                    sprite_bytes, _ = local_proc.extract_sprite(scene_image)
                    s_img = img_proc.image_from_bytes(sprite_bytes)
                    s_img = img_proc.remove_green_screen(s_img)
                else:
                    # LLM processing: Use Gemini (high quality, API cost)
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

                # Get the animation_intent from Stage 1 for LLM guidance preservation
                animation_intent = sprite_info.get("animation_intent", "")

                # Build behaviors WITHOUT per-behavior llm_guidance (moved to layer level)
                s_behaviors = []
                if matching_struct:
                    # Use behaviors from structured data directly
                    s_behaviors = list(matching_struct.behaviors)
                else:
                    # Fallback default
                    s_behaviors = [LocationBehavior(z_depth=50)]

                s_meta = SpriteMetadata(name=s_name, target_height=300, behaviors=s_behaviors)
                with open(s_dir / f"{s_name}.prompt.json", "w") as f:
                    f.write(s_meta.model_dump_json(indent=2))

                valid_sprites.append(s_name)

                # --- INCREMENTAL UPDATE START ---
                # Add this sprite to the scene config immediately
                # Store behavior_guidance at layer level (not per-behavior)
                active_config.layers.append(
                    SceneLayer(
                        sprite_name=s_name,
                        behaviors=s_behaviors,
                        behavior_guidance=animation_intent if animation_intent else None,
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
