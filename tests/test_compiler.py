import json
import os
from unittest.mock import patch

import pytest

from src.compiler.engine import SpriteCompiler
from src.compiler.models import SpriteMetadata


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
        # Just verify it returns valid metadata - behaviors are optional
        assert meta.name == "boat"
    except Exception as e:
        # Catch quota/limit errors specifically
        if "quota" in str(e).lower() or "limit" in str(e).lower():
            pytest.skip(f"CAUTION: Could not test real compilation. Quota exhausted: {e}")
        raise e


@patch("src.compiler.gemini_client.GeminiCompilerClient.generate_metadata")
def test_fixup_mechanism(mock_generate_metadata):
    """
    This test verifies the fixup mechanism by providing malformed JSON
    that will trigger a validation error, then a corrected version.
    """
    # Malformed: invalid behavior (missing required fields)
    malformed_json = json.dumps(
        {
            "z_depth": 5,
            "behaviors": [
                # Invalid type to trigger validation error
                {"type": "oscillate", "frequency": "bad_value"}
            ],
        }
    )
    # Corrected: all required fields present
    corrected_json = json.dumps(
        {
            "z_depth": 5,
            "behaviors": [
                {
                    "type": "oscillate",
                    "frequency": 0.5,
                    "amplitude": 10,
                    "coordinate": "y",
                    "phase_offset": 0.0,
                }
            ],
        }
    )

    mock_generate_metadata.side_effect = [malformed_json, corrected_json]

    compiler = SpriteCompiler()
    meta = compiler.compile_sprite("test_sprite", "A simple test sprite.")

    # Verify fixup worked
    assert len(meta.behaviors) == 1
    assert meta.behaviors[0].type == "oscillate"
    assert meta.behaviors[0].frequency == 0.5
    # Verify fixup was called twice (initial + fixup)
    assert mock_generate_metadata.call_count == 2
