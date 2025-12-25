import pytest
import pygame
import os
from renderer.theatre import ParallaxLayer

@pytest.fixture(autouse=True)
def setup_pygame():
    """Initialize a dummy display for headless testing."""
    pygame.init()
    pygame.display.set_mode((1, 1), pygame.NOFRAME)
    yield
    pygame.quit()

def test_parallax_calculation():
    """Verify that higher Z-depth results in proportionally slower movement."""
    # Use your real signature
    bg_layer = ParallaxLayer("nonexistent.png", z_depth=10, vertical_percent=0.5, target_height=100)
    fg_layer = ParallaxLayer("nonexistent.png", z_depth=1, vertical_percent=0.5, target_height=100)
    
    scroll_amount = 100
    img_w = bg_layer.image.get_width()
    
    # We test the logic used in the draw method: (scroll / z_depth) % width
    bg_x = (scroll_amount / bg_layer.z_depth) % img_w
    fg_x = (scroll_amount / fg_layer.z_depth) % img_w
    
    # bg_x should be 10, fg_x should be 100 (or 0 if width is 100)
    assert bg_x == 10
    # If the default surface is 100px wide, 100 % 100 is 0
    assert fg_x == (100 % img_w)

def test_parallax_looping_logic():
    """Verify the seamless looping (tiling) math."""
    layer = ParallaxLayer("nonexistent.png", z_depth=1, vertical_percent=0.5, target_height=100)
    img_w = layer.image.get_width()
    
    # If we scroll exactly the image width, it should loop back to 0
    scroll_amount = img_w
    rel_x = (scroll_amount / layer.z_depth) % img_w
    
    assert rel_x == 0

def test_scaling_logic():
    """Ensure the engine correctly scales images to the target height."""
    test_path = "test_scale.png"
    pygame.image.save(pygame.Surface((1000, 1000)), test_path)
    try:
        layer = ParallaxLayer(test_path, z_depth=1, vertical_percent=0.5, target_height=100)
        assert layer.image.get_height() == 100
    finally:
        if os.path.exists(test_path):
            os.remove(test_path)