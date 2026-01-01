import logging

from fastapi import APIRouter, HTTPException

from src.config import PROJECT_ROOT
from src.server.dependencies import asset_logger

logger = logging.getLogger("papeterie")
router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


@router.get("/system-prompt")
async def get_system_prompt():
    prompt_path = PROJECT_ROOT / "assets" / "prompts" / "SpriteOptimization.prompt"
    if prompt_path.exists():
        return {"content": prompt_path.read_text(encoding="utf-8")}
    return {"content": "Optimize this sprite."}


@router.get("/logs/{asset_type}/{name}")
async def get_asset_logs(asset_type: str, name: str):
    if asset_type not in ["sprites", "scenes"]:
        raise HTTPException(status_code=400, detail="Invalid asset type")
    return {"content": asset_logger.get_logs(asset_type, name)}
