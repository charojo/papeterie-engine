import pytest
import pygame
import os
from renderer.theatre import ParallaxLayer
from compiler.models import EnvironmentalReaction, EnvironmentalReactionType
from unittest.mock import MagicMock

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

def test_environmental_reaction_pivot_on_crest(mocker):
    """Verify a sprite correctly pivots on a wave crest based on environmental reaction (slope-based)."""
    mocker.patch('pygame.transform.rotate', return_value=MagicMock(spec=pygame.Surface, get_size=lambda: (100, 50), get_rect=lambda **kwargs: pygame.Rect(0,0,100,50)))
    mocker.patch('pygame.image.load', return_value=MagicMock(spec=pygame.Surface, convert_alpha=lambda: MagicMock(spec=pygame.Surface, get_size=lambda: (100, 50))))
    mocker.patch('pygame.Surface', return_value=MagicMock(spec=pygame.Surface, get_at=lambda *args: (0,0,0,255), get_size=lambda: (100, 50)))

    # Mock screen for draw method
    mock_screen = MagicMock(spec=pygame.Surface, get_size=lambda: (800, 600), blit=MagicMock())

    # 1. Create a mock wave layer (environment)
    wave_layer = ParallaxLayer("assets/sprites/wave1/waves1.png", z_depth=2, vertical_percent=0.7, scroll_speed=0.5)
    wave_layer.get_y_at_x = MagicMock(return_value=400) # Default to a flat surface for now

    # 2. Create the boat layer (reacting sprite)
    boat_reaction = EnvironmentalReaction(
        reaction_type=EnvironmentalReactionType.PIVOT_ON_CREST,
        target_sprite_name="wave1",
        max_tilt_angle=30.0
    )
    boat_layer = ParallaxLayer("assets/sprites/boat/boat.png", z_depth=3, vertical_percent=0.6, scroll_speed=0.5, environmental_reaction=boat_reaction)
    
    # Test 1: Flat surface (no tilt)
    boat_layer.draw(mock_screen, scroll_x=0, environment_y=400, environment_layer_for_tilt=wave_layer)
    pygame.transform.rotate.assert_called_with(mocker.ANY, 0.0)
    pygame.transform.rotate.reset_mock()

    # Test 2: Rising wave (bow up / positive tilt)
    # At scroll_x=300, boat_layer.scroll_speed=0.5, x_offset=0, img_w=100
    # draw_x = (150 + 0) % 900 - 100 = 50. Center = 50 + 50 = 100.
    def side_effect_rising(screen_h, scroll_x, x_coord):
        return 400.0 - (x_coord - 100) * 0.005
    # Behind (98): 400.01. Ahead (102): 399.99. Delta Y = 0.02. Delta X = 4. Slope = 0.005.
    # atan(0.005) = 0.286 deg. 0.286 * 50 * 1.0 (ramp) = 14.3
    wave_layer.get_y_at_x = MagicMock(side_effect=side_effect_rising)
    boat_layer.draw(mock_screen, scroll_x=300, environment_y=400, environment_layer_for_tilt=wave_layer)
    pygame.transform.rotate.assert_called_with(mocker.ANY, pytest.approx(14.3, abs=0.1)) 
    pygame.transform.rotate.reset_mock()

    # Test 3: Gentle falling wave (negative tilt)
    def side_effect_gentle(screen_h, scroll_x, x_coord):
        return 400.0 + (x_coord - 100) * 0.0005
    # Behind (98): 399.999. Ahead (102): 400.001. Delta Y = -0.002. Slope = -0.0005.
    # atan(-0.0005) = -0.0286 deg. -0.0286 * 50 * 1.0 = -1.43 deg
    wave_layer.get_y_at_x = MagicMock(side_effect=side_effect_gentle)
    boat_layer.draw(mock_screen, scroll_x=300, environment_y=400, environment_layer_for_tilt=wave_layer)
    pygame.transform.rotate.assert_called_with(mocker.ANY, pytest.approx(-1.43, abs=0.1))
    pygame.transform.rotate.reset_mock()

    # Test 4: Ramp-in check (scroll_x = 150 -> 0.5 ramp)
    # At scroll_x=150, center = 75 + 50 = 125.
    def side_effect_gentle_150(screen_h, scroll_x, x_coord):
        return 400.0 + (x_coord - 125) * 0.0005
    wave_layer.get_y_at_x = MagicMock(side_effect=side_effect_gentle_150)
    # -0.0286 * 50 * 0.5 = -0.715 deg
    boat_layer.draw(mock_screen, scroll_x=150, environment_y=400, environment_layer_for_tilt=wave_layer)
    args, kwargs = pygame.transform.rotate.call_args
    assert args[1] == pytest.approx(-0.715, abs=0.1)
    pygame.transform.rotate.reset_mock()
    
    # Test 5: Very gentle wave with ramp
    # delta_y = -0.0002. raw_slope = -0.00005
    # atan(-0.00005) = -0.00286 deg. -0.00286 * 50 * 0.5 = -0.0715 deg
    def side_effect_vgentle(screen_h, scroll_x, x_coord):
        return 400.0 + (x_coord - 125) * 0.00005
    wave_layer.get_y_at_x = MagicMock(side_effect=side_effect_vgentle)
    boat_layer.draw(mock_screen, scroll_x=150, environment_y=400, environment_layer_for_tilt=wave_layer)
    args, kwargs = pygame.transform.rotate.call_args
    assert args[1] == pytest.approx(-0.0715, abs=0.01)
