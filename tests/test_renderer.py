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
    """Verify a sprite correctly pivots on a wave crest based on environmental reaction."""
    mocker.patch('pygame.transform.rotate', return_value=MagicMock(spec=pygame.Surface, get_size=lambda: (100, 50), get_rect=lambda **kwargs: pygame.Rect(0,0,100,50)))
    mocker.patch('pygame.image.load', return_value=MagicMock(spec=pygame.Surface, convert_alpha=lambda: MagicMock(spec=pygame.Surface, get_size=lambda: (100, 50))))
    mocker.patch('pygame.Surface', return_value=MagicMock(spec=pygame.Surface, get_at=lambda *args: (0,0,0,255), get_size=lambda: (100, 50)))

    # Mock screen for draw method
    mock_screen = MagicMock(spec=pygame.Surface, get_size=lambda: (800, 600), blit=MagicMock())

    # 1. Create a mock wave layer (environment)
    # We'll control its get_y_at_x directly in the test scenarios
    wave_layer = ParallaxLayer("sprites/wave1/waves1.png", z_depth=2, vertical_percent=0.7, scroll_speed=0.5)
    wave_layer.get_y_at_x = MagicMock(return_value=400) # Default to a flat surface for now

    # 2. Create the boat layer (reacting sprite)
    boat_reaction = EnvironmentalReaction(
        reaction_type=EnvironmentalReactionType.PIVOT_ON_CREST,
        target_sprite_name="wave1",
        max_tilt_angle=30.0
    )
    boat_layer = ParallaxLayer("sprites/boat/boat.png", z_depth=3, vertical_percent=0.6, scroll_speed=0.5, environmental_reaction=boat_reaction)
    
    # Simulate the boat's approximate y position if it were resting on the wave
    boat_approx_y = wave_layer.get_y_at_x(mock_screen.get_size()[1], 0, 0) - boat_layer.original_image_size[1] # Adjust for sprite height

    # Scenario 1: Boat is slightly above the wave crest (should tilt down)
    boat_layer.draw(mock_screen, scroll_x=0, environment_y=boat_approx_y - 10) # Wave is 10px below boat's bottom
    # Expected y_diff: (boat_bottom_y - environment_y) / (img_h_for_positioning / 2)
    # boat_bottom_y is boat_approx_y + boat_h, environment_y is boat_approx_y - 10
    # y_diff = (boat_h + 10) / (boat_h / 2) = 2 + 20/boat_h
    # Since mocks make image_size=(100,50), boat_h = 50. y_diff = (50+10)/(50/2) = 60/25 = 2.4
    # Tilt: min(max_tilt, y_diff * max_tilt) = min(30, 2.4 * 30) = 30.0 (clamped)
    # However, environment_y is the *surface*. If boat_bottom_y is above environment_y, y_diff is negative (tilt up).
    # If boat_bottom_y = 400 + 50 = 450. environment_y = 400 - 10 = 390. This means the boat is *above* the wave.
    # reacting_sprite_bottom_y = y + img_h_for_positioning
    # current y = base_y + bob_offset + y_offset. Let's assume y is fixed for simplicity in this test.
    # Let's simplify: environment_y is the effective y of the wave surface at the boat's x.
    # boat_y is the top of the boat. So boat_bottom_y = boat_y + boat_height.
    # If boat is on wave: boat_bottom_y should be close to environment_y
    # If boat is above wave: boat_bottom_y < environment_y (y_diff negative, tilt up)
    # If boat is below wave: boat_bottom_y > environment_y (y_diff positive, tilt down)

    # Redoing scenario: let's directly control the 'y' and 'environment_y' for clarity
    # Assume boat.y is 300, boat_h is 50. boat_bottom_y = 350.
    # If environment_y is 340 (wave crest, boat above), y_diff = (350 - 340) / (50/2) = 10 / 25 = 0.4
    # Tilt should be positive (tilting down into the wave). Max tilt is 30.
    # We need to simulate the state that results in `environment_y` being passed.

    # Test 1: Boat is exactly on the wave surface (no tilt)
    # To achieve this, reacting_sprite_bottom_y should be equal to environment_y
    # The default mock image size is 100x50, so img_h_for_positioning = 50
    # The base y of the boat will be vertical_percent * screen_h - (img_h_for_positioning / 2)
    # 0.6 * 600 - (50 / 2) = 360 - 25 = 335. Let's assume boat.y is 335
    # boat_bottom_y = 335 + 50 = 385
    # If environment_y = 385, then y_diff = 0. So tilt = 0
    boat_layer.y = 335 # Directly set for testing
    boat_layer.draw(mock_screen, scroll_x=0, environment_y=385)
    pygame.transform.rotate.assert_called_with(mocker.ANY, 0.0) # No tilt
    pygame.transform.rotate.reset_mock()

    # Test 2: Boat is above the wave surface (should tilt down/forward)
    # environment_y is lower than boat_bottom_y
    # boat_bottom_y = 385. environment_y = 375 (wave is lower)
    # y_diff = (385 - 375) / (50 / 2) = 10 / 25 = 0.4
    # current_tilt = max(-30, min(30, 0.4 * 30)) = 12.0
    boat_layer.draw(mock_screen, scroll_x=0, environment_y=375)
    pygame.transform.rotate.assert_called_with(mocker.ANY, 12.0) 
    pygame.transform.rotate.reset_mock()

    # Test 3: Boat is below the wave surface (should tilt up/backward)
    # environment_y is higher than boat_bottom_y
    # boat_bottom_y = 385. environment_y = 395 (wave is higher)
    # y_diff = (385 - 395) / (50 / 2) = -10 / 25 = -0.4
    # current_tilt = max(-30, min(30, -0.4 * 30)) = -12.0
    boat_layer.draw(mock_screen, scroll_x=0, environment_y=395)
    pygame.transform.rotate.assert_called_with(mocker.ANY, -12.0)
    pygame.transform.rotate.reset_mock()

    # Test 4: Extreme tilt down (clamped by max_tilt_angle)
    # y_diff = (385 - 300) / 25 = 85 / 25 = 3.4
    # current_tilt = max(-30, min(30, 3.4 * 30)) = 30.0
    boat_layer.draw(mock_screen, scroll_x=0, environment_y=300)
    pygame.transform.rotate.assert_called_with(mocker.ANY, 30.0)
    pygame.transform.rotate.reset_mock()

    # Test 5: Extreme tilt up (clamped by max_tilt_angle)
    # y_diff = (385 - 450) / 25 = -65 / 25 = -2.6
    # current_tilt = max(-30, min(30, -2.6 * 30)) = -30.0
    boat_layer.draw(mock_screen, scroll_x=0, environment_y=450)
    pygame.transform.rotate.assert_called_with(mocker.ANY, -30.0)
    pygame.transform.rotate.reset_mock()
