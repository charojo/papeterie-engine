from unittest.mock import MagicMock

import pygame
import pytest

from src.compiler.models import BehaviorType, CoordinateType, DriftBehavior
from src.renderer.theatre import ParallaxLayer


@pytest.fixture(autouse=True)
def setup_pygame(mocker):
    pygame.init()
    pygame.display.set_mode((1280, 720))

    # Mock image loading
    mock_surface = MagicMock(spec=pygame.Surface)
    mock_surface.get_width.return_value = 100
    mock_surface.get_height.return_value = 100
    mock_surface.get_size.return_value = (100, 100)
    mock_surface.convert_alpha.return_value = mock_surface
    mocker.patch("pygame.image.load", return_value=mock_surface)

    # Mock smoothscale
    mock_smooth = MagicMock(spec=pygame.Surface)
    mock_smooth.get_width.return_value = 100
    mock_smooth.get_height.return_value = 100
    mock_smooth.get_size.return_value = (100, 100)
    mocker.patch("pygame.transform.smoothscale", return_value=mock_smooth)

    yield
    pygame.quit()


def test_vertical_drift():
    # Create a layer with -50px/sec drift (rising)
    # Using new behavior system
    drift = DriftBehavior(type=BehaviorType.DRIFT, velocity=-50.0, coordinate=CoordinateType.Y)

    layer = ParallaxLayer(
        asset_path="assets/sprites/boat/boat.png",
        z_depth=5,
        vertical_percent=0.5,
        target_height=100,
        behaviors=[drift],
    )

    screen_h = 720
    scroll_x = 0
    elapsed_time = 0.0

    # Initial Y (base state check 0 dt)
    tf0 = layer.get_transform(screen_h, scroll_x, elapsed_time, dt=0.0)
    y0_offset = tf0["y"]
    assert y0_offset == 0.0

    # Simulate 1 second step
    dt = 1.0
    elapsed_time += dt
    tf1 = layer.get_transform(screen_h, scroll_x, elapsed_time, dt=dt)
    y1_offset = tf1["y"]

    # y1 offset should be -50.0
    assert y1_offset == pytest.approx(-50.0)

    # Simulate another 1 second step
    dt = 1.0
    elapsed_time += dt
    tf2 = layer.get_transform(screen_h, scroll_x, elapsed_time, dt=dt)
    y2_offset = tf2["y"]

    # y2 offset should be -100.0 (accumulated)
    assert y2_offset == pytest.approx(-100.0)
