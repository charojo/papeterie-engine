import pytest
import os
import json
from src.compiler.engine import SpriteCompiler
from src.compiler.models import SpriteMetadata
from unittest.mock import patch

def test_compiler_initialization():
    compiler = SpriteCompiler()
    assert compiler.sprite_dir.exists()


# Custom marker for LLM-based tests
# Run these specifically with: pytest -m "live"
@pytest.mark.live
def test_real_compilation():
    compiler = SpriteCompiler()
    
    # Check for API Key or a specific toggle variable
    if not os.getenv("GEMINI_API_KEY") or os.getenv("SKIP_LIVE_TESTS"):
        pytest.skip("CAUTION: Skipping live test to preserve quota or API key missing.")

    try:
        meta = compiler.compile_sprite("boat", "A heavy wooden boat rocking slowly.")
        assert isinstance(meta, SpriteMetadata)
        assert 0.1 <= meta.frequency <= 1.0
    except Exception as e:
        # Catch quota/limit errors specifically
        if "quota" in str(e).lower() or "limit" in str(e).lower():
            pytest.skip(f"CAUTION: Could not test real compilation. Quota exhausted: {e}")
        raise e

@patch('src.compiler.gemini_client.GeminiCompilerClient.generate_metadata')
def test_fixup_mechanism(mock_generate_metadata):
    """
    This test is 'efficient' because it uses mocks.
    It tests the logic of your engine WITHOUT consuming tokens.
    """
    malformed_json = json.dumps({"amplitude_y": 10, "z_depth": 5})
    corrected_json = json.dumps({"frequency": 0.5, "amplitude_y": 10, "z_depth": 5})

    mock_generate_metadata.side_effect = [malformed_json, corrected_json]

    compiler = SpriteCompiler()
    meta = compiler.compile_sprite("test_sprite", "A simple test sprite.")

    assert meta.frequency == 0.5
    assert mock_generate_metadata.call_count == 2