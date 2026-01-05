import shutil
from fastapi import APIRouter, Depends, File, UploadFile

from src.config import ASSETS_DIR
from src.server.dependencies import get_user_assets

router = APIRouter(prefix="/sounds", tags=["sounds"])

SOUNDS_DIR = ASSETS_DIR / "sounds"


@router.post("/upload")
async def upload_sound(file: UploadFile = File(...), user_assets=Depends(get_user_assets)):
    """Upload a new sound file."""
    if not SOUNDS_DIR.exists():
        SOUNDS_DIR.mkdir(parents=True)

    file_path = SOUNDS_DIR / file.filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"filename": file.filename, "status": "success"}


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
