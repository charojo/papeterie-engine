import os
import shutil
import tempfile
from pathlib import Path

import pytest

# Top-level environment setup to ensure config is loaded correctly during collection
# This runs before any test modules are imported
worker_id = os.environ.get("PYTEST_XDIST_WORKER", "master")
# Use a unique temp directory for this worker/session
base_temp = Path(tempfile.gettempdir()) / f"papeterie_test_{worker_id}_{os.getpid()}"
base_temp.mkdir(parents=True, exist_ok=True)

assets_dir = base_temp / "assets"
db_path = base_temp / "test.db"

# Set environment variables for config.py and database.py
os.environ["PAPETERIE_ASSETS_DIR"] = str(assets_dir)
os.environ["PAPETERIE_DB_PATH"] = str(db_path)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Setup test assets and database."""
    # We copy the entire assets directory and the current database to replicate the dev environment
    project_root = Path(__file__).parent.parent
    source_assets = project_root / "assets"
    source_db = project_root / "papeterie.db"

    # Copy Assets
    if source_assets.exists():
        if assets_dir.exists():
            shutil.rmtree(assets_dir)
        shutil.copytree(source_assets, assets_dir)
    else:
        # Fallback if no assets (shouldn't happen in this project)
        assets_dir.mkdir(parents=True, exist_ok=True)

    # Copy DB or Init New
    if source_db.exists():
        shutil.copy2(source_db, db_path)
    else:
        # Initialize Database if source doesn't exist
        from src.server.database import init_db

        init_db()

    yield

    # Cleanup
    if base_temp.exists():
        shutil.rmtree(base_temp, ignore_errors=True)
