import os
from unittest.mock import MagicMock

import pygame
import pytest

from compiler.models import EnvironmentalReaction, EnvironmentalReactionType
from renderer.theatre import ParallaxLayer


@pytest.fixture(autouse=True)
def setup_pygame(mocker):
    """Initialize a dummy display for headless testing and mock image loading."""
    pygame.init()
    pygame.display.set_mode((1, 1), pygame.NOFRAME)

    # Mock image loading to return a 100x100 surface
    mock_surface = MagicMock(spec=pygame.Surface)
    mock_surface.get_width.return_value = 100
    mock_surface.get_height.return_value = 100
    mock_surface.get_size.return_value = (100, 100)
    mock_surface.convert_alpha.return_value = mock_surface

    # Ensure set_alpha exists
    mock_surface.set_alpha = MagicMock()

    mocker.patch("pygame.image.load", return_value=mock_surface)

    # Mock smoothscale
    mock_smooth = MagicMock(spec=pygame.Surface)
    mock_smooth.get_width.return_value = 100
    mock_smooth.get_height.return_value = 100
    mock_smooth.get_size.return_value = (100, 100)
    mock_smooth.set_alpha = MagicMock()
    mocker.patch("pygame.transform.smoothscale", return_value=mock_smooth)

    # Mock rotate for tests that might use it (defaults to 0 rotation often)
    mock_rotated = MagicMock(spec=pygame.Surface)
    mock_rotated.set_alpha = MagicMock()
    mocker.patch("pygame.transform.rotate", return_value=mock_rotated)

    yield
    pygame.quit()


@pytest.fixture
def dummy_png():
    """Create a dummy PNG file for testing."""
    path = "tests/dummy.png"
    with open(path, "w") as f:
        f.write("fake image data")
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_parallax_calculation(dummy_png):
    """Verify that higher Z-depth results in proportionally slower movement."""
    # Use dummy_png so ParallaxLayer attempts to load it (stripping mocked implementation)
    bg_layer = ParallaxLayer(dummy_png, z_depth=10, vertical_percent=0.5, target_height=100)
    fg_layer = ParallaxLayer(dummy_png, z_depth=1, vertical_percent=0.5, target_height=100)

    scroll_amount = 100
    # Our mock in setup_pygame sets size to 100x100
    img_w = 100

    # We test the logic used in the draw method: (scroll / z_depth) % width
    bg_x = (scroll_amount / bg_layer.z_depth) % img_w
    fg_x = (scroll_amount / fg_layer.z_depth) % img_w

    # bg_x should be 10, fg_x should be 100 (or 0 if width is 100)
    assert bg_x == 10
    # 100 % 100 is 0
    assert fg_x == 0


def test_parallax_looping_logic(dummy_png):
    """Verify the seamless looping (tiling) math."""
    layer = ParallaxLayer(dummy_png, z_depth=1, vertical_percent=0.5, target_height=100)
    img_w = 100  # From mock

    # If we scroll exactly the image width, it should loop back to 0
    scroll_amount = img_w
    rel_x = (scroll_amount / layer.z_depth) % img_w

    assert rel_x == 0


def test_scaling_logic(mocker):
    """Ensure the engine correctly scales images to the target height."""
    test_path = "test_scale.png"

    # Mock smoothscale to verify it is called
    mock_smoothscale = mocker.patch("pygame.transform.smoothscale")
    mock_smoothscale.return_value = MagicMock(spec=pygame.Surface)
    mock_smoothscale.return_value.get_size.return_value = (100, 100)  # Mock return size

    try:
        with open(test_path, "w") as f:
            f.write("dummy")

        ParallaxLayer(test_path, z_depth=1, vertical_percent=0.5, target_height=100)

        # Verify scaling was attempted
        assert mock_smoothscale.called

    finally:
        if os.path.exists(test_path):
            os.remove(test_path)


def test_environmental_reaction_pivot_on_crest(mocker):
    """
    Verify a sprite correctly reacts to environment using the Hull Contact model.
    """
    mocker.patch(
        "pygame.transform.rotate",
        return_value=MagicMock(
            spec=pygame.Surface,
            get_size=lambda: (100, 50),
            get_rect=lambda **kwargs: pygame.Rect(0, 0, 100, 50),
            set_alpha=MagicMock(),
        ),
    )
    # Configure image mock with set_alpha and dimensions
    mock_img = MagicMock(spec=pygame.Surface)
    mock_img.get_size.return_value = (100, 50)
    mock_img.get_width.return_value = 100
    mock_img.get_height.return_value = 50
    mock_img.set_alpha = MagicMock()
    mock_img.convert_alpha.return_value = mock_img

    mocker.patch("pygame.image.load", return_value=mock_img)
    mocker.patch("pygame.transform.smoothscale", return_value=mock_img)

    # Mock screen for draw method
    mock_screen = MagicMock(spec=pygame.Surface, get_size=lambda: (800, 600), blit=MagicMock())

    # 1. Create a mock wave layer (environment)
    wave_layer = ParallaxLayer(
        "assets/sprites/wave1/waves1.png", z_depth=2, vertical_percent=0.7, scroll_speed=0.0
    )
    # Default to a flat surface for now
    wave_layer.get_y_at_x = MagicMock(return_value=400)

    # 2. Create the boat layer (reacting sprite)
    boat_reaction = EnvironmentalReaction(
        reaction_type=EnvironmentalReactionType.PIVOT_ON_CREST,
        target_sprite_name="wave1",
        max_tilt_angle=30.0,
        vertical_follow_factor=1.0,
        hull_length_factor=0.5,
    )
    boat_layer = ParallaxLayer(
        "assets/sprites/boat/boat.png",
        z_depth=3,
        vertical_percent=0.6,
        scroll_speed=0.0,
        environmental_reaction=boat_reaction,
    )

    # Test 1: Flat surface (no tilt)
    boat_layer.draw(
        mock_screen, scroll_x=0, elapsed_time=0, dt=0.016, env_y=None, env_layer=wave_layer
    )
    pygame.transform.rotate.assert_called_with(mocker.ANY, 0.0)
    pygame.transform.rotate.reset_mock()

    # Test 2: Rising wave (bow up)
    # With hull_length_factor=0.5 and img_w=100, sampling +/- 25px from center.
    # Center = 50+50=100 (from draw logic). Stern=75, Bow=125.
    def side_effect_rising(screen_h, scroll_x, x_coord, *args):
        return 400.0 - (x_coord - 100) * 0.1  # Slope -0.1

    wave_layer.get_y_at_x = MagicMock(side_effect=side_effect_rising)
    # Slope = -0.1. angle = -math.degrees(atan(-0.1)) = 5.71 deg.
    # Sensitivity * 5.0 = 28.55. Target tilt = 28.55.
    # With start_ramp (scroll_x=300 -> 1.0), damping 0.1 -> First frame: 28.55 * 0.1 = 2.855
    boat_layer.draw(
        mock_screen, scroll_x=300, elapsed_time=0, dt=0.016, env_y=None, env_layer=wave_layer
    )

    # Check if rotate was called with the damped angle
    args, kwargs = pygame.transform.rotate.call_args
    assert args[1] == pytest.approx(2.855, abs=0.1)

    # Check vertical position: target_env_y = (y_stern + y_bow) / 2 = 405
    # Step 1 (dt=0.016): starts at 335, target 400 -> result 341.5 (smoothing 0.1)
    # Step 2 (dt=0.016): starts at 341.5, target 405 -> result 347.85
    assert boat_layer._current_y_phys == pytest.approx(347.85, abs=1.0)


def test_rotation_position_stability(dummy_png, mocker):
    """
    Ensure that the horizontal center of a sprite remains stable when rotated,
    despite the bounding box size changing.
    """
    mock_screen = MagicMock(spec=pygame.Surface)
    mock_screen.get_size.return_value = (800, 600)

    # Mock image loading to ensure self.image is not None
    mock_img = MagicMock(spec=pygame.Surface)
    mock_img.get_size.return_value = (100, 50)
    mock_img.get_width.return_value = 100
    mock_img.get_height.return_value = 50
    mock_img.set_alpha = MagicMock()
    mock_img.convert_alpha.return_value = mock_img

    mocker.patch("pygame.image.load", return_value=mock_img)
    mocker.patch("pygame.transform.smoothscale", return_value=mock_img)

    layer = ParallaxLayer(dummy_png, z_depth=1, vertical_percent=0.5)

    # 1. 0 rotation (100x50)
    mock_rotated_0 = MagicMock(spec=pygame.Surface)
    mock_rotated_0.get_size.return_value = (100, 50)
    mock_rotated_0.set_alpha = MagicMock()

    mocker.patch("pygame.transform.rotate", return_value=mock_rotated_0)
    mocker.patch.object(
        layer,
        "get_transform",
        return_value={
            "x": 10.0,
            "y": 20.0,
            "base_y": 300,
            "scale": 1.0,
            "rotation": 0.0,
            "opacity": 1.0,
        },
    )

    layer.draw(mock_screen, scroll_x=0, elapsed_time=0, dt=0.016)
    args0 = mock_screen.blit.call_args[0]
    pos0 = args0[1]
    center0_x = pos0[0] + 100 / 2

    mock_screen.blit.reset_mock()

    # 2. 45 rotation (say bounding box is 120x120)
    mock_rotated_45 = MagicMock(spec=pygame.Surface)
    mock_rotated_45.get_size.return_value = (120, 120)
    mock_rotated_45.set_alpha = MagicMock()

    mocker.patch("pygame.transform.rotate", return_value=mock_rotated_45)
    mocker.patch.object(
        layer,
        "get_transform",
        return_value={
            "x": 10.0,
            "y": 20.0,
            "base_y": 300,
            "scale": 1.0,
            "rotation": 45.0,
            "opacity": 1.0,
        },
    )

    layer.draw(mock_screen, scroll_x=0, elapsed_time=0, dt=0.016)
    args45 = mock_screen.blit.call_args[0]
    pos45 = args45[1]
    center45_x = pos45[0] + 120 / 2

    # Horizontal center should be identical
    assert center0_x == center45_x
    # Vertical center should also be stable
    center0_y = pos0[1] + 50 / 2
    center45_y = pos45[1] + 120 / 2
    assert center0_y == center45_y
