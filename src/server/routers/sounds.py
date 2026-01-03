from fastapi import APIRouter, Depends

from src.config import ASSETS_DIR
from src.server.dependencies import get_user_assets

router = APIRouter(prefix="/sounds", tags=["sounds"])

SOUNDS_DIR = ASSETS_DIR / "sounds"


@router.get("")
async def list_sounds(user_assets=Depends(get_user_assets)):
    """List all available sound files."""
    if not SOUNDS_DIR.exists():
        return {"sounds": []}

    sound_extensions = {".mp3", ".wav", ".ogg", ".m4a"}
    sounds = []

    for f in SOUNDS_DIR.iterdir():
        if f.is_file() and f.suffix.lower() in sound_extensions:
            sounds.append({"name": f.stem, "filename": f.name, "path": f"sounds/{f.name}"})

    # Sort by name
    sounds.sort(key=lambda s: s["name"])
    return {"sounds": sounds}
