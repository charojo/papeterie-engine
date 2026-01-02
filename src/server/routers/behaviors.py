import json
import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.compiler.models import BehaviorConfig

router = APIRouter(prefix="/behaviors", tags=["behaviors"])

BEHAVIOR_DIR = Path("assets/behaviors")
BEHAVIOR_DIR.mkdir(parents=True, exist_ok=True)


class BehaviorPreset(BaseModel):
    name: str
    behavior: BehaviorConfig


@router.get("", response_model=List[BehaviorPreset])
async def list_behaviors():
    presets = []
    if not BEHAVIOR_DIR.exists():
        return []

    for f in BEHAVIOR_DIR.glob("*.json"):
        try:
            with open(f, "r") as file:
                data = json.load(file)
                # Ensure it matches schema? Or just raw dict?
                # Ideally we validate.
                presets.append(BehaviorPreset(name=f.stem, behavior=data))
        except Exception as e:
            print(f"Error loading behavior {f}: {e}")

    return sorted(presets, key=lambda x: x.name)


@router.post("")
async def create_behavior(preset: BehaviorPreset):
    # Sanitize name
    safe_name = "".join([c for c in preset.name if c.isalnum() or c in ("-", "_")])
    file_path = BEHAVIOR_DIR / f"{safe_name}.json"

    with open(file_path, "w") as f:
        # Dump the behavior config part
        f.write(preset.behavior.model_dump_json(indent=2))

    return preset


@router.delete("/{name}")
async def delete_behavior(name: str):
    safe_name = "".join([c for c in name if c.isalnum() or c in ("-", "_")])
    file_path = BEHAVIOR_DIR / f"{safe_name}.json"

    if file_path.exists():
        os.remove(file_path)
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Behavior not found")
