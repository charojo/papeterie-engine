import pytest
from src.compiler.engine import SpriteCompiler
from src.compiler.models import SpriteMetadata
from unittest.mock import patch, MagicMock
import json

def test_compiler_initialization():
    compiler = SpriteCompiler()
    assert compiler.sprite_dir.exists()


def test_real_compilation():
    compiler = SpriteCompiler()
    meta = compiler.compile_sprite("boat", "A heavy wooden boat rocking slowly.")
    
    assert isinstance(meta, SpriteMetadata)
    assert meta.name == "boat"
    
    # Behavioral assertions
    assert 0.1 <= meta.frequency <= 1.0, f"Frequency {meta.frequency} is not 'slow'"
    assert meta.z_depth > 0
    assert len(meta.rotation_range) == 2

@patch('src.compiler.gemini_client.GeminiCompilerClient.generate_metadata')
def test_fixup_mechanism(mock_generate_metadata):
    # Simulate a malformed initial response (e.g., missing 'frequency')
    malformed_json = json.dumps({
        "amplitude_y": 10,
        "rotation_range": [-10.0, 10.0],
        "z_depth": 5,
        "opacity": 1.0
    }) # Missing 'frequency', 'name' will be added later

    # Simulate a corrected response from the fixup prompt
    corrected_json = json.dumps({
        "frequency": 0.5, # Fixed
        "amplitude_y": 10,
        "rotation_range": [-10.0, 10.0],
        "z_depth": 5,
        "opacity": 1.0,
        "name": "test_sprite" # Ensure name is handled
    })

    mock_generate_metadata.side_effect = [malformed_json, corrected_json]

    compiler = SpriteCompiler()
    sprite_name = "test_sprite"
    user_description = "A simple test sprite."

    meta = compiler.compile_sprite(sprite_name, user_description)

    assert isinstance(meta, SpriteMetadata)
    assert meta.name == sprite_name
    assert meta.frequency == 0.5 # Verify fixup applied
    assert mock_generate_metadata.call_count == 2 # Initial call + fixup call