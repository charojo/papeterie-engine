import json
from pathlib import Path
from unittest.mock import MagicMock

import pygame
import pytest

from renderer.theatre import Theatre


@pytest.fixture(autouse=True)
def mock_pygame(mocker):
    """Mock pygame to avoid actual display/image loading."""
    pygame.init()
    mocker.patch("pygame.display.set_mode")
    mocker.patch("pygame.display.get_surface")

    mock_surface = MagicMock()
    mock_surface.get_width.return_value = 100
    mock_surface.get_height.return_value = 100
    mock_surface.get_size.return_value = (100, 100)
    mock_surface.convert_alpha.return_value = mock_surface

    mocker.patch("pygame.image.load", return_value=mock_surface)
    mocker.patch("pygame.transform.smoothscale", return_value=mock_surface)
    mocker.patch("pygame.font.SysFont")

    yield
    pygame.quit()


def test_theatre_directory_resolution(tmp_path):
    """Verify that Theatre handles a directory by looking for scene.json."""
    scene_dir = tmp_path / "my_scene"
    scene_dir.mkdir()
    scene_file = scene_dir / "scene.json"
    scene_file.write_text(json.dumps({"layers": []}))

    theatre = Theatre(scene_path=str(scene_dir))
    assert theatre.scene_path == scene_file


def test_sprite_resolution_community(tmp_path, mocker):
    """Verify that sprites are resolved in community/user structure."""
    # Structure:
    # root/
    #   sprites/boat/boat.png
    #   scenes/sailboat/scene.json

    root = tmp_path / "community"
    root.mkdir()

    sprites_dir = root / "sprites"
    sprites_dir.mkdir()
    boat_dir = sprites_dir / "boat"
    boat_dir.mkdir()
    (boat_dir / "boat.png").write_text("fake")
    (boat_dir / "boat.prompt.json").write_text(json.dumps({"z_depth": 1}))

    scenes_dir = root / "scenes"
    scenes_dir.mkdir()
    scene_sailboat_dir = scenes_dir / "sailboat"
    scene_sailboat_dir.mkdir()
    scene_file = scene_sailboat_dir / "scene.json"

    scene_data = {"layers": [{"sprite_name": "boat", "z_depth": 5}]}
    scene_file.write_text(json.dumps(scene_data))

    # Initialize Theatre
    theatre = Theatre(scene_path=str(scene_file))

    assert len(theatre.layers) == 1
    assert "community/sprites/boat/boat.png" in str(theatre.layers[0].asset_path).replace("\\", "/")


def test_sprite_resolution_local(tmp_path):
    """Verify that sprites are resolved locally in the scene directory."""
    scene_dir = tmp_path / "scene"
    scene_dir.mkdir()

    local_sprites = scene_dir / "sprites"
    local_sprites.mkdir()
    comp_dir = local_sprites / "comp"
    comp_dir.mkdir()
    (comp_dir / "comp.png").write_text("fake")

    scene_file = scene_dir / "scene.json"
    scene_data = {"layers": [{"sprite_name": "comp"}]}
    scene_file.write_text(json.dumps(scene_data))

    theatre = Theatre(scene_path=str(scene_file))
    assert len(theatre.layers) == 1
    assert "scene/sprites/comp" in str(theatre.layers[0].asset_path).replace("\\", "/")


def test_sprite_resolution_global(tmp_path, mocker):
    """Verify fallback to global sprite directory."""
    global_dir = tmp_path / "global_sprites"
    global_dir.mkdir()

    sprite_dir = global_dir / "global_sprite"
    sprite_dir.mkdir()
    (sprite_dir / "global_sprite.png").write_text("fake")

    scene_file = tmp_path / "scene.json"
    scene_data = {"layers": [{"sprite_name": "global_sprite"}]}
    scene_file.write_text(json.dumps(scene_data))

    # Patch the global sprite base dir in Theatre
    mocker.patch.object(
        Theatre,
        "__init__",
        side_effect=lambda self, *args, **kwargs: (
            setattr(self, "sprite_base_dir", global_dir),
            setattr(self, "scene_path", Path(args[0])),
            setattr(self, "layers", []),
            setattr(self, "last_modified_time", 0),
            setattr(self, "scroll", 0),
            setattr(self, "elapsed_time", 0.0),
            setattr(self, "debug_target_layer_index", 0),
            setattr(self, "show_debug_menu", False),
            setattr(self, "screen", MagicMock()),
            setattr(self, "font_header", MagicMock()),
            setattr(self, "font_item", MagicMock()),
            setattr(self, "font_small", MagicMock()),
            self.load_scene(),
        )
        if not hasattr(self, "layers")
        else None,
    )

    # Bypassing __init__ to manually set up the Theatre instance with a global sprite directory
    # This allows testing the fallback logic without triggering the full initialization sequence
    theatre = Theatre.__new__(Theatre)
    theatre.scene_path = scene_file
    theatre.sprite_base_dir = global_dir
    theatre.layers = []
    theatre.load_scene()

    assert len(theatre.layers) == 1
    assert "global_sprites/global_sprite" in str(theatre.layers[0].asset_path).replace("\\", "/")
