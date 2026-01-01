from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from pathlib import Path
import logging
from .logger import setup_server_logger, AssetLogger
from pydantic import BaseModel, constr
from src.compiler.gemini_client import GeminiCompilerClient
from src.compiler.engine import SpriteCompiler
from src.compiler.models import SpriteMetadata, SceneConfig, SceneLayer, SceneDecomposition
from datetime import datetime
import re

# Setup logging
PROJECT_ROOT = Path(__file__).parent.parent.parent
LOGS_DIR = PROJECT_ROOT / "logs"
ASSETS_DIR = PROJECT_ROOT / "assets"

logger = setup_server_logger(LOGS_DIR)
asset_logger = AssetLogger(ASSETS_DIR)

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
SCENES_DIR = PROJECT_ROOT / "assets" / "scenes"
ASSETS_DIR = PROJECT_ROOT / "assets"

SPRITES_DIR.mkdir(parents=True, exist_ok=True)
SCENES_DIR.mkdir(parents=True, exist_ok=True)

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

class SceneInfo(BaseModel):
    name: str
    has_config: bool
    has_original: bool = False
    original_ext: Optional[str] = None
    config: Optional[dict] = None
    used_sprites: List[str] = []

class CompileRequest(BaseModel):
    name: constr(max_length=100)
    prompt: constr(max_length=2000)

class GenerateSceneRequest(BaseModel):
    name: constr(max_length=100)
    prompt: constr(max_length=2000)

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

@app.get("/api/scenes", response_model=List[SceneInfo])
async def list_scenes():
    scenes = []
    logger.info(f"Scanning scenes in {SCENES_DIR}")
    
    # Check for both scene_* convention and directory-based convention
    # For now, let's look for directories in assets/scenes/
    if SCENES_DIR.exists():
        for item in SCENES_DIR.iterdir():
            if item.is_dir():
                name = item.name
                config_path = item / "scene.json"
                
                # Check for original art in assets/scenes/<name>
                # It could be .png or .jpg
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
                        import json
                        with open(config_path, 'r') as f:
                            config = json.load(f)
                            
                        # Extract used sprites
                        if config and "layers" in config:
                            for layer in config["layers"]:
                                if "sprite_name" in layer:
                                    used_sprites.append(layer["sprite_name"])
                                    
                        # Deduplicate
                        used_sprites = list(set(used_sprites))
                            
                    except Exception as e:
                        logger.error(f"Failed to load scene config for {name}: {e}")
                
                scenes.append(SceneInfo(
                    name=name,
                    has_config=config_path.exists(),
                    has_original=has_original,
                    original_ext=original_ext,
                    config=config,
                    used_sprites=used_sprites
                ))
    
    return scenes

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
            # SAVE TO SPRITE DIR
            original_path = sprite_dir / f"{safe_name}.original.png"
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

        asset_logger.log_action("sprites", safe_name, "UPLOAD", "Sprite uploaded and processed", f"Method: {processing_method}")
        
    except Exception as e:
        logger.error(f"Failed to process upload for {safe_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Image processing failed. Check server logs.")
        
    return {"name": safe_name, "message": "Sprite image uploaded and processed successfully"}

@app.post("/api/scenes/upload")
async def upload_scene(
    name: str = Form(...), 
    file: UploadFile = File(...)
):
    # Sanitize name
    safe_name = "".join(c for c in name if c.isalnum() or c in ('_', '-')).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid scene name")

    # Create scene directory: assets/scenes/<name>
    scene_dir = SCENES_DIR / safe_name
    
    if scene_dir.exists():
        raise HTTPException(status_code=400, detail="Scene already exists")

    scene_dir.mkdir(parents=True, exist_ok=True)
    
    # Save original image to assets/scenes/<name>/<name>.original.<ext>
    
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
        
        # Create default scene.json
        config_path = scene_dir / "scene.json"
        import json
        default_config = {
            "name": safe_name,
            "layers": []
        }
        with open(config_path, "w") as f:
            json.dump(default_config, f, indent=2)
            
    except Exception as e:
        logger.error(f"Failed to create scene {safe_name}: {e}")
        # Cleanup
        if scene_dir.exists():
            shutil.rmtree(scene_dir)
        # original_path is inside scene_dir, so it's gone
        raise HTTPException(status_code=500, detail="Scene creation failed. Check server logs.")

    asset_logger.log_action("scenes", safe_name, "CREATE", "Scene created", f"Filename: {filename}")
    return {"name": safe_name, "message": "Scene created successfully"}

@app.post("/api/scenes/generate")
async def generate_scene(request: GenerateSceneRequest):
    # Sanitize name
    safe_name = "".join(c for c in request.name if c.isalnum() or c in ('_', '-')).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid scene name")
    
    # Create scene directory: assets/scenes/<name>
    scene_dir = SCENES_DIR / safe_name
    
    if scene_dir.exists():
        raise HTTPException(status_code=400, detail="Scene already exists")

    scene_dir.mkdir(parents=True, exist_ok=True)
    original_path = scene_dir / f"{safe_name}.original.png"
    
    try:
        # Generate image using Gemini
        try:
            client = GeminiCompilerClient() # Relies on env vars
            image_bytes = client.generate_image(request.prompt)
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

        # Save generated image
        with open(original_path, "wb") as f:
            f.write(image_bytes)
            
        logger.info(f"Saved generated scene art for {safe_name} to {original_path}")
        
        # Create default scene.json
        config_path = scene_dir / "scene.json"
        import json
        default_config = {
            "name": safe_name,
            "layers": []
        }
        with open(config_path, "w") as f:
            json.dump(default_config, f, indent=2)
            
    except Exception as e:
        logger.error(f"Failed to create generated scene {safe_name}: {e}")
        # Cleanup
        if scene_dir.exists():
            shutil.rmtree(scene_dir)
        if original_path.exists():
            os.remove(original_path)
            
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Scene generation failed. Check server logs.")

    asset_logger.log_action("scenes", safe_name, "CREATE", "Scene generated w/ AI", f"Prompt: {request.prompt[:50]}...")
    return {"name": safe_name, "message": "Scene generated successfully"}

class OptimizeRequest(BaseModel):
    prompt_guidance: str = None

@app.post("/api/scenes/{name}/optimize")
def optimize_scene(name: str, request: OptimizeRequest = OptimizeRequest()):
    logger.info(f"Starting scene optimization for {name}")
    asset_logger.log_action("scenes", name, "OPTIMIZE_START", "Starting scene optimization", f"Guidance: {request.prompt_guidance}")
    start_time = datetime.now()
    
    scene_dir = SCENES_DIR / name
    original_png = scene_dir / f"{name}.original.png"
    original_jpg = scene_dir / f"{name}.original.jpg"
    
    original_path = None
    if original_png.exists():
        original_path = original_png
    elif original_jpg.exists():
        original_path = original_jpg
    else:
        raise HTTPException(status_code=404, detail="Original scene image not found. Cannot optimize.")

    try:
        client = GeminiCompilerClient()
        import json
        import csv
        
        # 1. Decompose Scene
        logger.info("Step 1: Analyzing scene composition...")
        try:
            prompt_content = (PROJECT_ROOT / "assets" / "prompts" / "SceneDecomposition.prompt").read_text()
        except FileNotFoundError:
             raise HTTPException(status_code=500, detail="SceneDecomposition.prompt not found")

        # Inject user guidance if provided
        if request.prompt_guidance:
            prompt_content += f"\n\nADDITIONAL USER GUIDANCE: {request.prompt_guidance}\nEnsure the decomposition respects the above guidance."

        decomposition_json = client.decompose_scene(str(original_path), prompt_content)
        
        # Parse JSON
        try:
            # Cleanup potentially md formatted json
            cleaned_json = decomposition_json.strip()
            if cleaned_json.startswith("```json"):
                cleaned_json = cleaned_json.split("```json")[1]
            if cleaned_json.endswith("```"):
                cleaned_json = cleaned_json.rsplit("```", 1)[0]
                
            decomp_data = json.loads(cleaned_json)
            decomposition = SceneDecomposition(**decomp_data)
        except Exception as e:
            logger.error(f"Failed to parse decomposition JSON: {decomposition_json} -> {e}")
            raise HTTPException(status_code=500, detail="Failed to parse scene decomposition from AI.")

        # 2. Extract Background
        logger.info("Step 2: Extracting background...")
        bg_prompt_tmpl = (PROJECT_ROOT / "assets" / "prompts" / "BackgroundExtraction.prompt").read_text()
        # Create list of object descriptions to remove
        objects_desc = "\n".join([f"- {s.description} ({s.location_hint})" for s in decomposition.sprites])
        bg_prompt = bg_prompt_tmpl.replace("{{foreground_objects_list}}", objects_desc)
        
        # Inject guidance into BG extraction too if relevant? 
        # For now, let's assume guidance is mostly for decomposition (what to identify).
        # But maybe also for how to fill? Let's append generic guidance.
        if request.prompt_guidance:
            bg_prompt += f"\n\nAdditional nuance: {request.prompt_guidance}"

        bg_bytes = client.extract_element_image(str(original_path), bg_prompt, "You are a professional image editor.")
        
        # Save Background Sprite
        bg_sprite_name = f"{name}_background"
        bg_sprite_dir = SPRITES_DIR / bg_sprite_name
        bg_sprite_dir.mkdir(parents=True, exist_ok=True)
        
        with open(bg_sprite_dir / f"{bg_sprite_name}.png", "wb") as f:
            f.write(bg_bytes)
            
        # Create minimal prompt.json for background
        # Create minimal prompt.json for background
        bg_meta = SpriteMetadata(
            name=bg_sprite_name,
            target_height=1080, # Assume full HD for BG
            tile_horizontal=False,
            opacity=1.0,
            # Scene BG doesn't usually bob
            amplitude_y=0,
            frequency=0.1,
            rotation_range=(0.0, 0.0),
            z_depth=1
        )
        with open(bg_sprite_dir / f"{bg_sprite_name}.prompt.json", "w") as f:
             f.write(bg_meta.model_dump_json(indent=2))
        
        # 3. Extract Sprites
        valid_sprites = []
        sprite_extraction_tmpl = (PROJECT_ROOT / "assets" / "prompts" / "SpriteExtraction.prompt").read_text()
        
        for sprite_info in decomposition.sprites:
            logger.info(f"Step 3.{len(valid_sprites)+1}: Extracting sprite '{sprite_info.name}'...")
            
            # Sanitize name
            s_name = re.sub(r'[^a-zA-Z0-9_]', '_', sprite_info.name.lower())
            
            # Skip if name is too generic or empty
            if not s_name or len(s_name) < 2: 
                continue

            sprite_prompt = sprite_extraction_tmpl.replace("{{sprite_description}}", sprite_info.description)
            sprite_prompt = sprite_prompt.replace("{{location_hint}}", sprite_info.location_hint)
            
            try:
                # Use default aspect ratio "1:1" for sprites (implied default in extract_element_image unless overridden)
                # But wait, extract_element_image defaults to 16:9 for scenes. 
                # We should explicitly use 1:1 for sprites or let them be whatever fits?
                # Usually sprites are square-ish 1:1 unless wide. Let's try 1:1 for sprites.
                sprite_bytes = client.extract_element_image(str(original_path), sprite_prompt, "You are a professional image editor.", aspect_ratio="1:1")
                
                s_dir = SPRITES_DIR / s_name
                s_dir.mkdir(parents=True, exist_ok=True)
                
                with open(s_dir / f"{s_name}.png", "wb") as f:
                    f.write(sprite_bytes)
                
                # Save original in sprite dir as well? 
                # Theoretically we could, but we are extracting FROM a scene original. 
                # We don't have a "sprite specific original" unless we crop it ourselves. 
                # The extracted image IS the sprite asset.
                # So we leave {s_name}.original.png empty or copy the generated one?
                # User rule: "Consolidate assets/original/sprites -> assets/sprites/{name}/{name}.original.{ext}"
                # Since this is AI generated, maybe we save a copy as original?
                # Let's save it as original too so we can "revert" or re-process if needed.
                with open(s_dir / f"{s_name}.original.png", "wb") as f:
                    f.write(sprite_bytes)

                # Metadata
                s_meta = SpriteMetadata(
                    name=s_name,
                    target_height=300, # Default estimate
                    amplitude_y=5, # Default liveliness
                    frequency=1.0,
                    rotation_range=(-5.0, 5.0),
                    z_depth=5
                )
                with open(s_dir / f"{s_name}.prompt.json", "w") as f:
                     f.write(s_meta.model_dump_json(indent=2))
                
                valid_sprites.append(s_name)
                
            except Exception as e:
                logger.error(f"Failed to extract sprite {s_name}: {e}")
                # Continue best effort
                continue

        # 4. Update Scene Config
        scene_config_path = scene_dir / "scene.json"
        
        # Load existing or create new
        current_config = SceneConfig(name=name, layers=[])
        if scene_config_path.exists():
            try:
                with open(scene_config_path, "r") as f:
                    data = json.load(f)
                    current_config = SceneConfig(**data)
            except:
                pass # Overwrite if corrupt
        
        # Rebuild layers? Or append?
        # Strategy: Clear layers and rebuild from decomposition to avoid duplicates
        new_layers = []
        
        # Add Background first
        new_layers.append(SceneLayer(
            sprite_name=bg_sprite_name,
            z_depth=1,
            is_background=True,
            scroll_speed=0.1
        ))
        
        # Add Sprites
        for i, s_name in enumerate(valid_sprites):
            new_layers.append(SceneLayer(
                sprite_name=s_name,
                z_depth=5 + i, # Stack them
                x_offset=0,
                y_offset=0
            ))
            
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
                        # Parse timestamp
                        try:
                            ts = datetime.fromisoformat(row['timestamp'])
                            if ts >= start_time:
                                ledger_stats.append(row)
                        except:
                            pass
        except Exception as e:
            logger.error(f"Failed to read ledger: {e}")

        logger.info(f"Optimization complete. Found {len(valid_sprites)} sprites.")
        
        asset_logger.log_action("scenes", name, "OPTIMIZE_COMPLETE", "Scene decomposed and extracted", f"Found {len(valid_sprites)} sprites")

        return {
            "name": name, 
            "sprites_found": valid_sprites, 
            "decomposition": decomposition.model_dump(),
            "ledger_stats": ledger_stats
        }

    except BaseException as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Optim failed: {e}")
        error_detail = str(e)
        hint = "Failed to decompose scene. Check API keys, image complexity, or server timeout."
        asset_logger.log_action("scenes", name, "OPTIMIZE_FAILED", "Optimization failed", f"Error: {error_detail}\nHint: {hint}")
        # Note: We re-raise, but as HTTP exception if possible
        if isinstance(e, HTTPException):
             raise e
        raise HTTPException(status_code=500, detail=f"Optimization failed: {error_detail}. Hint: {hint}")

@app.post("/api/sprites/{name}/process")
def process_sprite(name: str, request: ProcessRequest):
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
        
        asset_logger.log_action("sprites", name, "PROCESS", "Sprite processed", f"Method: {processing_method}\nError: {error_msg}")

        return {
            "name": name, 
            "message": "Sprite processed successfully",
            "method": processing_method,
            "error_details": error_msg # This one is nuanced, maybe we want to keep it? User wants helpful messages.
        }
    except Exception as e:
        logger.error(f"Processing failed for {name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Processing failed. Check server logs.")

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
         logger.error(f"Revert failed for {name}: {e}", exc_info=True)
         raise HTTPException(status_code=500, detail="Revert failed. Check server logs.")

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
        logger.error(f"Compilation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Compilation failed. Check server logs.")

@app.get("/api/logs/{asset_type}/{name}")
async def get_asset_logs(asset_type: str, name: str):
    if asset_type not in ["sprites", "scenes"]:
        raise HTTPException(status_code=400, detail="Invalid asset type")
    return {"content": asset_logger.get_logs(asset_type, name)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.server.main:app", host="0.0.0.0", port=8000, reload=True)
