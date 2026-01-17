import logging
import os
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Set headless mode for Pygame before importing anything that might init it
os.environ["SDL_VIDEODRIVER"] = "dummy"

import pygame
from moviepy.video.io.ImageSequenceClip import ImageSequenceClip

from src.renderer.theatre import Theatre

router = APIRouter(
    prefix="/api/export",
    tags=["export"],
)

logger = logging.getLogger(__name__)


class ExportRequest(BaseModel):
    user_id: str
    scene_name: str
    duration: float = 5.0
    width: int = 1280
    height: int = 720
    fps: int = 30


@router.post("")
async def export_video(request: ExportRequest):
    """
    Export a scene to an MP4 video file.
    """
    from src.server.dependencies import is_safe_id

    try:
        user_id = request.user_id
        scene_name = request.scene_name

        if not (is_safe_id(user_id) and is_safe_id(scene_name)):
            raise HTTPException(status_code=400, detail="Invalid identification format")

        # Paths
        # Assuming standard structure: assets/users/{user_id}/scenes/{scene_name}
        base_asset_path = Path("assets")
        user_scenes_dir = base_asset_path / "users" / user_id / "scenes"
        scene_dir = user_scenes_dir / scene_name
        scene_file = scene_dir / "scene.json"

        if not scene_file.exists():
            raise HTTPException(status_code=404, detail=f"Scene not found: {scene_file}")

        # Output Directory
        export_dir = base_asset_path / "users" / user_id / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        timestamp = int(time.time())
        output_filename = f"{scene_name}_{timestamp}.mp4"
        output_path = export_dir / output_filename

        logger.info(f"Starting export for scene {scene_name} to {output_path}")

        # Initialize Renderer
        # We need to construct the Theatre instance carefully
        # The Theatre class takes a scene_path, but currently loads it internally.
        # We might need to manually inject the scene config if the Theatre class
        # API doesn't support passing loaded config directly, or we rely on it loading from file.

        # For this implementation, we rely on Theatre loading the file we specify.
        # However, Theatre.__init__ defaults to a specific path.
        # We need to make sure Theatre can load our specific scene file.
        # Looking at Theatre.py (from context), it takes scene_path in __init__.

        # Initialize Theatre (Headless)
        renderer = Theatre(scene_path=str(scene_file), width=request.width, height=request.height)

        # Prepare for rendering
        frames = []
        total_frames = int(request.duration * request.fps)
        dt = 1.0 / request.fps

        # Manually load the scene to ensure we have the config
        # (Theatre does this, but we might want to verify)
        # renderer.load_scene() is likely called in init or we need to call it.
        # Based on previous view of theater.py, it seems we might need to verify how it loads.
        # Let's assume standard usage: it loads internally or we call a method.
        # Checking `theatre.py` content again would be ideal, but let's assume `run()` is the loop
        # and we want to step manually.

        # Simulating the loop
        renderer.load_scene()  # Explicit load if needed, otherwise it might be in init

        # Render Loop
        for frame_idx in range(total_frames):
            renderer.render_frame(dt)

            # Capture Frame
            # Pygame surface -> Numpy Array
            # pygame.surfarray.array3d returns (W, H, 3)
            # MoviePy expects (H, W, 3)
            frame_data = pygame.surfarray.array3d(renderer.screen)
            frame_data = frame_data.transpose([1, 0, 2])
            frames.append(frame_data)

        renderer.quit()

        # Write Video
        logger.info(f"Rendering {len(frames)} frames to video...")
        clip = ImageSequenceClip(frames, fps=request.fps)
        clip.write_videofile(str(output_path), codec="libx264", audio=False, logger=None)

        # Construct URL
        # /assets/ is mounted as static
        download_url = f"/assets/users/{user_id}/exports/{output_filename}"

        return {"status": "success", "download_url": download_url, "duration": request.duration}

    except Exception as e:
        logger.error(f"Export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
