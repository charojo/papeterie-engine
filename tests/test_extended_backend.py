import io
import json
import shutil
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src.config import SCENES_DIR, SPRITES_DIR
from src.server.main import app

client = TestClient(app)


@pytest.fixture
def clean_assets():
    """Ensures test assets are cleaned up before and after tests."""
    test_scene = SCENES_DIR / "test_scene_upload"
    test_sprite = SPRITES_DIR / "test_sprite_upload"
    test_gen_scene = SCENES_DIR / "test_scene_gen"
    test_optim_scene = SCENES_DIR / "test_scene_optim"

    # Cleanup before
    for path in [test_scene, test_sprite, test_gen_scene, test_optim_scene]:
        if path.exists():
            shutil.rmtree(path)

    yield

    # Cleanup after
    for path in [test_scene, test_sprite, test_gen_scene, test_optim_scene]:
        if path.exists():
            shutil.rmtree(path)


def create_dummy_image():
    """Creates a small dummy PNG image in memory."""
    img = Image.new("RGBA", (100, 100), color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)
    return img_byte_arr


# --- Scene Upload Tests ---


def test_upload_scene_success(clean_assets):
    """Test valid scene upload."""
    img_bytes = create_dummy_image()
    files = {"file": ("scene_art.png", img_bytes, "image/png")}
    data = {"name": "test_scene_upload"}

    response = client.post("/api/scenes/upload", data=data, files=files)
    assert response.status_code == 200
    assert response.json()["name"] == "test_scene_upload"

    scene_dir = SCENES_DIR / "test_scene_upload"
    assert scene_dir.exists()
    assert (scene_dir / "test_scene_upload.original.png").exists()
    assert (scene_dir / "scene.json").exists()


def test_upload_scene_invalid_name(clean_assets):
    """Test upload with empty name."""
    img_bytes = create_dummy_image()
    files = {"file": ("scene_art.png", img_bytes, "image/png")}
    data = {"name": ""}  # Invalid

    response = client.post("/api/scenes/upload", data=data, files=files)
    # Accepts 400 (if safe_name check hits) or 422 (if form validation hits)
    assert response.status_code in [400, 422]


# --- Sprite Upload Tests ---


def test_upload_sprite_raw(clean_assets):
    """Test raw sprite upload."""
    img_bytes = create_dummy_image()
    files = {"file": ("sprite.png", img_bytes, "image/png")}
    data = {"name": "test_sprite_upload"}

    response = client.post("/api/upload", data=data, files=files)
    assert response.status_code == 200

    sprite_dir = SPRITES_DIR / "test_sprite_upload"
    assert sprite_dir.exists()
    assert (sprite_dir / "test_sprite_upload.png").exists()
    # Original should NOT exist for raw upload
    assert not (sprite_dir / "test_sprite_upload.original.png").exists()


@patch("src.server.routers.sprites.img_proc.remove_green_screen")
def test_upload_sprite_remove_bg(mock_remove_bg, clean_assets):
    """Test sprite upload with background removal."""
    # Mock return value to be a valid image
    mock_remove_bg.return_value = Image.new("RGBA", (100, 100), "blue")

    img_bytes = create_dummy_image()
    files = {"file": ("sprite.png", img_bytes, "image/png")}
    data = {"name": "test_sprite_upload", "remove_background": "true"}

    response = client.post("/api/upload", data=data, files=files)
    assert response.status_code == 200

    mock_remove_bg.assert_called_once()
    sprite_dir = SPRITES_DIR / "test_sprite_upload"
    assert (sprite_dir / "test_sprite_upload.original.png").exists()


# --- Sprite Revert Tests ---


def test_revert_sprite_success(clean_assets):
    """Test reverting sprite to original."""
    name = "test_sprite_upload"
    sprite_dir = SPRITES_DIR / name
    sprite_dir.mkdir(parents=True, exist_ok=True)

    # Create fake original and current
    (sprite_dir / f"{name}.original.png").write_bytes(b"original")
    (sprite_dir / f"{name}.png").write_bytes(b"current")

    response = client.post(f"/api/sprites/{name}/revert")
    assert response.status_code == 200

    # Content should match original
    assert (sprite_dir / f"{name}.png").read_bytes() == b"original"


def test_revert_sprite_no_original(clean_assets):
    """Test revert fails if no original exists."""
    name = "test_sprite_upload"
    sprite_dir = SPRITES_DIR / name
    sprite_dir.mkdir(parents=True, exist_ok=True)
    (sprite_dir / f"{name}.png").write_bytes(b"current")

    response = client.post(f"/api/sprites/{name}/revert")
    assert response.status_code == 404


# --- Mocked AI Generation Tests ---


@patch("src.compiler.gemini_client.GeminiCompilerClient.generate_image")
def test_generate_scene_success(mock_gen_image, clean_assets):
    """Test successful AI scene generation."""
    mock_gen_image.return_value = b"fake_image_bytes"

    payload = {"name": "test_scene_gen", "prompt": "A beautiful test scene"}
    response = client.post("/api/scenes/generate", json=payload)

    assert response.status_code == 200
    mock_gen_image.assert_called_once()

    scene_dir = SCENES_DIR / "test_scene_gen"
    assert (scene_dir / "test_scene_gen.original.png").read_bytes() == b"fake_image_bytes"
    assert (scene_dir / "scene.json").exists()


@patch("src.compiler.gemini_client.GeminiCompilerClient.edit_image")
@patch("src.server.routers.sprites.img_proc.image_from_bytes")
@patch("src.server.routers.sprites.img_proc.remove_green_screen")
def test_process_sprite_ai(mock_remove_bg, mock_img_from_bytes, mock_edit_image, clean_assets):
    """Test sprite processing with AI optimization."""
    # Setup mocks
    mock_img_from_bytes.return_value = Image.new("RGBA", (50, 50), "green")
    mock_remove_bg.return_value = Image.new("RGBA", (50, 50), (0, 0, 0, 0))

    # Setup sprite
    name = "test_sprite_upload"
    sprite_dir = SPRITES_DIR / name
    sprite_dir.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGBA", (50, 50), "green")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    valid_png_bytes = img_byte_arr.getvalue()

    (sprite_dir / f"{name}.png").write_bytes(valid_png_bytes)

    # Mocks
    mock_edit_image.return_value = valid_png_bytes  # Return valid PNG bytes
    mock_remove_bg.return_value = img  # Return valid Image object

    payload = {"optimize": True}
    response = client.post(f"/api/sprites/{name}/process", json=payload)

    assert response.status_code == 200
    mock_edit_image.assert_called_once()
    assert (sprite_dir / f"{name}.original.png").exists()  # Backup created


# --- Scene Optimization Tests ---


@patch("src.server.routers.scenes.img_proc.image_from_bytes")
@patch("src.server.routers.scenes.img_proc.remove_green_screen")
@patch("src.server.routers.scenes.GeminiCompilerClient")
def test_optimize_scene_mocked(MockGemini, mock_remove, mock_img_from_bytes, clean_assets):
    """Mock full scene optimization flow."""
    # Setup mocks
    mock_img_from_bytes.return_value = Image.new("RGBA", (10, 10), "green")
    mock_remove.return_value = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    # Setup scene
    name = "test_scene_optim"
    scene_dir = SCENES_DIR / name
    scene_dir.mkdir(parents=True, exist_ok=True)
    (scene_dir / f"{name}.original.png").touch()

    # Mock Client instance
    client_instance = MockGemini.return_value

    # Mock 1: Decompose
    client_instance.decompose_scene.return_value = json.dumps(
        {"sprites": [{"name": "test_obj", "description": "desc", "location_hint": "center"}]}
    )

    # Mock 2: Extract BG & Sprites (return valid PNG bytes)
    img = Image.new("RGBA", (10, 10), "green")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    valid_png_bytes = img_byte_arr.getvalue()

    client_instance.extract_element_image.return_value = valid_png_bytes

    response = client.post(f"/api/scenes/{name}/optimize", json={"prompt_guidance": "Test"})

    assert response.status_code == 200
    data = response.json()
    assert "test_obj" in data["sprites_found"]

    # Verify sprite creation
    sprite_dir = SPRITES_DIR / "test_obj"
    assert sprite_dir.exists()
    assert (sprite_dir / "test_obj.png").exists()

    # Verify scene config updated
    with open(scene_dir / "scene.json") as f:
        config = json.load(f)
        layer_names = [layer["sprite_name"] for layer in config["layers"]]
        assert "test_obj" in layer_names
