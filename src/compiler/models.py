from pydantic import BaseModel, Field
from typing import List, Tuple, Optional

class SpriteMetadata(BaseModel):
    """Schema for individual paper-cut assets."""
    name: str
    frequency: float = Field(..., ge=0.1, le=2.0, description="Oscillation speed in Hz")
    amplitude_y: int = Field(..., ge=0, le=100, description="Vertical heave in pixels")
    rotation_range: Tuple[float, float] = Field((-5.0, 5.0), description="Tilt range in degrees")
    z_depth: int = Field(..., ge=1, le=10, description="Layer depth: 1 (back) to 10 (front)")
    opacity: float = Field(1.0, ge=0.0, le=1.0)
    reacts_to_environment: Optional[bool] = Field(None, description="Does this sprite react to the environment (e.g., pivot on a wave)?")
    max_env_tilt: Optional[float] = Field(None, description="Maximum tilt angle in degrees when reacting to the environment.")

class SceneLayer(BaseModel):
    """Individual layer configuration within a story scene."""
    sprite_name: str
    x_offset: int = 0
    y_offset: int = 0
    
    # Optional overrides from SpriteMetadata
    z_depth: Optional[int] = Field(None, ge=1, le=10, description="Layer depth: 1 (back) to 10 (front)")
    vertical_percent: Optional[float] = None
    target_height: Optional[int] = None
    bob_amplitude: Optional[float] = None
    bob_frequency: Optional[float] = None
    scroll_speed: Optional[float] = None  # Horizontal movement speed
    tile_horizontal: Optional[bool] = None
    fill_down: Optional[bool] = None
    vertical_anchor: Optional[str] = None
    reacts_to_environment: Optional[bool] = None # Allow scene override
    max_env_tilt: Optional[float] = None        # Allow scene override

class SceneConfig(BaseModel):
    """The master 'Stage Script' for a complete animation."""
    scene_name: str
    duration_sec: int = 10
    layers: List[SceneLayer]
