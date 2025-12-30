from pydantic import BaseModel, Field
from typing import List, Tuple, Optional
from enum import Enum

class EnvironmentalReactionType(str, Enum):
    PIVOT_ON_CREST = "pivot_on_crest"

class EnvironmentalReaction(BaseModel):
    """Defines how a sprite reacts to its environment."""
    reaction_type: EnvironmentalReactionType = Field(..., description="The type of environmental reaction.")
    target_sprite_name: str = Field(..., description="The name of the sprite layer this sprite reacts to.")
    max_tilt_angle: float = Field(..., ge=0.0, le=90.0, description="Maximum tilt angle in degrees when reacting to the environment.")
    vertical_follow_factor: float = Field(0.0, ge=0.0, le=1.0, description="How much the sprite's vertical position follows the environment (0.0 to 1.0).")

class SpriteMetadata(BaseModel):
    """Schema for individual paper-cut assets."""
    name: str
    frequency: float = Field(..., ge=0.1, le=2.0, description="Oscillation speed in Hz")
    amplitude_y: int = Field(..., ge=0, le=100, description="Vertical heave in pixels")
    rotation_range: Tuple[float, float] = Field((-5.0, 5.0), description="Tilt range in degrees")
    z_depth: int = Field(..., ge=1, le=10, description="Layer depth: 1 (back) to 10 (front)")
    opacity: float = Field(1.0, ge=0.0, le=1.0)
    environmental_reaction: Optional[EnvironmentalReaction] = Field(None, description="Defines how this sprite reacts to its environment.")

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
    environmental_reaction: Optional[EnvironmentalReaction] = Field(None, description="Defines how this sprite reacts to its environment (scene override).")

class SceneConfig(BaseModel):
    """The master 'Stage Script' for a complete animation."""
    scene_name: str
    duration_sec: int = 10
    layers: List[SceneLayer]
