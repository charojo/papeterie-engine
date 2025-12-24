import json
import os
from pathlib import Path
from typing import Dict, Any
from .models import SpriteMetadata

# In a real setup, you'd use the Google Generative AI SDK here
# For now, we'll build the orchestration logic

class SpriteCompiler:
    def __init__(self, sprite_dir: str = "sprites", prompt_dir: str = "prompts"):
        self.sprite_dir = Path(sprite_dir)
        self.prompt_dir = Path(prompt_dir)
        
    def load_meta_prompt(self, name: str) -> str:
        """Loads the system instruction templates."""
        path = self.prompt_dir / f"{name}.prompt"
        return path.read_text()

from .gemini_client import GeminiCompilerClient
from .models import SpriteMetadata
from pydantic import ValidationError
import json

class SpriteCompiler:
    def __init__(self):
        self.client = GeminiCompilerClient()
        self.prompt_path = Path("prompts")
        self.sprite_dir = Path("sprites")

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
            # This is where we will call MetaFixupPrompt in the next iteration!
            raise e

    def save_metadata(self, sprite_name: str, metadata: SpriteMetadata):
        """Saves the compiled JSON next to the PNG."""
        output_path = self.sprite_dir / sprite_name / f"{sprite_name}.prompt.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w") as f:
            f.write(metadata.model_dump_json(indent=2))
        print(f"SUCCESS: Saved metadata to {output_path}")
