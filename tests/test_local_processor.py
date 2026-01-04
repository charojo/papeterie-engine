"""
Tests for LocalImageProcessor - the zero-cost alternative to LLM image extraction.
"""

import io
from unittest.mock import patch

import pytest
from PIL import Image

from src.server.local_processor import LocalImageProcessor


@pytest.fixture
def processor():
    """Create a LocalImageProcessor instance."""
    return LocalImageProcessor()


@pytest.fixture
def sample_image():
    """Create a simple test image with distinct regions."""
    img = Image.new("RGB", (100, 100), (0, 128, 0))  # Green background
    # Add a red "subject" square in the center
    for x in range(30, 70):
        for y in range(30, 70):
            img.putpixel((x, y), (255, 0, 0))
    return img


@pytest.fixture
def sample_rgba_image():
    """Create a test image with transparency."""
    img = Image.new("RGBA", (100, 100), (255, 0, 0, 255))  # Red subject
    # Make corners transparent
    for x in range(20):
        for y in range(20):
            img.putpixel((x, y), (0, 0, 0, 0))
            img.putpixel((99 - x, y), (0, 0, 0, 0))
            img.putpixel((x, 99 - y), (0, 0, 0, 0))
            img.putpixel((99 - x, 99 - y), (0, 0, 0, 0))
    return img


class TestLocalImageProcessor:
    """Tests for the LocalImageProcessor class."""

    def test_initialization(self, processor):
        """Processor initializes with default green color."""
        assert processor.green_color == (0, 255, 0)

    def test_initialization_custom_color(self):
        """Processor accepts custom green color."""
        custom = LocalImageProcessor(green_color=(0, 200, 0))
        assert custom.green_color == (0, 200, 0)

    @patch("src.server.local_processor.remove")
    def test_remove_background(self, mock_remove, processor, sample_image):
        """remove_background returns subject and mask."""
        # Create a mock output with transparent background
        output_img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        for x in range(30, 70):
            for y in range(30, 70):
                output_img.putpixel((x, y), (255, 0, 0, 255))

        buf = io.BytesIO()
        output_img.save(buf, format="PNG")
        mock_remove.return_value = buf.getvalue()

        subject, mask = processor.remove_background(sample_image)

        assert subject.mode == "RGBA"
        assert mask.mode == "L"
        # Since we added auto-crop, the size should now be (40, 40)
        assert subject.size == (40, 40)
        assert mask.size == (40, 40)
        mock_remove.assert_called_once()

    def test_isolate_to_green_screen(self, processor, sample_rgba_image):
        """isolate_to_green_screen composites onto green background."""
        result = processor.isolate_to_green_screen(sample_rgba_image)

        assert result.mode == "RGB"
        assert result.size == sample_rgba_image.size

        # Check that corners (which were transparent) are now green
        assert result.getpixel((5, 5)) == (0, 255, 0)  # Should be green
        # Check that center (which was red) is still red
        assert result.getpixel((50, 50)) == (255, 0, 0)  # Should be red

    def test_isolate_to_green_screen_rgb_input(self, processor):
        """isolate_to_green_screen handles RGB input by converting to RGBA."""
        rgb_img = Image.new("RGB", (50, 50), (255, 0, 0))
        result = processor.isolate_to_green_screen(rgb_img)

        assert result.mode == "RGB"
        # Since there's no transparency, result should be all red
        assert result.getpixel((25, 25)) == (255, 0, 0)

    @patch("cv2.inpaint")
    @patch("cv2.dilate")
    @patch("cv2.cvtColor")
    def test_inpaint_background(self, mock_cvt, mock_dilate, mock_inpaint, processor):
        """inpaint_background uses OpenCV to fill masked regions."""
        import numpy as np

        # Mock the cv2 functions
        test_array = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_cvt.return_value = test_array
        mock_dilate.return_value = np.zeros((100, 100), dtype=np.uint8)
        mock_inpaint.return_value = test_array

        image = Image.new("RGB", (100, 100), (128, 128, 128))
        mask = Image.new("L", (100, 100), 0)

        result = processor.inpaint_background(image, mask)

        assert result.mode == "RGB"
        mock_inpaint.assert_called_once()

    @patch("src.server.local_processor.remove")
    def test_extract_sprite(self, mock_remove, processor, sample_image):
        """extract_sprite returns sprite bytes and mask."""
        # Create expected output
        output_img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        for x in range(30, 70):
            for y in range(30, 70):
                output_img.putpixel((x, y), (255, 0, 0, 255))

        buf = io.BytesIO()
        output_img.save(buf, format="PNG")
        mock_remove.return_value = buf.getvalue()

        sprite_bytes, mask = processor.extract_sprite(sample_image)

        assert isinstance(sprite_bytes, bytes)
        assert len(sprite_bytes) > 0
        assert mask.mode == "L"

        # Verify sprite bytes can be opened as an image
        sprite_img = Image.open(io.BytesIO(sprite_bytes))
        assert sprite_img.mode == "RGB"  # Should be green screen composite

    @patch.object(LocalImageProcessor, "inpaint_background")
    @patch.object(LocalImageProcessor, "remove_background")
    def test_extract_background(self, mock_remove_bg, mock_inpaint, processor, sample_image):
        """extract_background returns inpainted background bytes."""
        mask = Image.new("L", sample_image.size, 0)
        mock_remove_bg.return_value = (sample_image, mask)

        inpainted = Image.new("RGB", sample_image.size, (100, 100, 100))
        mock_inpaint.return_value = inpainted

        result = processor.extract_background(sample_image)

        assert isinstance(result, bytes)
        mock_inpaint.assert_called_once()

    @patch.object(LocalImageProcessor, "inpaint_background")
    def test_extract_background_with_mask(self, mock_inpaint, processor, sample_image):
        """extract_background uses provided mask if given."""
        mask = Image.new("L", sample_image.size, 128)
        inpainted = Image.new("RGB", sample_image.size, (100, 100, 100))
        mock_inpaint.return_value = inpainted

        result = processor.extract_background(sample_image, combined_mask=mask)

        assert isinstance(result, bytes)
        mock_inpaint.assert_called_once_with(sample_image, mask)


class TestLocalProcessorIntegration:
    """Integration tests that exercise the real rembg/opencv where available."""

    @pytest.mark.skip(reason="Requires rembg model download (~200MB)")
    def test_real_background_removal(self, processor, sample_image):
        """Actually run rembg on a test image."""
        subject, mask = processor.remove_background(sample_image)
        assert subject.mode == "RGBA"
        assert mask.mode == "L"
