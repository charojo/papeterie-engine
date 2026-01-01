import pygame
import pytest

from src.renderer.theatre import ParallaxLayer


@pytest.fixture(autouse=True)
def setup_pygame():
    pygame.init()
    pygame.display.set_mode((1280, 720))
    yield
    pygame.quit()


def test_vertical_drift():
    # Create a layer with -50px/sec drift (rising)
    layer = ParallaxLayer(
        asset_path="assets/sprites/boat/boat.png",
        z_depth=5,
        vertical_percent=0.5,
        vertical_drift=-50.0,
    )

    screen_h = 720
    scroll_x = 0

    # Initial Y (at 0.5 vertical percent, center anchor)
    # img_h = 1694140? No, that's boat.png size.
    # Let's just check the delta.

    y0 = layer.get_current_y(screen_h, scroll_x, elapsed_time=0.0)
    y1 = layer.get_current_y(screen_h, scroll_x, elapsed_time=1.0)
    y2 = layer.get_current_y(screen_h, scroll_x, elapsed_time=2.0)

    # y1 should be y0 - 50
    assert y1 == pytest.approx(y0 - 50.0)
    # y2 should be y0 - 100
    assert y2 == pytest.approx(y0 - 100.0)

    print(f"Drift test passed: y0={y0}, y1={y1}, y2={y2}")


if __name__ == "__main__":
    test_vertical_drift()
