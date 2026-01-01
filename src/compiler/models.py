from enum import Enum
from typing import List, Optional, Tuple

from pydantic import BaseModel, Field


class EnvironmentalReactionType(str, Enum):
    PIVOT_ON_CREST = "pivot_on_crest"


class EnvironmentalReaction(BaseModel):
    """Defines how a sprite reacts to its environment."""

    reaction_type: EnvironmentalReactionType = Field(
        ..., description="The type of environmental reaction."
    )
    target_sprite_name: str = Field(
        ..., description="The name of the sprite layer this sprite reacts to."
    )
    max_tilt_angle: float = Field(
        ...,
        ge=0.0,
        le=90.0,
        description="Maximum tilt angle in degrees when reacting to the environment.",
    )
    vertical_follow_factor: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description=(
            "How much the sprite's vertical position follows the environment (0.0 to 1.0)."
        ),
    )


class SpriteMetadata(BaseModel):
    """Schema for individual paper-cut assets."""

    name: str
    frequency: float = Field(..., ge=0.1, le=2.0, description="Oscillation speed in Hz")
    amplitude_y: int = Field(..., ge=0, le=100, description="Vertical heave in pixels")
    rotation_range: Tuple[float, float] = Field((-5.0, 5.0), description="Tilt range in degrees")
    z_depth: int = Field(..., ge=1, le=100, description="Layer depth: 1 (back) to 100 (front)")
    opacity: float = Field(1.0, ge=0.0, le=1.0)
    vertical_drift: float = Field(
        0.0,
        description=(
            "Constant vertical movement in pixels per second (positive is down, negative is up)"
        ),
    )
    scale_drift: float = Field(
        0.0,
        description=(
            "Constant change in scale factor per second (e.g., 0.01 for 1% growth per second)."
        ),
    )
    scale_drift_multiplier_after_cap: float = Field(
        3.0, description="Multiplier for scale drift once drift_cap_y is reached."
    )
    horizontal_drift: float = Field(
        0.0, description="Constant horizontal movement in pixels per second."
    )
    target_height: Optional[int] = Field(None, description="Target height in pixels for rendering.")
    tile_horizontal: bool = Field(False, description="Whether to tile the sprite horizontally.")
    drift_cap_y: Optional[float] = Field(
        None, description="The screen Y coordinate (0-720) where vertical drift stops."
    )
    twinkle_amplitude: float = Field(0.0, description="Amplitude of opacity pulsing (0.0 to 1.0).")
    twinkle_frequency: float = Field(0.0, description="Frequency of opacity pulsing.")
    twinkle_min_scale: float = Field(
        0.035, description=("Twinkling only starts when scale is below this value (default 0.035).")
    )
    environmental_reaction: Optional[EnvironmentalReaction] = Field(
        None, description="Defines how this sprite reacts to its environment."
    )


class SceneLayer(BaseModel):
    """Individual layer configuration within a story scene."""

    sprite_name: str
    x_offset: int = 0
    y_offset: int = 0

    # Optional overrides from SpriteMetadata
    z_depth: Optional[int] = Field(
        None, ge=1, le=100, description="Layer depth: 1 (back) to 100 (front)"
    )
    vertical_percent: Optional[float] = None
    target_height: Optional[int] = None
    bob_amplitude: Optional[float] = None
    bob_frequency: Optional[float] = None
    scroll_speed: Optional[float] = None  # Horizontal movement speed
    tile_horizontal: Optional[bool] = None
    fill_down: Optional[bool] = None
    vertical_anchor: Optional[str] = None
    vertical_drift: Optional[float] = None
    scale_drift: Optional[float] = None
    scale_drift_multiplier_after_cap: Optional[float] = None
    horizontal_drift: Optional[float] = None
    drift_cap_y: Optional[float] = None
    twinkle_amplitude: Optional[float] = None
    twinkle_frequency: Optional[float] = None
    twinkle_min_scale: Optional[float] = None
    environmental_reaction: Optional[EnvironmentalReaction] = None


class SceneConfig(BaseModel):
    """The master 'Stage Script' for a complete animation."""

    name: str
    duration_sec: int = 10
    layers: List[SceneLayer]


class DecomposedSprite(BaseModel):
    name: str = Field(..., description="Unique snake_case name for the sprite")
    description: str = Field(..., description="Visual description for extraction")
    location_hint: str = Field(..., description="Approximate location in the image")


class SceneDecomposition(BaseModel):
    background_description: str
    sprites: List[DecomposedSprite]
