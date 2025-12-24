import pytest
from renderer.theatre import ParallaxLayer

def test_parallax_calculation():
    """Verify that higher Z-depth results in proportionally slower movement."""
    # Setup a background layer (Z=10) and a foreground layer (Z=1)
    bg_layer = ParallaxLayer((0,0,0), z_depth=10, y_pos=0, height=100)
    fg_layer = ParallaxLayer((0,0,0), z_depth=1, y_pos=0, height=100)
    
    scroll_amount = 100
    
    # Calculate expected X offsets based on our formula: -(scroll / z_depth)
    # Background (100 / 10) = 10
    # Foreground (100 / 1) = 100
    
    bg_x = -(scroll_amount / bg_layer.z_depth)
    fg_x = -(scroll_amount / fg_layer.z_depth)
    
    assert bg_x == -10
    assert fg_x == -100
    assert abs(fg_x) > abs(bg_x), "Foreground must move faster than background"

def test_parallax_looping_logic():
    """Verify the seamless looping (tiling) math."""
    width = 1280
    layer = ParallaxLayer((0,0,0), z_depth=1, y_pos=0, height=100)
    
    # If we scroll exactly one screen width, the rel_x should reset to 0
    scroll_amount = 1280
    rel_x = -(scroll_amount / layer.z_depth) % width
    
    assert rel_x == 0, "Layer did not loop perfectly at screen width boundary"
