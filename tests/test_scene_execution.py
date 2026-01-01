import os
from pathlib import Path

import pytest

from src.renderer.theatre import Theatre

# Set dummy video driver for headless execution
os.environ["SDL_VIDEODRIVER"] = "dummy"


def discover_scenes():
    """Find all scene.json files in assets/scenes."""
    scenes_dir = Path("assets/scenes")
    if not scenes_dir.exists():
        return []

    # We want to test every scene found
    return sorted(list(scenes_dir.rglob("scene.json")))


@pytest.mark.parametrize("scene_path", discover_scenes())
def test_scene_execution_smoke(scene_path):
    """
    Runs each scene for 60 frames to ensure it loads and renders without crashing.
    """
    print(f"\nRunning smoke test for scene: {scene_path}")

    assert scene_path.exists(), f"Scene path {scene_path} does not exist"

    try:
        # Initialize theatre for this scene
        theatre = Theatre(scene_path=str(scene_path), width=800, height=600)

        # Run for 60 frames (approx 1 sec)
        theatre.run(max_frames=60)

    except Exception as e:
        pytest.fail(f"Scene {scene_path} crashed during execution: {e}")
