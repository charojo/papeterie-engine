import json
import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.compiler.models import BehaviorConfig
from src.server.dependencies import get_user_assets

router = APIRouter(prefix="/behaviors", tags=["behaviors"])

# Behaviors are currently global for the system, but we can scope them if needed.
BEHAVIOR_DIR = Path("assets/behaviors")
BEHAVIOR_DIR.mkdir(parents=True, exist_ok=True)


class BehaviorPreset(BaseModel):
    name: str
    behavior: BehaviorConfig


@router.get("", response_model=List[BehaviorPreset])
async def list_behaviors(user_assets=Depends(get_user_assets)):
    presets = []
    if not BEHAVIOR_DIR.exists():
        return []

    for f in BEHAVIOR_DIR.glob("*.json"):
        try:
            with open(f, "r") as file:
                data = json.load(file)
                presets.append(BehaviorPreset(name=f.stem, behavior=data))
        except Exception as e:
            print(f"Error loading behavior {f}: {e}")

    return sorted(presets, key=lambda x: x.name)


@router.post("")
async def create_behavior(preset: BehaviorPreset, user_assets=Depends(get_user_assets)):
    # Sanitize name
    safe_name = "".join([c for c in preset.name if c.isalnum() or c in ("-", "_")])
    file_path = BEHAVIOR_DIR / f"{safe_name}.json"

    with open(file_path, "w") as f:
        f.write(preset.behavior.model_dump_json(indent=2))

    return preset


@router.delete("/{name}")
async def delete_behavior(name: str, user_assets=Depends(get_user_assets)):
    safe_name = "".join([c for c in name if c.isalnum() or c in ("-", "_")])
    file_path = BEHAVIOR_DIR / f"{safe_name}.json"

    if file_path.exists():
        os.remove(file_path)
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Behavior not found")
