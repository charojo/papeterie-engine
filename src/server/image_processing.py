import io
import logging

from PIL import Image

logger = logging.getLogger("papeterie.image_processing")


def image_from_bytes(data: bytes) -> Image.Image:
    """Helper to convert bytes to a PIL Image without requiring io in the caller."""
    return Image.open(io.BytesIO(data))


def bytes_from_image(image: Image.Image, format: str = "PNG") -> bytes:
    """Helper to convert a PIL Image to bytes without requiring io in the caller."""
    buf = io.BytesIO()
    image.save(buf, format=format)
    return buf.getvalue()


def remove_green_screen(image: Image.Image, threshold: int = 50) -> Image.Image:
    """
    Process an image to remove green screen background.
    Assumes image is already in RGBA or RGB mode.
    """
    try:
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        datas = image.getdata()

        newData = []
        for item in datas:
            # item is typically (r, g, b, a) or (r, g, b)
            if len(item) == 4:
                r, g, b, a = item
            else:
                r, g, b = item
                a = 255

            # Green screen logic: Check if green is dominant
            # This is a naive implementation but matches the user's existing script logic
            if g > r + threshold and g > b + threshold:
                newData.append((255, 255, 255, 0))  # Transparent
            else:
                newData.append((r, g, b, a))

        image.putdata(newData)
        return image
    except Exception as e:
        logger.error(f"Error removing green screen: {e}")
        # Return original on error to not break flow, or raise?
        # For now, let's log and re-raise so the caller knows something went wrong.
        raise e


def optimize_image(image: Image.Image, max_size: int = 2048) -> Image.Image:
    """
    Resize image if larger than max_size while maintaining aspect ratio.
    """
    try:
        width, height = image.size
        if width > max_size or height > max_size:
            ratio = min(max_size / width, max_size / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        return image
    except Exception as e:
        logger.error(f"Error optimizing image: {e}")
        raise e
