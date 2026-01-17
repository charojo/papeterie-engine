import logging
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

from .token_logger import log_response_usage

load_dotenv()

logger = logging.getLogger(__name__)


class GeminiCompilerClient:
    def __init__(self, model_name="gemini-2.5-flash"):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file")

        # Initialize client with explicit v1beta version if needed
        self.client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(api_version="v1beta")
        )
        self.model_name = model_name

    def generate_metadata(self, system_instruction: str, user_prompt: str) -> str:
        """Generates structured metadata using JSON mode."""
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[user_prompt],
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
            },
        )

        if not response.text:
            raise ValueError("Gemini returned an empty response. Check API usage limits.")

        # Log usage to ledger
        log_response_usage(response, self.model_name, "compiler_metadata_generation")

        return response.text

    def generate_text(self, system_instruction: str, user_prompt: str) -> str:
        """Generates free-form text response (without JSON enforcement)."""
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[user_prompt],
            config={
                "system_instruction": system_instruction,
            },
        )

        if not response.text:
            raise ValueError("Gemini returned an empty response.")

        log_response_usage(response, self.model_name, "generate_text")

        return response.text

    def generate_image(self, prompt: str) -> bytes:
        """
        Generates an image from a text prompt using Gemini 3 Pro.
        """
        model_name = "gemini-3-pro-image-preview"

        try:
            response = self.client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="16:9"),  # Scene appropriate
                ),
            )

            log_response_usage(response, model_name, "generate_image")

            if not response.candidates:
                raise ValueError(f"No candidates returned. Text: {response.text}")

            candidate = response.candidates[0]

            if not candidate.content or not candidate.content.parts:
                raise ValueError("Gemini returned candidate but no content/parts.")

            for part in candidate.content.parts:
                if part.inline_data:
                    return part.inline_data.data

            raise ValueError("No inline_data found in response parts.")

        except Exception as e:
            logger.error(f"Gemini Image Gen Error: {e}")
            raise

    def edit_image(
        self,
        input_image_path: str,
        prompt: str,
        system_instruction: str = None,
        aspect_ratio: str = "1:1",
    ) -> bytes:
        """
        Refines a sprite using Gemini 3 Pro Image (Preview).
        aspect_ratio: "1:1" for sprites (default), "16:9" for scenes.
        """
        try:
            from PIL import Image

            img = Image.open(input_image_path)

            # Using Gemini 3 Pro Image Preview as requested
            model_name = "gemini-3-pro-image-preview"

            final_prompt = prompt
            if system_instruction:
                final_prompt = f"{system_instruction}\n\nTask: {prompt}"

            # Contents: [Text, Image]
            contents = [final_prompt, img]

            response = self.client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
                ),
            )

            log_response_usage(response, model_name, "edit_image")

            # Extract Image from response
            if not response.candidates:
                raise ValueError(f"No candidates returned. Text: {response.text}")

            candidate = response.candidates[0]

            # Defensive checks for structure
            if not candidate.content or not candidate.content.parts:
                raise ValueError(
                    f"Gemini returned candidate but no content/parts. "
                    f"Finish reason: {candidate.finish_reason}"
                )

            # Check for inline_data (image)
            image_data = None
            text_explanation = []

            for part in candidate.content.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    image_data = part.inline_data.data
                elif hasattr(part, "text") and part.text:
                    text_explanation.append(part.text)

            if image_data:
                return image_data

            # If no image found, return the text explanation as the error
            full_explanation = "\n".join(text_explanation)
            raise ValueError(
                f"Model returned text instead of image (Refusal?). Explanation: {full_explanation}"
            )

        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            raise

    def decompose_scene(self, scene_image_path: str, system_instruction: str) -> str:
        """
        Analyzes a scene image to identify sprites and background (JSON output).
        Uses Gemini 2.5 Flash (multimodal) or Gemini 3 Pro (if preferred).
        """
        try:
            from PIL import Image

            img = Image.open(scene_image_path)

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=["Analyze this scene.", img],
                config={
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json",
                },
            )

            log_response_usage(response, self.model_name, "decompose_scene")

            return response.text
        except Exception as e:
            logger.error(f"Decomposition Error: {e}")
            raise

    def extract_element_image(
        self,
        scene_image_path: str,
        prompt: str,
        system_instruction: str,
        aspect_ratio: str = "16:9",
    ) -> bytes:
        """
        Extracts a specific element (background or sprite) using Gemini 3 Pro Image.
        Reuse edit_image logic but with specific prompts.
        Default to 16:9 for scene extraction.
        """
        return self.edit_image(
            scene_image_path, prompt, system_instruction, aspect_ratio=aspect_ratio
        )

    def descriptive_scene_analysis(self, scene_image_path: str, system_instruction: str) -> str:
        """
        Stage 1: Analyzes a scene image to produce a descriptive YAML/Text output.
        Returns the raw text description.
        """
        try:
            from PIL import Image

            img = Image.open(scene_image_path)

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=["Analyze this scene.", img],
                config={
                    "system_instruction": system_instruction,
                },
            )

            log_response_usage(response, self.model_name, "descriptive_scene_analysis")

            return response.text
        except Exception as e:
            logger.error(f"Descriptive Analysis Error: {e}")
            raise

    def structure_behaviors(self, description_text: str, system_instruction: str) -> str:
        """
        Stage 2: Converts a descriptive text into structured Behavior JSON.
        """
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[description_text],
                config={
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json",
                },
            )

            log_response_usage(response, self.model_name, "structure_behaviors")

            return response.text
        except Exception as e:
            logger.error(f"Structuring Error: {e}")
            raise
