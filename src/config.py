## @DOC
# ### Central Configuration
# This module defines global paths, asset directories, and server settings
# used across the Papeterie Engine. It ensures all components use consistent
# storage locations and network configurations.
import os
from pathlib import Path
from typing import List

# Base Paths
PROJECT_ROOT = Path(__file__).parent.parent
LOGS_DIR = PROJECT_ROOT / "logs"
env_assets = os.environ.get("PAPETERIE_ASSETS_DIR")
if env_assets:
    ASSETS_DIR = Path(env_assets)
else:
    ASSETS_DIR = PROJECT_ROOT / "assets"

# Asset Directories
SPRITES_DIR = ASSETS_DIR / "users" / "default" / "sprites"
SCENES_DIR = ASSETS_DIR / "users" / "default" / "scenes"
PROMPTS_DIR = ASSETS_DIR / "prompts"

# Ensure directories exist
LOGS_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)
SPRITES_DIR.mkdir(parents=True, exist_ok=True)
SCENES_DIR.mkdir(parents=True, exist_ok=True)
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

# Server Configuration
CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Storage & Auth Configuration
STORAGE_MODE = "LOCAL"  # Options: LOCAL, CLOUD (S3/GCS simulation)
STORAGE_ROOT = ASSETS_DIR / "users"
AUTH_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "dev-insecure-secret-key-change-me")
if AUTH_SECRET_KEY.startswith("dev-"):
    print("WARNING: Using insecure default AUTH_SECRET_KEY. Set AUTH_SECRET_KEY in production.")
