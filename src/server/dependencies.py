import shutil

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
    user_dir = ASSETS_DIR / "users" / user_id
    scenes_dir = user_dir / "scenes"
    sprites_dir = user_dir / "sprites"

    # Ensure they exist
    scenes_dir.mkdir(parents=True, exist_ok=True)
    sprites_dir.mkdir(parents=True, exist_ok=True)

    return scenes_dir, sprites_dir


def get_user_sounds(user_id: str = Depends(get_current_user)):
    """
    Returns sounds_dir for a given user.
    """
    user_dir = ASSETS_DIR / "users" / user_id
    sounds_dir = user_dir / "sounds"
    sounds_dir.mkdir(parents=True, exist_ok=True)
    return sounds_dir


def seed_user_assets(user_id: str = "default"):
    """
    Seeds a user's asset directories with sample content from the 'community' source.
    This ensures new users (or the default local user) have something to see.
    """
    scenes_dir, sprites_dir = get_user_assets(user_id)
    sounds_dir = get_user_sounds(user_id)
    community_dir = ASSETS_DIR / "users" / "community"

    if not community_dir.exists():
        return

    # Seed Scenes
    comm_scenes = community_dir / "scenes"
    if comm_scenes.exists():
        for scene_folder in comm_scenes.iterdir():
            if scene_folder.is_dir():
                target = scenes_dir / scene_folder.name
                if not target.exists():
                    shutil.copytree(scene_folder, target)
                    asset_logger.log_action(
                        "scenes", scene_folder.name, "SEED", "System seeded sample scene"
                    )

    # Seed Sprites
    comm_sprites = community_dir / "sprites"
    if comm_sprites.exists():
        for sprite_folder in comm_sprites.iterdir():
            if sprite_folder.is_dir():
                target = sprites_dir / sprite_folder.name
                if not target.exists():
                    shutil.copytree(sprite_folder, target)
                    asset_logger.log_action(
                        "sprites", sprite_folder.name, "SEED", "System seeded sample sprite"
                    )

    # Seed Sounds
    comm_sounds = community_dir / "sounds"
    if comm_sounds.exists():
        for sound_file in comm_sounds.iterdir():
            if sound_file.is_file():
                target = sounds_dir / sound_file.name
                if not target.exists():
                    shutil.copy(sound_file, target)
                    asset_logger.log_action(
                        "sounds", sound_file.name, "SEED", "System seeded sample sound"
                    )
