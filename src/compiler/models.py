import uuid
from enum import Enum
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


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
        1.0,
        ge=0.0,
        le=1.0,
        description="How much the sprite follows vertical movement of target (0.0=none, 1.0=full).",
    )
    tilt_lift_factor: float = Field(
        0.0,
        description=(
            "Vertical lift multiplier based on tilt angle (e.g. 1.5 = 1.5px per degree). "
            "Positive values lift when pitching up."
        ),
    )
    hull_length_factor: float = Field(
        0.5,
        ge=0.0,
        le=1.0,
        description="Fraction of image width used for environment sampling (stern/bow).",
    )


# --- Behavior System Models ---


class BehaviorType(str, Enum):
    OSCILLATE = "oscillate"
    DRIFT = "drift"
    PULSE = "pulse"  # Twinkle
    ENVIRONMENT = "environment_reaction"
    BACKGROUND = "background"
    LOCATION = "location"
    SOUND = "sound"


class CoordinateType(str, Enum):
    X = "x"
    Y = "y"
    SCALE = "scale"
    ROTATION = "rotation"
    OPACITY = "opacity"


class BaseBehavior(BaseModel):
    type: BehaviorType
    enabled: bool = True
    coordinate: CoordinateType = Field(CoordinateType.Y, description="Property to affect")


class OscillateBehavior(BaseBehavior):
    type: Literal[BehaviorType.OSCILLATE] = BehaviorType.OSCILLATE
    frequency: float = Field(..., description="Cycles per second (Hz)")
    amplitude: float = Field(..., description="Maximum offset")
    phase_offset: float = Field(0.0, description="Phase offset in radians")


class DriftBehavior(BaseBehavior):
    type: Literal[BehaviorType.DRIFT] = BehaviorType.DRIFT
    velocity: float = Field(..., description="Units per second")
    acceleration: float = Field(0.0, description="Units per second squared")
    drift_cap: Optional[float] = Field(None, description="Hard limit for the value")
    cap_behavior: Literal["stop", "bounce", "loop"] = Field(
        "stop", description="What happens at cap"
    )
    # Special field for scale drift multiplier legacy support
    scale_drift_multiplier_after_cap: Optional[float] = None


class PulseBehavior(BaseBehavior):
    type: Literal[BehaviorType.PULSE] = BehaviorType.PULSE
    coordinate: CoordinateType = Field(CoordinateType.OPACITY, description="Property to affect")
    frequency: float = Field(..., description="Pulses per second")
    min_value: float = Field(..., description="Minimum value (e.g. min opacity/scale)")
    max_value: float = Field(..., description="Maximum value")
    waveform: Literal["sine", "spike"] = Field("sine", description="Shape of the pulse")
    # Special condition for legacy "Twinkle only when scale < X"
    activation_threshold_scale: Optional[float] = None


class BackgroundBehavior(BaseBehavior):
    type: Literal[BehaviorType.BACKGROUND] = BehaviorType.BACKGROUND
    scroll_speed: float = Field(
        0.0, description="Parallax scroll speed (usually 0 for static background)"
    )
    coordinate: CoordinateType = Field(CoordinateType.Y, description="Ignored for background")


class LocationBehavior(BaseBehavior):
    """Unified positioning behavior - handles initial placement and keyframe animation."""

    type: Literal[BehaviorType.LOCATION] = BehaviorType.LOCATION
    coordinate: CoordinateType = Field(CoordinateType.Y, description="Ignored for location")

    # Position
    x: float = Field(0.0, description="X offset in pixels")
    y: float = Field(0.0, description="Y offset in pixels")
    vertical_percent: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Position as % of screen height (0=top, 1=bottom)"
    )

    # Layering & Scale
    z_depth: Optional[int] = Field(None, ge=1, le=100, description="Layer stacking order")
    scale: Optional[float] = Field(None, ge=0.0, description="Size multiplier")

    # Timeline
    time_offset: float = Field(
        0.0, ge=0.0, description="Time in seconds when this position applies"
    )
    interpolate: bool = Field(
        True, description="Whether to interpolate to this position from previous keyframe"
    )


class SoundBehavior(BaseBehavior):
    type: Literal[BehaviorType.SOUND] = BehaviorType.SOUND
    coordinate: CoordinateType = Field(CoordinateType.Y, description="Ignored")

    # Sound configuration
    sound_file: str = Field(..., description="Path to audio file relative to assets/sounds/")
    volume: float = Field(1.0, ge=0.0, le=1.0, description="Playback volume")

    # Trigger configuration (mutually exclusive)
    time_offset: Optional[float] = Field(None, description="Trigger at specific time (seconds)")
    trigger_event: Optional[str] = Field(
        None, description="Trigger on event: 'crest_peak', 'loop_start'"
    )

    # Playback options
    loop: bool = Field(False, description="Loop the sound")
    fade_in: float = Field(0.0, description="Fade in duration (seconds)")
    fade_out: float = Field(0.0, description="Fade out duration (seconds)")


BehaviorConfig = Union[
    OscillateBehavior,
    DriftBehavior,
    PulseBehavior,
    BackgroundBehavior,
    LocationBehavior,
    SoundBehavior,
]


class SpriteMetadata(BaseModel):
    """Schema for individual paper-cut assets."""

    name: Optional[str] = None
    z_depth: Optional[int] = Field(None, ge=1, le=100, description="Layer depth: 1-100")

    # Behavior System
    behaviors: List[BehaviorConfig] = Field(default_factory=list, description="List of behaviors")

    # Layer Properties
    vertical_percent: float = Field(0.5, ge=0.0, le=1.0)
    target_height: Optional[int] = None

    tile_horizontal: bool = False
    tile_border: int = 0
    height_scale: Optional[float] = None
    fill_down: bool = False
    vertical_anchor: Literal["center", "bottom", "top"] = "center"
    x_offset: int = 0
    y_offset: int = 0

    environmental_reaction: Optional[EnvironmentalReaction] = None


class SceneLayer(BaseModel):
    """Overrides for a sprite instance in a scene."""

    sprite_name: str
    z_depth: Optional[int] = None
    x_offset: Optional[int] = None
    y_offset: Optional[int] = None
    scale: Optional[float] = None

    # Behavior System support for scenes
    behaviors: List[BehaviorConfig] = Field(
        default_factory=list, description="Scene-specific added behaviors"
    )

    # Optional overrides from SpriteMetadata
    vertical_percent: Optional[float] = None


class SpriteDecompositionInfo(BaseModel):
    name: str = Field(..., description="Short, alphanumeric name (no spaces).")
    description: str = Field(..., description="Visual description for inpainting.")
    location_hint: str = Field(..., description="Where it is (e.g., 'bottom-left').")


class SceneDecomposition(BaseModel):
    sprites: List[SpriteDecompositionInfo] = Field(..., description="List of sprites found.")


class SceneConfig(BaseModel):
    """Top-level scene definition."""

    name: str
    layers: List[SceneLayer]
    duration_sec: float = Field(30.0, description="Scene duration in seconds")
    sounds: List[SoundBehavior] = Field(default_factory=list)


# --- User Models ---


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    model_config = ConfigDict(from_attributes=True)


class StructuredSpriteInfo(BaseModel):
    sprite_name: str = Field(..., description="Unique snake_case identifier")
    behaviors: List[BehaviorConfig] = Field(default_factory=list)


class StructuredSceneData(BaseModel):
    # Match the JSON output structure from prompt
    # { "background": {...}, "sprites": [...] }

    background: Optional[dict] = Field(None, description="Background layer info with behaviors")
    sprites: List[StructuredSpriteInfo] = Field(default_factory=list)


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
