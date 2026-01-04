import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pygame
import pytest

from src.compiler.models import (
    BackgroundBehavior,
    CoordinateType,
    DriftBehavior,
    LocationBehavior,
    PulseBehavior,
)
from src.renderer.theatre import ParallaxLayer, Theatre


@pytest.fixture
def mock_pygame(mocker):
    mocker.patch("pygame.init")
    mocker.patch("pygame.display.set_mode")
    mocker.patch("pygame.display.get_surface")
    mock_clock = mocker.patch("pygame.time.Clock")
    mock_clock.return_value.tick.return_value = 16
    mocker.patch("pygame.font.SysFont")
    mocker.patch("pygame.font.get_init", return_value=True)
    mocker.patch("pygame.display.quit")
    mocker.patch("pygame.mouse.get_pos", return_value=(10, 10))
    mocker.patch("pygame.display.flip")
    mocker.patch("pygame.display.update")

    # Mock drawing functions to avoid type errors with MagicMock
    mocker.patch("pygame.draw.circle")
    mocker.patch("pygame.draw.rect")
    mocker.patch("pygame.draw.line")

    # Use a real surface for blitting/drawing logic if needed, but mock the heavy parts
    mock_surf = MagicMock(spec=pygame.Surface)
    mock_surf.get_size.return_value = (1280, 720)
    mock_surf.get_width.return_value = 1280
    mock_surf.get_height.return_value = 720
    mock_surf.convert_alpha.return_value = mock_surf
    mock_surf.subsurface.return_value = mock_surf
    mock_surf.get_at.return_value = (255, 0, 0, 255)

    # Mock font render
    mock_font = MagicMock()
    mock_font.render.return_value = mock_surf
    pygame.font.SysFont.return_value = mock_font

    mocker.patch("pygame.image.load", return_value=mock_surf)
    mocker.patch("pygame.transform.smoothscale", return_value=mock_surf)
    mocker.patch("pygame.transform.rotate", return_value=mock_surf)
    mocker.patch("pygame.mask.from_surface")

    pygame.display.get_surface.return_value = mock_surf

    return mock_surf


@pytest.fixture
def dummy_scene_json(tmp_path):
    scene_dir = tmp_path / "scenes" / "test_scene"
    scene_dir.mkdir(parents=True)
    scene_file = scene_dir / "scene.json"

    config = {
        "name": "test_scene",
        "layers": [
            {"sprite_name": "bg", "z_depth": 10},
            {"sprite_name": "boat", "z_depth": 5, "vertical_percent": 0.6},
        ],
    }

    with open(scene_file, "w") as f:
        json.dump(config, f)

    bg_dir = scene_dir / "sprites" / "bg"
    bg_dir.mkdir(parents=True)
    (bg_dir / "bg.png").touch()

    boat_dir = scene_dir / "sprites" / "boat"
    boat_dir.mkdir(parents=True)
    (boat_dir / "boat.png").touch()

    return str(scene_file)


def test_theatre_initialization(mock_pygame, dummy_scene_json):
    theatre = Theatre(scene_path=dummy_scene_json)
    assert len(theatre.layers) == 2
    assert theatre.scene_path == Path(dummy_scene_json)


def test_theatre_run_max_frames(mock_pygame, dummy_scene_json):
    theatre = Theatre(scene_path=dummy_scene_json)
    theatre.screen = mock_pygame
    with patch("pygame.event.get", return_value=[]):
        theatre.run(max_frames=1)
    assert theatre._frame_counter == 1


def test_parallax_layer_behaviors(mock_pygame, tmp_path):
    img_path = tmp_path / "dummy.png"
    img_path.touch()

    drift = DriftBehavior(coordinate=CoordinateType.X, velocity=10.0)
    pulse = PulseBehavior(frequency=1.0, min_value=0.5, max_value=1.0)
    bg_beh = BackgroundBehavior(scroll_speed=0.5)
    loc = LocationBehavior(x=100, y=200, scale=1.5)

    layer = ParallaxLayer(str(img_path), z_depth=1, behaviors=[drift, pulse, bg_beh, loc])

    assert layer.is_background is True
    assert layer.scroll_speed == 0.5
    assert len(layer.behavior_runtimes) == 4


def test_parallax_layer_fill_down(mock_pygame, tmp_path):
    img_path = tmp_path / "dummy.png"
    img_path.touch()

    layer = ParallaxLayer(str(img_path), z_depth=1, fill_down=True)
    assert layer.fill_color == (255, 0, 0, 255)


def test_theatre_debug_menu_toggle(mock_pygame, dummy_scene_json):
    theatre = Theatre(scene_path=dummy_scene_json)
    theatre.screen = mock_pygame
    theatre.show_debug_menu = False

    mock_event = MagicMock()
    mock_event.type = pygame.KEYDOWN
    mock_event.key = pygame.K_d

    with patch("pygame.event.get", return_value=[mock_event]):
        theatre.run(max_frames=1)

    assert theatre.show_debug_menu is True


def test_theatre_handle_quit(mock_pygame, dummy_scene_json):
    theatre = Theatre(scene_path=dummy_scene_json)
    theatre.screen = mock_pygame
    mock_event = MagicMock()
    mock_event.type = pygame.QUIT

    with patch("pygame.event.get", return_value=[mock_event]):
        with patch("os._exit") as mock_exit:
            theatre.run(max_frames=1)
            mock_exit.assert_called_once_with(0)


def test_parallax_layer_from_sprite_dir(mock_pygame, tmp_path):
    sprite_dir = tmp_path / "test_sprite"
    sprite_dir.mkdir()
    (sprite_dir / "test_sprite.png").touch()

    meta = {"z_depth": 5, "behaviors": [{"type": "drift", "coordinate": "x", "velocity": 5}]}
    with open(sprite_dir / "test_sprite.prompt.json", "w") as f:
        json.dump(meta, f)

    layer = ParallaxLayer.from_sprite_dir(str(sprite_dir))
    assert layer.z_depth == 5
    assert len(layer.behavior_runtimes) == 1


def test_oscillate_runtime_all_coords(mock_pygame):
    from src.compiler.models import OscillateBehavior

    coords = [
        CoordinateType.X,
        CoordinateType.Y,
        CoordinateType.SCALE,
        CoordinateType.ROTATION,
    ]
    for coord in coords:
        b = OscillateBehavior(frequency=1.0, amplitude=10.0, coordinate=coord)
        layer = ParallaxLayer("dummy.png", z_depth=1, behaviors=[b])
        tf = layer.get_transform(720, 0, 0.25, 0.25)
        if coord == CoordinateType.X:
            assert tf["x"] == 10.0
        elif coord == CoordinateType.Y:
            assert tf["y"] == 10.0
        elif coord == CoordinateType.SCALE:
            assert tf["scale"] == 1.1
        elif coord == CoordinateType.ROTATION:
            assert tf["rotation"] == 10.0


def test_drift_runtime_cap(mock_pygame):
    b = DriftBehavior(coordinate=CoordinateType.Y, velocity=1000.0, drift_cap=500.0)
    layer = ParallaxLayer("dummy.png", z_depth=1, behaviors=[b])
    layer.get_transform(720, 0, 1.0, 1.0)
    assert layer.behavior_runtimes[0].current_value == 0


def test_theatre_debug_menu_interaction(mock_pygame, dummy_scene_json):
    theatre = Theatre(scene_path=dummy_scene_json)
    theatre.screen = mock_pygame
    theatre.show_debug_menu = True

    mock_click = MagicMock()
    mock_click.type = pygame.MOUSEBUTTONDOWN
    mock_click.button = 1
    with patch("pygame.mouse.get_pos", return_value=(150, 115)):
        with patch("pygame.event.get", return_value=[mock_click]):
            theatre.run(max_frames=1)

    assert theatre.debug_target_layer_index == 1


def test_parallax_layer_tiling_and_fill(mock_pygame, tmp_path):
    img_path = tmp_path / "tiled.png"
    img_path.touch()
    layer = ParallaxLayer(str(img_path), z_depth=1, tile_horizontal=True, fill_down=True)
    mock_pygame.get_width.return_value = 100
    mock_pygame.get_size.return_value = (100, 100)
    layer.draw(mock_pygame, scroll_x=0, elapsed_time=0, dt=0.016)
    assert mock_pygame.blit.call_count >= 2


def test_pulse_runtime(mock_pygame):
    b = PulseBehavior(frequency=1.0, min_value=0.0, max_value=1.0, waveform="sine")
    layer = ParallaxLayer("dummy.png", z_depth=1, behaviors=[b])

    # t=0.0 -> sin(0)=0 -> value=0.5 -> final_val = 0.5
    tf1 = layer.get_transform(720, 0, 0.0, 0.0)
    assert tf1["opacity"] == 0.5

    # t=0.25 -> cycle=0.25 -> sin(pi/2)=1 -> value=1.0 -> final_val = 1.0
    tf2 = layer.get_transform(720, 0, 0.25, 0.25)
    assert tf2["opacity"] == 1.0

    b_spike = PulseBehavior(frequency=1.0, min_value=0.0, max_value=1.0, waveform="spike")
    layer_spike = ParallaxLayer("dummy.png", z_depth=1, behaviors=[b_spike])
    tf_spike = layer_spike.get_transform(720, 0, 0.1, 0.1)
    assert tf_spike["opacity"] > 0.0


def test_theatre_visibility_toggle(mock_pygame, dummy_scene_json):
    theatre = Theatre(scene_path=dummy_scene_json)
    theatre.screen = mock_pygame
    theatre.show_debug_menu = True

    mock_click = MagicMock()
    mock_click.type = pygame.MOUSEBUTTONDOWN
    mock_click.button = 1
    with patch("pygame.mouse.get_pos", return_value=(310, 90)):
        with patch("pygame.event.get", return_value=[mock_click]):
            theatre.run(max_frames=1)

    assert theatre.layers[0].visible is False


def test_theatre_load_scene_reload(mock_pygame, dummy_scene_json):
    theatre = Theatre(scene_path=dummy_scene_json)
    theatre.screen = mock_pygame
    theatre.last_modified_time = 0

    with patch("pygame.event.get", return_value=[]):
        with patch("os.path.getmtime", return_value=12345):
            theatre.run(max_frames=61)

    assert theatre.last_modified_time == 12345


def test_location_runtime_anchors(mock_pygame):
    for anchor in ["top", "bottom"]:
        loc = LocationBehavior(vertical_percent=0.5)
        layer = ParallaxLayer("dummy.png", z_depth=1, behaviors=[loc], vertical_anchor=anchor)
        layer.original_image_size = (100, 100)
        tf = layer.get_transform(1000, 0, 0.0, 0.0)
        if anchor == "top":
            assert tf["base_y"] == 500  # 1000*0.5
        else:
            assert tf["base_y"] == 400  # 1000*0.5 - 100


def test_parallax_layer_draw_background(mock_pygame):
    layer = ParallaxLayer("dummy.png", z_depth=1, is_background=True)
    layer.image = mock_pygame
    layer.draw(mock_pygame, 0, 0, 0.016)
    assert mock_pygame.blit.called


def test_parallax_layer_get_y_at_x_edge_cases(mock_pygame):
    layer = ParallaxLayer("dummy.png", z_depth=1)
    # image is None
    layer.image = None
    assert layer.get_y_at_x(1000, 0, 10, 0) == 1000

    # original_image_size is (0,0)
    layer.image = mock_pygame
    layer.original_image_size = (0, 0)
    layer.get_y_at_x(1000, 0, 10, 0)
    # Should fallback to mock_pygame.get_width()


def test_oscillate_scale(mock_pygame):
    from src.compiler.models import OscillateBehavior

    b = OscillateBehavior(frequency=1.0, amplitude=10.0, coordinate=CoordinateType.SCALE)
    layer = ParallaxLayer("dummy.png", z_depth=1, behaviors=[b])
    tf = layer.get_transform(720, 0, 0.25, 0.25)
    assert tf["scale"] == 1.1


def test_theatre_load_sprite_community_fallback(mock_pygame, tmp_path):
    scene_dir = tmp_path / "assets" / "users" / "community" / "scenes" / "test"
    scene_dir.mkdir(parents=True)
    scene_file = scene_dir / "scene.json"

    # Community sprite path: scene_dir.parent.parent / "sprites"
    comm_sprite_dir = tmp_path / "assets" / "users" / "community" / "sprites" / "ghost"
    comm_sprite_dir.mkdir(parents=True)
    (comm_sprite_dir / "ghost.png").touch()

    config = {"layers": [{"sprite_name": "ghost"}]}
    with open(scene_file, "w") as f:
        json.dump(config, f)

    theatre = Theatre(scene_path=str(scene_file))
    assert len(theatre.layers) == 1
