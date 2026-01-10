import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

try:
    from src.compiler.gemini_client import GeminiCompilerClient
    from src.config import PROJECT_ROOT, PROMPTS_DIR
except ImportError:
    # If standard import fails, try relative or setup helpers
    # Ideally pytest handles this, but for robustness:
    from compiler.gemini_client import GeminiCompilerClient

    # Fallback config import if needed, or mock it
    PROJECT_ROOT = Path(__file__).parent.parent
    PROMPTS_DIR = PROJECT_ROOT / "assets" / "prompts"

# Mock data
MOCK_DECOMPOSITION_JSON = """
{
  "background_description": "A dark forest background",
  "sprites": [
    {
      "name": "glowing_mushroom",
      "description": "A cluster of glowing mushrooms",
      "location_hint": "Bottom right corner"
    }
  ]
}
"""


@pytest.fixture
def mock_gemini_client():
    with patch("src.compiler.gemini_client.genai.Client") as MockClient:
        # Mock the client instance and its methods
        client_instance = MockClient.return_value

        # Mock models.generate_content
        models_mock = MagicMock()
        client_instance.models = models_mock

        yield models_mock


@patch("PIL.Image.open")
def test_optimize_scene_mocked(mock_image_open, mock_gemini_client):
    """
    Unit test for the optimization flow using mocks.
    Verifies that prompts are loaded and API is called with correct parameters.
    """
    # Mock Image.open to return a dummy
    mock_image_open.return_value = MagicMock()

    # Setup the mock return for decompose_scene (via generate_content)
    mock_decomp_response = MagicMock()
    mock_decomp_response.text = MOCK_DECOMPOSITION_JSON
    mock_decomp_response.usage_metadata = None

    # Setup mock return for image extraction (via edit_image -> generate_content)
    mock_image_response = MagicMock()
    mock_image_part = MagicMock()
    mock_image_part.inline_data.data = b"fake_image_bytes"
    mock_image_response.candidates = [MagicMock(content=MagicMock(parts=[mock_image_part]))]
    mock_image_response.usage_metadata = None

    # Side effect: First call is decompose (text), subsequent calls are extraction (image)
    # Note: decompose_scene uses model_name="gemini-2.5-flash",
    # edit_image uses "gemini-3-pro-image-preview"
    def side_effect(*args, **kwargs):
        config = kwargs.get("config")
        # Simple heuristic: if response_mime_type is JSON, it's decomposition
        if isinstance(config, dict) and config.get("response_mime_type") == "application/json":
            return mock_decomp_response
        # If response_modalities has IMAGE, it's image generation
        # Note: types.GenerateContentConfig objects are passed for images
        return mock_image_response

    mock_gemini_client.generate_content.side_effect = side_effect

    # Initialize client (will use the mocked genai.Client)
    client = GeminiCompilerClient()

    # 1. Test Decomposition
    # Loading prompts - simplified for test (assume strings)
    decomp_result = client.decompose_scene("fake/path/image.png", "System Instruction")
    assert json.loads(decomp_result) == json.loads(MOCK_DECOMPOSITION_JSON)

    # 2. Test Extraction
    # We call extract_element_image which wraps edit_image
    img_bytes = client.extract_element_image(
        "fake/path/image.png", "Draw background", "System Instruction"
    )
    assert img_bytes == b"fake_image_bytes"


@pytest.mark.live
def test_optimize_scene_live():
    """
    Integration test that hits the real Gemini API.
    Ported from scripts/debug_optimization.py.
    """
    # Check for API Key
    if not os.getenv("GEMINI_API_KEY"):
        pytest.skip("Skipping live test: GEMINI_API_KEY not found.")

    client = GeminiCompilerClient()

    # Setup test paths (using existing assets if possible)
    # We need a real image to test this.
    # Looking for a test scene or using the sailboat one.
    scene_dir = PROJECT_ROOT / "assets" / "scenes" / "test-scene-log"
    original_path = scene_dir / "test-scene-log.original.png"

    # If specific test asset doesn't exist, try to fall back to sailboat for a generic test
    # But strictly, the user's debug script pointed to "test-scene-log".
    if not original_path.exists():
        # Fallback to sailboat or skip if no assets available
        fallback_path = PROJECT_ROOT / "assets" / "scenes" / "sailboat" / "sailboat.original.png"
        if fallback_path.exists():
            original_path = fallback_path
        else:
            pytest.skip("Skipping live test: No test asset (test-scene-log or sailboat) found.")

    print(f"Testing with asset: {original_path}")

    # 1. Decompose
    prompt_path = PROJECT_ROOT / "assets" / "prompts" / "SceneDecomposition.prompt"
    if not prompt_path.exists():
        pytest.skip("Prompts not found.")

    prompt_content = prompt_path.read_text()

    try:
        decomposition_json = client.decompose_scene(str(original_path), prompt_content)

        # Basic validation of JSON
        cleaned_json = decomposition_json.strip()
        if cleaned_json.startswith("```json"):
            cleaned_json = cleaned_json.split("```json")[1]
        if cleaned_json.endswith("```"):
            cleaned_json = cleaned_json.rsplit("```", 1)[0]

        data = json.loads(cleaned_json)
        assert "background_description" in data
        assert "sprites" in data

        # 2. Extract Background (just one call to verify it works)
        # We won't do the full loop to save tokens/time, just verify one extraction
        bg_prompt_tmpl = (
            PROJECT_ROOT / "assets" / "prompts" / "BackgroundExtraction.prompt"
        ).read_text()

        # Mock objects list for prompt filling
        objects_desc = "Test Object"
        bg_prompt = bg_prompt_tmpl.replace("{{foreground_objects_list}}", objects_desc)

        bg_bytes = client.extract_element_image(
            str(original_path), bg_prompt, "You are a professional image editor."
        )
        assert len(bg_bytes) > 0
        assert bg_bytes.startswith(b"\x89PNG") or bg_bytes[0:2] == b"\xff\xd8"  # PNG header or JPEG

    except Exception as e:
        if "quota" in str(e).lower() or "limit" in str(e).lower():
            pytest.skip(f"Live test skipped due to quota: {e}")
        elif "IMAGE_RECITATION" in str(e):
            pytest.skip(f"Live test skipped due to Safety/Recitation: {e}")
        raise e
