import shutil

from fastapi import APIRouter, Depends, File, UploadFile

from src.server.dependencies import get_user_sounds

router = APIRouter(prefix="/sounds", tags=["sounds"])


@router.post("/upload")
async def upload_sound(file: UploadFile = File(...), sounds_dir=Depends(get_user_sounds)):
    """Upload a new sound file."""
    # sounds_dir is already ensured to exist by dependency

    file_path = sounds_dir / file.filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"filename": file.filename, "status": "success"}


@router.get("")
async def list_sounds(sounds_dir=Depends(get_user_sounds)):
    """List all available sound files."""
    if not sounds_dir.exists():
        return {"sounds": []}

    sound_extensions = {".mp3", ".wav", ".ogg", ".m4a"}
    sounds = []

    for f in sounds_dir.iterdir():
        if f.is_file() and f.suffix.lower() in sound_extensions:
            # Path needs to be accessible via static mount.
            # Assuming main.py mounts /assets -> ASSETS_DIR
            # User path is assets/users/{user_id}/sounds/{filename}
            # But the backend doesn't know the exact URL structure unless we infer it.
            # However, the frontend usually constructs it or we pass it relative to assets root.
            # sounds_dir is absolute path.
            # simpler: we return just the filename and let frontend construct base + filename?
            # Or construct relative path.
            # sounds_dir parent is user_dir (users/userID).
            # So relative to ASSETS_DIR is users/{userID}/sounds/{filename}.
            # The static mount is usually /assets -> ASSETS_DIR.
            # So URL is /assets/users/{userID}/sounds/{filename}.
            # We need the user_id to construct the URL if we want to be explicit,
            # OR we can assume `get_user_sounds` returns a path we can process.

            # Use relative_to(ASSETS_DIR)
            try:
                rel_path = f.relative_to(
                    sounds_dir.parent.parent.parent
                )  # sounds -> user -> users -> assets
                # Wait, ASSETS_DIR / "users" / user_id / "sounds"
                # sounds_dir.parent = user_id
                # sounds_dir.parent.parent = "users"
                # sounds_dir.parent.parent.parent = ASSETS_DIR

                # Wait, importing ASSETS_DIR to use relative_to
                from src.config import ASSETS_DIR

                rel_path = f.relative_to(ASSETS_DIR)
                web_path = f"/assets/{rel_path}"

                sounds.append({"name": f.stem, "filename": f.name, "path": web_path})
            except Exception:
                # Fallback if logic fails (e.g. testing)
                sounds.append({"name": f.stem, "filename": f.name, "path": f"sounds/{f.name}"})

    # Sort by name
    sounds.sort(key=lambda s: s["name"])
    return {"sounds": sounds}
