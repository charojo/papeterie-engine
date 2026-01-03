import shutil

import pytest
from fastapi.testclient import TestClient

from src.config import ASSETS_DIR
from src.server.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_user_assets():
    """Ensure user assets are cleaned up after tests."""
    user_root = ASSETS_DIR / "users"
    # We don't delete everything to avoid wiping 'default' if it's being used by dev,
    # but we should isolate the test users.
    yield
    for user_id in ["test_user_a", "test_user_b"]:
        test_user_dir = user_root / user_id
        if test_user_dir.exists():
            shutil.rmtree(test_user_dir)


def test_user_isolation_basic():
    """
    Verify that assets are scoped to the user_id provided in the dependency.
    Note: Current implementation defaults to 'default'.
    We will mock the dependency or use headers once real auth is in.
    For now, let's verify directory creation.
    """
    # Create a scene for User A
    # Since we haven't implemented real auth extraction yet,
    # we'll need to update get_user_assets to be more dynamic first.
    pass


def test_asset_directory_structure():
    user_id = "test_verification_user"
    user_dir = ASSETS_DIR / "users" / user_id
    scenes_dir = user_dir / "scenes"
    sprites_dir = user_dir / "sprites"

    # Trigger creation via an API call (if we can pass user_id)
    # For now, let's verify our folder logic works
    from src.server.dependencies import get_user_assets

    s_dir, sp_dir = get_user_assets(user_id)

    assert s_dir == scenes_dir
    assert sp_dir == sprites_dir
    assert scenes_dir.exists()
    assert sprites_dir.exists()

    if user_dir.exists():
        shutil.rmtree(user_dir)
