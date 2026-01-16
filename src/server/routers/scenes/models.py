from typing import List, Optional

from pydantic import BaseModel, constr


class SceneInfo(BaseModel):
    name: str
    has_config: bool
    has_original: bool = False
    original_ext: Optional[str] = None
    config: Optional[dict] = None
    used_sprites: List[str] = []
    original_url: Optional[str] = None
    is_community: bool = False
    creator: Optional[str] = None


class GenerateSceneRequest(BaseModel):
    name: constr(max_length=100)
    prompt: constr(max_length=2000)


class OptimizeRequest(BaseModel):
    prompt_guidance: Optional[str] = None
    processing_mode: str = "local"  # "local" (default, $0) or "llm" (high quality)


class RotateRequest(BaseModel):
    angle: int
