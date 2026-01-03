import io
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src.server.dependencies import get_user_assets
from src.server.main import app

client = TestClient(app)


@pytest.fixture
def mock_user_assets_setup():
    import tempfile
    from pathlib import Path

    temp_dir = Path(tempfile.mkdtemp())
    scenes_dir = temp_dir / "scenes"
    sprites_dir = temp_dir / "sprites"
    scenes_dir.mkdir()
    sprites_dir.mkdir()

    def override_get_user_assets():
        return (scenes_dir, sprites_dir)

    app.dependency_overrides[get_user_assets] = override_get_user_assets
    yield scenes_dir, sprites_dir
    app.dependency_overrides.clear()


@pytest.fixture
def valid_png_bytes():
    img = Image.new("RGBA", (10, 10), "green")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    return img_byte_arr.getvalue()


def test_optimize_scene_calls_remove_green_screen(mock_user_assets_setup, valid_png_bytes, mocker):
    scenes_dir, _ = mock_user_assets_setup
    scene_name = "test_scene"
    scene_dir = scenes_dir / scene_name
    scene_dir.mkdir()
    (scene_dir / f"{scene_name}.original.png").write_bytes(b"fake_original")

    # Mock Gemini
    mock_gemini = mocker.patch("src.server.routers.scenes.GeminiCompilerClient")
    mock_instance = mock_gemini.return_value
    mock_instance.decompose_scene.return_value = json.dumps(
        {
            "background_description": "bg",
            "sprites": [{"name": "s1", "description": "d1", "location_hint": "h1"}],
        }
    )
    mock_instance.extract_element_image.return_value = valid_png_bytes

    # Mock Image processing at the source
    mocker.patch(
        "src.server.image_processing.image_from_bytes",
        return_value=Image.new("RGBA", (10, 10), "green"),
    )
    mock_remove = mocker.patch(
        "src.server.image_processing.remove_green_screen",
        return_value=Image.new("RGBA", (10, 10), (0, 0, 0, 0)),
    )

    response = client.post(f"/api/scenes/{scene_name}/optimize")

    assert response.status_code == 200
    assert mock_remove.called


def test_optimize_sprite_calls_remove_green_screen(mock_user_assets_setup, valid_png_bytes, mocker):
    _, sprites_dir = mock_user_assets_setup
    sprite_name = "test_sprite"
    sprite_dir = sprites_dir / sprite_name
    sprite_dir.mkdir()
    (sprite_dir / f"{sprite_name}.png").write_bytes(valid_png_bytes)
    (sprite_dir / f"{sprite_name}.original.png").write_bytes(valid_png_bytes)

    # Mock Gemini (imported inside the function from src.compiler.gemini_client)
    mock_gemini = mocker.patch("src.compiler.gemini_client.GeminiCompilerClient")
    mock_instance = mock_gemini.return_value
    mock_instance.edit_image.return_value = valid_png_bytes

    # Mock Image processing at the source
    mocker.patch(
        "src.server.image_processing.image_from_bytes",
        return_value=Image.new("RGBA", (10, 10), "green"),
    )
    mock_remove = mocker.patch(
        "src.server.image_processing.remove_green_screen",
        return_value=Image.new("RGBA", (10, 10), (0, 0, 0, 0)),
    )

    response = client.post(f"/api/sprites/{sprite_name}/process", json={"optimize": True})

    assert response.status_code == 200
    assert mock_remove.called
