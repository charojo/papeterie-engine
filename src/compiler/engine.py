import json
import logging
from pathlib import Path

from pydantic import ValidationError

from src.config import PROMPTS_DIR, SPRITES_DIR

from .gemini_client import GeminiCompilerClient

# Assuming these are defined in your models.py
from .models import SpriteMetadata

# Set up logging for the engine
logger = logging.getLogger("papeterie.engine")


class SpriteCompiler:
    def __init__(self, sprite_dir: str | Path = SPRITES_DIR, prompt_dir: str | Path = PROMPTS_DIR):
        self.client = GeminiCompilerClient()
        self.sprite_dir = Path(sprite_dir)
        self.prompt_dir = Path(prompt_dir)
        self.max_fixup_attempts = 2

        # Ensure directories exist for resilience (especially on clean pull)
        self.sprite_dir.mkdir(parents=True, exist_ok=True)
        self.prompt_dir.mkdir(parents=True, exist_ok=True)

    def _get_prompt_template(self, template_name: str) -> str:
        """Helper to fetch prompt templates."""
        return (self.prompt_dir / f"{template_name}.prompt").read_text()

    def compile_sprite(
        self, sprite_name: str, user_description: str, two_stage: bool = True
    ) -> SpriteMetadata:
        """Orchestrates the LLM generation and validation of sprite metadata."""

        context_description = user_description

        # Stage 1: Creative Elaboration (Optional but Default)
        if two_stage:
            logger.info(f"Starting Stage 1 (Creative) for {sprite_name}...")
            try:
                creative_prompt = self._get_prompt_template("CreativePrompt")
                # format prompt with variables if needed, though client takes raw checks
                # The template expects {sprite_name} and {user_description}
                # We'll just pass the description and let the system instructions guide it,
                # or better, format the system prompt here if it has placeholders
                # But _get_prompt_template just reads text.

                # Let's simple-format the user input side
                stage1_input = f"Sprite Name: {sprite_name}\nDescription: {user_description}"

                creative_output = self.client.generate_text(creative_prompt, stage1_input)
                logger.info(f"Stage 1 Output: {creative_output[:100]}...")

                # Use the creative output as the input for Stage 2
                context_description = (
                    f"User Request: {user_description}\n\nCreative Direction:\n{creative_output}"
                )
            except Exception as e:
                logger.warning(f"Stage 1 failed ({e}), falling back to direct compilation.")

        # Stage 2: Technical Compilation
        logger.info(f"Starting Stage 2 (Technical) for {sprite_name}...")
        system_meta = self._get_prompt_template("MetaPrompt")
        raw_response = self.client.generate_metadata(system_meta, context_description)

        return self._validate_and_fix(sprite_name, raw_response)

    def _validate_and_fix(self, name: str, raw_json: str, attempt: int = 0) -> SpriteMetadata:
        """Recursive validation layer with automated fixup."""
        try:
            data = json.loads(raw_json)
            data["name"] = name
            return SpriteMetadata(**data)

        except (ValidationError, json.JSONDecodeError) as e:
            if attempt < self.max_fixup_attempts:
                logger.warning(
                    f"Validation failed for {name} (Attempt {attempt + 1}). "
                    f"Triggering fixup. Error: {e}"
                )

                fixup_prompt = self._get_prompt_template("MetaFixupPrompt")
                error_context = f"Original JSON: {raw_json}\nValidation Error: {str(e)}"

                fixed_response = self.client.generate_metadata(fixup_prompt, error_context)
                return self._validate_and_fix(name, fixed_response, attempt + 1)

            logger.error(f"Max fixup attempts reached for {name}. Engine halt.")
            raise

    def save_metadata(self, metadata: SpriteMetadata):
        """Saves compiled JSON using the pathing rules defined in AGENTS.md."""
        output_path = self.sprite_dir / metadata.name / f"{metadata.name}.prompt.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w") as f:
            f.write(metadata.model_dump_json(indent=2))
        logger.info(f"Metadata persisted to {output_path}")
