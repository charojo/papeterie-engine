import shutil
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from src.config import ASSETS_DIR, SCENES_DIR, SPRITES_DIR
from src.server.main import app

client = TestClient(app)

# --- System Router Tests ---


def test_system_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_system_config():
    response = client.get("/api/config")
    assert response.status_code == 200
    assert "storage_mode" in response.json()


def test_get_system_prompt():
    response = client.get("/api/system-prompt")
    assert response.status_code == 200
    assert "content" in response.json()


def test_get_logs_invalid_type():
    response = client.get("/api/logs/invalid/some_name")
    assert response.status_code == 400
    assert "Invalid asset type" in response.json()["detail"]


# --- Sprite Router Error Cases ---


def test_get_sprite_not_found():
    response = client.post("/api/sprites/non_existent/rotate", json={"angle": 90})
    assert response.status_code == 404


def test_update_sprite_config_not_found():
    response = client.put("/api/sprites/non_existent/config", json={})
    assert response.status_code == 404


def test_update_sprite_config_invalid_data():
    name = "test_sprite_invalid"
    sprite_dir = SPRITES_DIR / name
    sprite_dir.mkdir(exist_ok=True, parents=True)
    try:
        response = client.put(f"/api/sprites/{name}/config", json={"z_depth": "invalid"})
        assert response.status_code == 400
    finally:
        shutil.rmtree(sprite_dir)


def test_delete_sprite_not_found():
    response = client.delete("/api/sprites/non_existent")
    assert response.status_code == 404


def test_delete_sprite_invalid_mode():
    name = "test_sprite_delete"
    sprite_dir = SPRITES_DIR / name
    sprite_dir.mkdir(exist_ok=True, parents=True)
    try:
        response = client.delete(f"/api/sprites/{name}?mode=invalid")
        assert response.status_code == 400
    finally:
        shutil.rmtree(sprite_dir)


def test_share_sprite_not_found():
    response = client.post("/api/sprites/non_existent_share/share")
    assert response.status_code == 404


# --- Scene Router Error Cases ---


def test_share_scene_not_found():
    response = client.post("/api/scenes/non_existent_share/share")
    assert response.status_code == 404


def test_upload_scene_already_exists():
    name = "test_scene_exists"
    scene_dir = SCENES_DIR / name
    scene_dir.mkdir(exist_ok=True, parents=True)
    try:
        response = client.post(
            "/api/scenes/upload",
            data={"name": name},
            files={"file": ("t.png", b"data", "image/png")},
        )
        assert response.status_code == 400
        assert "Scene already exists" in response.json()["detail"]
    finally:
        shutil.rmtree(scene_dir)


def test_generate_scene_already_exists():
    name = "test_scene_gen_exists"
    scene_dir = SCENES_DIR / name
    scene_dir.mkdir(exist_ok=True, parents=True)
    try:
        response = client.post("/api/scenes/generate", json={"name": name, "prompt": "test"})
        assert response.status_code == 400
    finally:
        shutil.rmtree(scene_dir)


def test_optimize_scene_not_found():
    response = client.post("/api/scenes/non_existent/optimize")
    assert response.status_code == 404


def test_update_scene_config_not_found():
    response = client.put("/api/scenes/non_existent/config", json={})
    assert response.status_code == 404


def test_rotate_scene_not_found():
    response = client.post("/api/scenes/non_existent/rotate", json={"angle": 90})
    assert response.status_code == 404


def test_rotate_scene_no_original():
    name = "test_scene_no_orig"
    scene_dir = SCENES_DIR / name
    scene_dir.mkdir(exist_ok=True, parents=True)
    try:
        response = client.post(f"/api/scenes/{name}/rotate", json={"angle": 90})
        assert response.status_code == 400
        assert "No original image found" in response.json()["detail"]
    finally:
        shutil.rmtree(scene_dir)


def test_delete_scene_invalid_mode():
    name = "test_scene_delete"
    scene_dir = SCENES_DIR / name
    scene_dir.mkdir(exist_ok=True, parents=True)
    try:
        response = client.delete(f"/api/scenes/{name}?mode=invalid")
        assert response.status_code == 400
    finally:
        shutil.rmtree(scene_dir)


def test_share_sprite_success():
    name = "test_sprite_share_success"
    user_sprites = ASSETS_DIR / "users" / "default" / "sprites"
    sprite_dir = user_sprites / name
    sprite_dir.mkdir(exist_ok=True, parents=True)
    (sprite_dir / f"{name}.png").touch()

    comm_dir = ASSETS_DIR / "users" / "community" / "sprites"
    comm_dir.mkdir(exist_ok=True, parents=True)

    try:
        response = client.post(f"/api/sprites/{name}/share")
        assert response.status_code == 200
        assert (comm_dir / name / f"{name}.png").exists()
    finally:
        shutil.rmtree(sprite_dir)
        if (comm_dir / name).exists():
            shutil.rmtree(comm_dir / name)


def test_rotate_sprite_success():
    name = "test_sprite_rotate_success"
    user_sprites = ASSETS_DIR / "users" / "default" / "sprites"
    sprite_dir = user_sprites / name
    sprite_dir.mkdir(exist_ok=True, parents=True)
    img = Image.new("RGBA", (10, 10), "red")
    img.save(sprite_dir / f"{name}.png")
    img.save(sprite_dir / f"{name}.original.png")

    try:
        response = client.post(f"/api/sprites/{name}/rotate", json={"angle": 90})
        assert response.status_code == 200
        rotated = Image.open(sprite_dir / f"{name}.png")
        assert rotated.size == (10, 10)
    finally:
        shutil.rmtree(sprite_dir)


def test_share_scene_success():
    name = "test_scene_share_success"
    user_scenes = ASSETS_DIR / "users" / "default" / "scenes"
    scene_dir = user_scenes / name
    scene_dir.mkdir(exist_ok=True, parents=True)
    (scene_dir / "scene.json").touch()

    comm_dir = ASSETS_DIR / "users" / "community" / "scenes"
    comm_dir.mkdir(exist_ok=True, parents=True)

    try:
        response = client.post(f"/api/scenes/{name}/share")
        assert response.status_code == 200
        assert (comm_dir / name / "scene.json").exists()
    finally:
        shutil.rmtree(scene_dir)
        if (comm_dir / name).exists():
            shutil.rmtree(comm_dir / name)


def test_rotate_scene_success():
    name = "test_scene_rotate_success"
    user_scenes = ASSETS_DIR / "users" / "default" / "scenes"
    scene_dir = user_scenes / name
    scene_dir.mkdir(exist_ok=True, parents=True)
    img = Image.new("RGBA", (10, 10), "blue")
    img.save(scene_dir / f"{name}.original.png")

    try:
        response = client.post(f"/api/scenes/{name}/rotate", json={"angle": 90})
        assert response.status_code == 200
    finally:
        shutil.rmtree(scene_dir)


@patch("src.compiler.engine.SpriteCompiler.compile_sprite")
@patch("src.compiler.engine.SpriteCompiler.save_metadata")
def test_compile_sprite_success(mock_save, mock_compile):
    mock_compile.return_value = {"name": "test", "behaviors": []}
    payload = {"name": "test_compile_success", "prompt": "a test sprite"}
    response = client.post("/api/sprites/compile", json=payload)
    assert response.status_code == 200
    assert response.json()["name"] == "test"
