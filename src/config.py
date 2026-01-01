from pathlib import Path
from typing import List

# Base Paths
PROJECT_ROOT = Path(__file__).parent.parent
LOGS_DIR = PROJECT_ROOT / "logs"
ASSETS_DIR = PROJECT_ROOT / "assets"

# Asset Directories
SPRITES_DIR = ASSETS_DIR / "sprites"
SCENES_DIR = ASSETS_DIR / "scenes"
PROMPTS_DIR = ASSETS_DIR / "prompts"

# Ensure directories exist
LOGS_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True)
SPRITES_DIR.mkdir(exist_ok=True)
SCENES_DIR.mkdir(exist_ok=True)
PROMPTS_DIR.mkdir(exist_ok=True)

# Server Configuration
CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
