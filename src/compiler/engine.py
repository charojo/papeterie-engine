import json
import os
from pathlib import Path
from typing import Dict, Any
from .models import SpriteMetadata

# In a real setup, you'd use the Google Generative AI SDK here
# For now, we'll build the orchestration logic

from .gemini_client import GeminiCompilerClient
from .models import SpriteMetadata
from pydantic import ValidationError
import json

class SpriteCompiler:
    def __init__(self):
        self.client = GeminiCompilerClient()
        self.prompt_path = Path("assets/prompts")
        self.sprite_dir = Path("assets/sprites")

    def load_meta_fixup_prompt(self) -> str:
        """Loads the system instruction templates for fixing metadata."""
        path = self.prompt_path / "MetaFixupPrompt.prompt"
        return path.read_text()

    def fixup_metadata(self, raw_json_str: str, error_message: str) -> str:
        fixup_prompt = self.load_meta_fixup_prompt()
        full_prompt = f"""Original JSON (malformed):\n{raw_json_str}\nError: {error_message}\nPlease fix the JSON according to the rules.\n"""
        print("Attempting fixup...")
        return self.client.generate_metadata(fixup_prompt, full_prompt)

    def compile_sprite(self, sprite_name: str, user_description: str) -> SpriteMetadata:
        # 1. Load instructions
        system_meta = (self.prompt_path / "MetaPrompt.prompt").read_text()
        
        # 2. Get LLM response
        raw_json_str = self.client.generate_metadata(system_meta, user_description)
        
        try:
            # 3. Validate against our Pydantic model
            data = json.loads(raw_json_str)
            # Add the name to the data before validation
            data["name"] = sprite_name
            return SpriteMetadata(**data)
            
        except (ValidationError, json.JSONDecodeError) as e:
            print(f"Fixup required for {sprite_name}: {e}")
            # Attempt to fix the malformed JSON
            try:
                fixed_json_str = self.fixup_metadata(raw_json_str, str(e))
                data = json.loads(fixed_json_str)
                data["name"] = sprite_name # Ensure name is present after fixup
                print(f"SUCCESS: Fixup applied for {sprite_name}.")
                return SpriteMetadata(**data)
            except (ValidationError, json.JSONDecodeError) as fixup_e:
                print(f"ERROR: Fixup failed for {sprite_name}: {fixup_e}")
                raise fixup_e # Re-raise if fixup also fails

    def save_metadata(self, sprite_name: str, metadata: SpriteMetadata):
        """Saves the compiled JSON next to the PNG."""
        output_path = self.sprite_dir / sprite_name / f"{sprite_name}.prompt.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w") as f:
            f.write(metadata.model_dump_json(indent=2))
        print(f"SUCCESS: Saved metadata to {output_path}")
