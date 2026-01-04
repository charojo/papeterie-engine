import glob
import os
from pathlib import Path as FilePath
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/prompts", tags=["prompts"])

PROJECT_ROOT = FilePath(__file__).parent.parent.parent.parent
PROMPTS_DIR = PROJECT_ROOT / "assets" / "prompts"


class Prompt(BaseModel):
    name: str
    content: str


class PromptList(BaseModel):
    prompts: List[str]


@router.get("/", response_model=PromptList)
async def list_prompts():
    """Lists all .prompt files in assets/prompts."""
    if not PROMPTS_DIR.exists():
        return PromptList(prompts=[])

    files = glob.glob(str(PROMPTS_DIR / "*.prompt"))
    names = [os.path.basename(f).replace(".prompt", "") for f in files]
    names.sort()
    return PromptList(prompts=names)


@router.get("/{name}", response_model=Prompt)
async def read_prompt(name: str):
    """Reads the content of a specific prompt file."""
    prompt_path = PROMPTS_DIR / f"{name}.prompt"
    if not prompt_path.exists():
        raise HTTPException(status_code=404, detail="Prompt not found")

    try:
        content = prompt_path.read_text(encoding="utf-8")
        return Prompt(name=name, content=content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read prompt: {e}")


@router.post("/{name}")
async def update_prompt(name: str, prompt: Prompt):
    """Updates the content of a specific prompt file."""
    prompt_path = PROMPTS_DIR / f"{name}.prompt"

    # For safety, let's only allow editing existing ones for now (or new ones in that dir)
    # But let's check it's strictly inside the prompts dir to avoid path traversal
    if ".." in name or "/" in name:
        raise HTTPException(status_code=400, detail="Invalid prompt name")

    try:
        PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
        prompt_path.write_text(prompt.content, encoding="utf-8")
        return {"status": "success", "name": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save prompt: {e}")
