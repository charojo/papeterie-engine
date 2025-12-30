import logging
import json
from pathlib import Path
from typing import Optional
from pydantic import ValidationError

# Assuming these are defined in your models.py
from .models import SpriteMetadata
from .gemini_client import GeminiCompilerClient

# Set up logging for the engine
logger = logging.getLogger("papeterie.engine")

class SpriteCompiler:
    def __init__(self, sprite_dir: str = "assets/sprites", prompt_dir: str = "assets/prompts"):
        self.client = GeminiCompilerClient()
        self.sprite_dir = Path(sprite_dir)
        self.prompt_dir = Path(prompt_dir)
        self.max_fixup_attempts = 2

    def _get_prompt_template(self, template_name: str) -> str:
        """Helper to fetch prompt templates."""
        return (self.prompt_dir / f"{template_name}.prompt").read_text()

    def compile_sprite(self, sprite_name: str, user_description: str) -> SpriteMetadata:
        """Orchestrates the LLM generation and validation of sprite metadata."""
        system_meta = self._get_prompt_template("MetaPrompt")
        
        raw_response = self.client.generate_metadata(system_meta, user_description)
        
        return self._validate_and_fix(sprite_name, raw_response)

    def _validate_and_fix(self, name: str, raw_json: str, attempt: int = 0) -> SpriteMetadata:
        """Recursive validation layer with automated fixup."""
        try:
            data = json.loads(raw_json)
            data["name"] = name
            return SpriteMetadata(**data)
            
        except (ValidationError, json.JSONDecodeError) as e:
            if attempt < self.max_fixup_attempts:
                logger.warning(f"Validation failed for {name} (Attempt {attempt + 1}). Triggering fixup. Error: {e}")
                
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