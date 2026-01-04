import os
from unittest.mock import MagicMock, patch

import pytest

from src.compiler.gemini_client import GeminiCompilerClient


@pytest.fixture
def mock_genai_client():
    with patch("src.compiler.gemini_client.genai.Client") as mock:
        yield mock


@pytest.fixture
def gemini_client(mock_genai_client):
    with patch.dict(os.environ, {"GEMINI_API_KEY": "test_key"}):
        return GeminiCompilerClient()


def test_init_missing_api_key():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="GEMINI_API_KEY not found"):
            GeminiCompilerClient()


def test_generate_metadata_success(gemini_client):
    mock_response = MagicMock()
    mock_response.text = '{"key": "value"}'
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    result = gemini_client.generate_metadata("system", "user")
    assert result == '{"key": "value"}'
    gemini_client.client.models.generate_content.assert_called_once()


def test_generate_metadata_empty_response(gemini_client):
    mock_response = MagicMock()
    mock_response.text = ""
    gemini_client.client.models.generate_content.return_value = mock_response

    with pytest.raises(ValueError, match="Gemini returned an empty response"):
        gemini_client.generate_metadata("system", "user")


def test_generate_image_success(gemini_client):
    mock_response = MagicMock()
    mock_part = MagicMock()
    mock_part.inline_data.data = b"image_data"
    mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    result = gemini_client.generate_image("prompt")
    assert result == b"image_data"


def test_generate_image_failure(gemini_client):
    mock_response = MagicMock()
    mock_response.candidates = []
    mock_response.text = "Error message"
    mock_response.usage_metadata = None
    gemini_client.client.models.generate_content.return_value = mock_response

    with pytest.raises(ValueError, match="No candidates returned"):
        gemini_client.generate_image("prompt")


@patch("PIL.Image.open")
def test_edit_image_success(mock_image_open, gemini_client):
    mock_img = MagicMock()
    mock_image_open.return_value = mock_img

    mock_response = MagicMock()
    mock_part = MagicMock()
    mock_part.inline_data = MagicMock(data=b"edited_data")
    mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    result = gemini_client.edit_image("dummy.png", "edit prompt")
    assert result == b"edited_data"


@patch("PIL.Image.open")
def test_edit_image_refusal(mock_image_open, gemini_client):
    mock_img = MagicMock()
    mock_image_open.return_value = mock_img

    mock_response = MagicMock()
    mock_part = MagicMock()
    mock_part.inline_data = None
    mock_part.text = "I cannot do that"
    mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    with pytest.raises(ValueError, match="Model returned text instead of image"):
        gemini_client.edit_image("dummy.png", "edit prompt")


@patch("PIL.Image.open")
def test_edit_image_with_system_instruction(mock_image_open, gemini_client):
    mock_img = MagicMock()
    mock_image_open.return_value = mock_img

    mock_response = MagicMock()
    mock_part = MagicMock()
    mock_part.inline_data = MagicMock(data=b"edited_data")
    mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    result = gemini_client.edit_image("dummy.png", "edit prompt", system_instruction="system")
    assert result == b"edited_data"
    args, kwargs = gemini_client.client.models.generate_content.call_args
    assert kwargs["contents"][0] == "system\n\nTask: edit prompt"


def test_edit_image_no_candidates(gemini_client):
    with patch("PIL.Image.open") as mock_open:
        mock_open.return_value = MagicMock()
        mock_response = MagicMock()
        mock_response.candidates = []
        mock_response.text = "No candidates"
        mock_response.usage_metadata = None
        gemini_client.client.models.generate_content.return_value = mock_response

        with pytest.raises(ValueError, match="No candidates returned"):
            gemini_client.edit_image("dummy.png", "prompt")


def test_edit_image_no_content(gemini_client):
    with patch("PIL.Image.open") as mock_open:
        mock_open.return_value = MagicMock()
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_candidate.content = None
        mock_response.candidates = [mock_candidate]
        mock_response.usage_metadata = None
        gemini_client.client.models.generate_content.return_value = mock_response

        with pytest.raises(ValueError, match="Gemini returned candidate but no content/parts"):
            gemini_client.edit_image("dummy.png", "prompt")


def test_extract_element_image(gemini_client):
    with patch.object(gemini_client, "edit_image") as mock_edit:
        mock_edit.return_value = b"extracted_data"
        result = gemini_client.extract_element_image("scene.png", "prompt", "system")
        assert result == b"extracted_data"
        mock_edit.assert_called_once_with("scene.png", "prompt", "system", aspect_ratio="16:9")


@patch("PIL.Image.open")
def test_decompose_scene_success(mock_image_open, gemini_client):
    mock_img = MagicMock()
    mock_image_open.return_value = mock_img

    mock_response = MagicMock()
    mock_response.text = '{"elements": []}'
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    result = gemini_client.decompose_scene("dummy.png", "instruction")
    assert result == '{"elements": []}'


@patch("PIL.Image.open")
def test_decompose_scene_failure(mock_image_open, gemini_client):
    mock_image_open.side_effect = Exception("File not found")
    with pytest.raises(Exception, match="File not found"):
        gemini_client.decompose_scene("missing.png", "inst")


@patch("PIL.Image.open")
def test_descriptive_scene_analysis_success(mock_image_open, gemini_client):
    mock_img = MagicMock()
    mock_image_open.return_value = mock_img

    mock_response = MagicMock()
    mock_response.text = "Descriptive text"
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    result = gemini_client.descriptive_scene_analysis("dummy.png", "instruction")
    assert result == "Descriptive text"


@patch("PIL.Image.open")
def test_descriptive_scene_analysis_failure(mock_image_open, gemini_client):
    mock_image_open.side_effect = Exception("File not found")
    with pytest.raises(Exception, match="File not found"):
        gemini_client.descriptive_scene_analysis("missing.png", "inst")


def test_structure_behaviors_success(gemini_client):
    mock_response = MagicMock()
    mock_response.text = '{"behaviors": []}'
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    result = gemini_client.structure_behaviors("description", "instruction")
    assert result == '{"behaviors": []}'


def test_structure_behaviors_failure(gemini_client):
    gemini_client.client.models.generate_content.side_effect = Exception("API error")
    with pytest.raises(Exception, match="API error"):
        gemini_client.structure_behaviors("description", "instruction")


def test_generate_image_no_inline_data(gemini_client):
    mock_response = MagicMock()
    mock_part = MagicMock()
    mock_part.inline_data = None
    mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    with pytest.raises(ValueError, match="No inline_data found"):
        gemini_client.generate_image("prompt")


def test_generate_image_no_content(gemini_client):
    mock_response = MagicMock()
    mock_candidate = MagicMock()
    mock_candidate.content = None
    mock_response.candidates = [mock_candidate]
    mock_response.usage_metadata.prompt_token_count = 10
    mock_response.usage_metadata.candidates_token_count = 10
    mock_response.usage_metadata.total_token_count = 20
    gemini_client.client.models.generate_content.return_value = mock_response

    with pytest.raises(ValueError, match="Gemini returned candidate but no content/parts"):
        gemini_client.generate_image("prompt")
