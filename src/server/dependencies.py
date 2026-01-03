from fastapi import Depends, Header, HTTPException, status

from src.config import ASSETS_DIR, STORAGE_MODE
from src.server.logger import AssetLogger

# Singleton instance for use across routers
asset_logger = AssetLogger(ASSETS_DIR)


async def get_current_user(authorization: str = Header(None)):
    """
    Dependency to get the current user ID.
    In LOCAL mode, it always returns 'default'.
    In CLOUD mode, it validates the token.
    """
    if STORAGE_MODE == "LOCAL" and not authorization:
        return "default"

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # In a real app, we'd parse JWT here. For now, we'll treat the token as the user_id
    token = authorization.replace("Bearer ", "")
    return token


def get_user_assets(user_id: str = Depends(get_current_user)):
    """
    Returns (scenes_dir, sprites_dir) for a given user.
    """
    # Everything is now user-scoped under ASSETS_DIR / "users"
    pass

    user_dir = ASSETS_DIR / "users" / user_id
    scenes_dir = user_dir / "scenes"
    sprites_dir = user_dir / "sprites"

    # Ensure they exist
    scenes_dir.mkdir(parents=True, exist_ok=True)
    sprites_dir.mkdir(parents=True, exist_ok=True)

    return scenes_dir, sprites_dir
