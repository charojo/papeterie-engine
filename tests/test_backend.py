import json
import shutil

import pytest
from fastapi.testclient import TestClient

from src.config import SCENES_DIR, SPRITES_DIR
from src.server.main import app

client = TestClient(app)


@pytest.fixture
def setup_test_assets():
    """Creates temporary assets for testing deletion."""
    # Create test scenes
    scene_a = SCENES_DIR / "test_scene_A"
    scene_b = SCENES_DIR / "test_scene_B"
    scene_a.mkdir(exist_ok=True)
    scene_b.mkdir(exist_ok=True)

    (scene_a / "test_scene_A.original.png").touch()
    (scene_b / "test_scene_B.original.png").touch()

    # Create test sprites
    sprite_shared = SPRITES_DIR / "sprite_shared"
    sprite_unique = SPRITES_DIR / "sprite_unique"
    sprite_shared.mkdir(exist_ok=True)
    sprite_unique.mkdir(exist_ok=True)

    # Configs
    config_a = {
        "name": "test_scene_A",
        "layers": [{"sprite_name": "sprite_shared"}, {"sprite_name": "sprite_unique"}],
    }
    with open(scene_a / "scene.json", "w") as f:
        json.dump(config_a, f)

    config_b = {"name": "test_scene_B", "layers": [{"sprite_name": "sprite_shared"}]}
    with open(scene_b / "scene.json", "w") as f:
        json.dump(config_b, f)

    yield

    # Cleanup
    if scene_a.exists():
        shutil.rmtree(scene_a)
    if scene_b.exists():
        shutil.rmtree(scene_b)
    if sprite_shared.exists():
        shutil.rmtree(sprite_shared)
    if sprite_unique.exists():
        shutil.rmtree(sprite_unique)


def test_delete_scene_safe_shared(setup_test_assets):
    """
    Test deleting Scene A with 'delete_all'.
    Expectation:
    - Scene A deleted.
    - sprite_unique deleted.
    - sprite_shared PRESERVED (used by Scene B).
    """
    response = client.delete("/api/scenes/test_scene_A?mode=delete_all")
    assert response.status_code == 200
    data = response.json()

    assert "sprite_shared" in data["kept_sprites"]
    assert "sprite_unique" in data["deleted_sprites"]

    assert not (SCENES_DIR / "test_scene_A").exists()
    assert (SCENES_DIR / "test_scene_B").exists()
    assert (SPRITES_DIR / "sprite_shared").exists()
    assert not (SPRITES_DIR / "sprite_unique").exists()


def test_delete_scene_only(setup_test_assets):
    """Test delete_scene mode."""
    # Re-create scene A specifically for this test if needed, or rely on fixture reset
    # Note: Fixture runs yield once per test function if scope is function (default)

    response = client.delete("/api/scenes/test_scene_A?mode=delete_scene")
    assert response.status_code == 200

    assert not (SCENES_DIR / "test_scene_A").exists()
    assert (SPRITES_DIR / "sprite_shared").exists()
    assert (SPRITES_DIR / "sprite_unique").exists()


def test_reset_scene(setup_test_assets):
    response = client.delete("/api/scenes/test_scene_A?mode=reset")
    assert response.status_code == 200

    scene_dir = SCENES_DIR / "test_scene_A"
    assert scene_dir.exists()
    assert (scene_dir / "test_scene_A.original.png").exists()
    assert not (scene_dir / "scene.json").exists()


def test_delete_sprite_reset():
    name = "test_sprite_reset"
    d = SPRITES_DIR / name
    d.mkdir(exist_ok=True)
    (d / f"{name}.original.png").touch()
    (d / f"{name}.png").touch()  # Generated

    response = client.delete(f"/api/sprites/{name}?mode=reset")
    assert response.status_code == 200

    assert d.exists()
    assert (d / f"{name}.original.png").exists()
    assert not (d / f"{name}.png").exists()

    shutil.rmtree(d)


def test_list_sprites(setup_test_assets):
    """Test GET /api/sprites endpoint."""
    response = client.get("/api/sprites")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should include our test sprites
    sprite_names = [s["name"] for s in data]
    assert "sprite_shared" in sprite_names
    assert "sprite_unique" in sprite_names


def test_list_scenes(setup_test_assets):
    """Test GET /api/scenes endpoint."""
    response = client.get("/api/scenes")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should include our test scenes
    scene_names = [s["name"] for s in data]
    assert "test_scene_A" in scene_names
    assert "test_scene_B" in scene_names


def test_update_scene_config(setup_test_assets):
    """Test PUT /api/scenes/{name}/config endpoint."""
    new_config = {
        "name": "test_scene_A",
        "layers": [{"sprite_name": "sprite_shared", "z_depth": 5, "x_offset": 0, "y_offset": 0}],
    }
    response = client.put("/api/scenes/test_scene_A/config", json=new_config)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test_scene_A"
    assert "message" in data

    # Verify the config was actually updated
    scene_dir = SCENES_DIR / "test_scene_A"
    config_path = scene_dir / "scene.json"
    with open(config_path, "r") as f:
        saved_config = json.load(f)
    assert saved_config["name"] == "test_scene_A"
    assert len(saved_config["layers"]) == 1


def test_update_sprite_config():
    """Test PUT /api/sprites/{name}/config endpoint."""
    name = "test_sprite_config"
    sprite_dir = SPRITES_DIR / name
    sprite_dir.mkdir(exist_ok=True)
    (sprite_dir / f"{name}.png").touch()

    new_metadata = {
        "name": name,
        "target_height": 500,
        "tile_horizontal": False,
        "z_depth": 5,
        "vertical_percent": 0.5,
        "x_offset": 100,
        "y_offset": 50,
        "behaviors": [],
    }

    response = client.put(f"/api/sprites/{name}/config", json=new_metadata)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == name

    # Verify metadata was saved
    metadata_path = sprite_dir / f"{name}.prompt.json"
    assert metadata_path.exists()
    with open(metadata_path, "r") as f:
        saved_metadata = json.load(f)
    assert saved_metadata["target_height"] == 500
    assert saved_metadata["x_offset"] == 100

    # Cleanup
    shutil.rmtree(sprite_dir)
