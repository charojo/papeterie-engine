"""
Local Image Processor - Zero-cost alternative to LLM-based image extraction.

Uses rembg for background removal and OpenCV for inpainting to create
sprites and backgrounds without API calls.
"""

import io
import logging
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image
from rembg import remove

logger = logging.getLogger("papeterie.local_processor")


class LocalImageProcessor:
    """
    Local alternative to Gemini image extraction.

    Uses rembg (U2-Net) for background removal and OpenCV Telea inpainting
    for background reconstruction.
    """

    def __init__(self, green_color: Tuple[int, int, int] = (0, 255, 0)):
        """
        Initialize the processor.

        Args:
            green_color: RGB tuple for green screen background (default: #00FF00)
        """
        self.green_color = green_color

    def remove_background(
        self, image: Image.Image, crop: bool = True
    ) -> Tuple[Image.Image, Image.Image]:
        """
        Remove background from an image using rembg.

        Args:
            image: PIL Image to process
            crop: Whether to auto-crop the result to the subject's bounding box

        Returns:
            Tuple of (subject with transparency, binary mask)
        """
        logger.info("Removing background with rembg...")

        # Convert to bytes for rembg
        img_bytes = io.BytesIO()
        image.save(img_bytes, format="PNG")
        img_bytes.seek(0)

        # rembg returns image with transparent background
        result_bytes = remove(img_bytes.getvalue())
        subject = Image.open(io.BytesIO(result_bytes)).convert("RGBA")

        # Auto-crop to non-transparent edges
        if crop:
            bbox = subject.getbbox()
            if bbox:
                subject = subject.crop(bbox)
                logger.info(f"Auto-cropped sprite to {bbox}")

        # Create binary mask from alpha channel
        alpha = subject.split()[3]
        mask = alpha.point(lambda x: 255 if x > 128 else 0)

        logger.info("Background removal complete")
        return subject, mask.convert("L")

    def isolate_to_green_screen(self, subject: Image.Image) -> Image.Image:
        """
        Composite a subject with transparency onto a green screen background.

        Args:
            subject: PIL Image with transparency (RGBA)

        Returns:
            Image with subject on #00FF00 green background (RGB)
        """
        if subject.mode != "RGBA":
            subject = subject.convert("RGBA")

        # Create solid green canvas
        green_bg = Image.new("RGBA", subject.size, (*self.green_color, 255))

        # Composite subject onto green
        composite = Image.alpha_composite(green_bg, subject)

        return composite.convert("RGB")

    def inpaint_background(
        self, image: Image.Image, mask: Image.Image, radius: int = 5
    ) -> Image.Image:
        """
        Use OpenCV inpainting to fill masked regions in the image.

        Args:
            image: Original PIL Image
            mask: Binary mask where white (255) indicates regions to fill
            radius: Inpainting radius (larger = smoother but slower)

        Returns:
            Inpainted PIL Image
        """
        logger.info("Inpainting background...")

        # Ensure mask and image sizes match
        if image.size != mask.size:
            logger.warning(
                f"Image size {image.size} != Mask size {mask.size}. Resizing mask to match image."
            )
            mask = mask.resize(image.size, Image.NEAREST)

        # Convert PIL to OpenCV format (BGR)
        img_cv = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)

        # Convert mask to numpy (needs to be uint8)
        mask_np = np.array(mask.convert("L"), dtype=np.uint8)

        # Dilate mask slightly to cover edge artifacts
        kernel = np.ones((5, 5), np.uint8)
        mask_dilated = cv2.dilate(mask_np, kernel, iterations=2)

        # Apply Telea inpainting algorithm
        inpainted = cv2.inpaint(img_cv, mask_dilated, radius, cv2.INPAINT_TELEA)

        # Convert back to PIL (RGB)
        result = Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))

        logger.info("Inpainting complete")
        return result

    def extract_sprite(self, scene_image: Image.Image) -> Tuple[bytes, Image.Image]:
        """
        Extract a sprite from a scene image.

        This performs full background removal using rembg, then composites
        onto a green screen for compatibility with the existing pipeline.

        Args:
            scene_image: The scene or cropped region containing the sprite

        Returns:
            Tuple of (sprite PNG bytes, mask for background inpainting (CROPPED))
        """
        # Remove background (with cropping by default for sprites)
        subject, mask = self.remove_background(scene_image, crop=True)

        # Composite onto green screen
        green_sprite = self.isolate_to_green_screen(subject)

        # Convert to bytes
        buf = io.BytesIO()
        green_sprite.save(buf, format="PNG")

        return buf.getvalue(), mask

    def extract_background(
        self, scene_image: Image.Image, combined_mask: Optional[Image.Image] = None
    ) -> bytes:
        """
        Extract a clean background by removing foreground objects.

        Args:
            scene_image: Original scene image
            combined_mask: Optional pre-computed mask of all foreground objects.
                          If None, will auto-detect using rembg.

        Returns:
            Background PNG bytes
        """
        if combined_mask is None:
            # Auto-detect foreground. MUST NOT CROP, otherwise mask won't match image.
            _, combined_mask = self.remove_background(scene_image, crop=False)

        # Inpaint to fill removed regions
        clean_bg = self.inpaint_background(scene_image, combined_mask)

        # Convert to bytes
        buf = io.BytesIO()
        clean_bg.save(buf, format="PNG")

        return buf.getvalue()

    def process_scene(self, scene_path: str) -> Tuple[bytes, bytes, Image.Image]:
        """
        Full scene processing: extract background and a single foreground mask.

        For scenes with multiple sprites, call remove_background on each
        sprite's approximate bounding region.

        Args:
            scene_path: Path to the scene image

        Returns:
            Tuple of (background bytes, foreground sprite bytes, foreground mask)
        """
        scene = Image.open(scene_path)

        # 1. Get Full Foreground (for background extraction) - No Crop
        full_subject, full_mask = self.remove_background(scene, crop=False)

        # 2. Extract Background using full mask
        bg_bytes = self.extract_background(scene, combined_mask=full_mask)

        # 3. Create Sprite Bytes (Cropped)
        # We assume the sprite is the non-transparent part of full_subject
        bbox = full_subject.getbbox()
        if bbox:
            sprite_subject = full_subject.crop(bbox)
        else:
            sprite_subject = full_subject

        green_sprite = self.isolate_to_green_screen(sprite_subject)

        buf = io.BytesIO()
        green_sprite.save(buf, format="PNG")
        sprite_bytes = buf.getvalue()

        return bg_bytes, sprite_bytes, full_mask
