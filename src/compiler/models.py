from enum import Enum
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field, model_validator


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
    type: Literal[BehaviorType.LOCATION] = BehaviorType.LOCATION
    coordinate: CoordinateType = Field(CoordinateType.Y, description="Ignored for location")
    x: float = Field(0.0, description="X offset in pixels")
    y: float = Field(0.0, description="Y offset in pixels")
    time_offset: float = Field(
        0.0, ge=0.0, description="Time in seconds when this position applies"
    )
    interpolate: bool = Field(
        True, description="Whether to interpolate to this position from previous keyframe"
    )


BehaviorConfig = Union[
    OscillateBehavior, DriftBehavior, PulseBehavior, BackgroundBehavior, LocationBehavior
]


class SpriteMetadata(BaseModel):
    """Schema for individual paper-cut assets."""

    name: Optional[str] = None
    z_depth: Optional[int] = Field(None, ge=1, le=100, description="Layer depth: 1-100")

    # New Behavior System
    behaviors: List[BehaviorConfig] = Field(default_factory=list, description="List of behaviors")

    # Legacy alias for backward compatibility (optional)
    events: List[BehaviorConfig] = Field(
        default_factory=list, description="Legacy alias for behaviors"
    )

    # Legacy / Flat fields (Optional for backward compat)
    frequency: Optional[float] = Field(None, description="LEGACY: Oscillation speed in Hz")
    amplitude_y: Optional[int] = Field(None, description="LEGACY: Vertical heave in pixels")
    bob_frequency: Optional[float] = Field(None, description="LEGACY: Bob speed")
    bob_amplitude: Optional[float] = Field(None, description="LEGACY: Bob amount")
    vertical_drift: Optional[int] = Field(None, description="LEGACY: Rise/Fall speed")
    drift_cap_y: Optional[int] = Field(None, description="LEGACY: Max drift")
    reacts_to_environment: Optional[bool] = Field(None, description="LEGACY: Enable env reaction")
    max_env_tilt: Optional[float] = Field(None, description="LEGACY: Max tilt angle")

    # Layer Properties
    vertical_percent: float = Field(0.5, ge=0.0, le=1.0)
    target_height: Optional[int] = None
    scroll_speed: Optional[float] = None
    is_background: Optional[bool] = Field(None, description="If true, implies BackgroundBehavior")

    tile_horizontal: bool = False
    tile_border: int = 0
    height_scale: Optional[float] = None
    fill_down: bool = False
    vertical_anchor: Literal["center", "bottom", "top"] = "center"
    x_offset: int = 0
    y_offset: int = 0

    environmental_reaction: Optional[EnvironmentalReaction] = None

    @model_validator(mode="after")
    def migrate_legacy_fields(self):
        # 0. Migrate 'events' -> 'behaviors'
        if self.events and not self.behaviors:
            self.behaviors = self.events

        # 1. Migrate Background
        if self.is_background:
            if not any(isinstance(b, BackgroundBehavior) for b in self.behaviors):
                self.behaviors.append(
                    BackgroundBehavior(
                        scroll_speed=self.scroll_speed if self.scroll_speed is not None else 0.0
                    )
                )

        # 2. Migrate basic Oscillation (Bobbing)
        # 2. Migrate basic Oscillation (Bobbing)
        freq = self.frequency
        amp = self.amplitude_y

        if self.bob_frequency is not None:
            freq = self.bob_frequency
        if self.bob_amplitude is not None:
            amp = self.bob_amplitude

        if freq is not None and amp is not None:
            has_oscillate = any(
                isinstance(b, OscillateBehavior) and b.coordinate == CoordinateType.Y
                for b in self.behaviors
            )
            if not has_oscillate:
                self.behaviors.append(
                    OscillateBehavior(
                        frequency=freq,
                        amplitude=float(amp),
                        coordinate=CoordinateType.Y,
                    )
                )

        # 3. Migrate Vertical Drift
        if self.vertical_drift is not None:
            has_drift = any(
                isinstance(b, DriftBehavior) and b.coordinate == CoordinateType.Y
                for b in self.behaviors
            )
            if not has_drift:
                self.behaviors.append(
                    DriftBehavior(
                        velocity=float(self.vertical_drift),
                        coordinate=CoordinateType.Y,
                        drift_cap=float(self.drift_cap_y) if self.drift_cap_y is not None else None,
                    )
                )

        # 4. Migrate Environment (Legacy)
        # Check if legacy fields are present
        reacts_legacy = getattr(self, "reacts_to_environment", None)
        tilt_legacy = getattr(self, "max_env_tilt", None)

        if reacts_legacy is True:
            if self.environmental_reaction is None:
                self.environmental_reaction = EnvironmentalReaction(
                    reaction_type=EnvironmentalReactionType.PIVOT_ON_CREST,
                    target_sprite_name="wave1",  # Fallback default
                    max_tilt_angle=float(tilt_legacy) if tilt_legacy is not None else 30.0,
                    vertical_follow_factor=1.0,
                )

        return self

    @model_validator(mode="after")
    def validate_legacy_requirements(self):
        if self.amplitude_y is not None and self.frequency is None:
            raise ValueError("frequency is required when amplitude_y is provided")
        if self.bob_amplitude is not None and self.bob_frequency is None:
            raise ValueError("bob_frequency is required when bob_amplitude is provided")
        return self


class SceneLayer(BaseModel):
    """Overrides for a sprite instance in a scene."""

    sprite_name: str
    z_depth: Optional[int] = None
    x_offset: Optional[int] = None
    y_offset: Optional[int] = None
    scale: Optional[float] = None

    # New Behavior System support for scenes
    behaviors: List[BehaviorConfig] = Field(
        default_factory=list, description="Scene-specific added behaviors"
    )
    events: List[BehaviorConfig] = Field(default_factory=list, description="Legacy alias")

    # Optional overrides from SpriteMetadata (Legacy & Convenience)
    vertical_percent: Optional[float] = None
    scroll_speed: Optional[float] = None
    frequency: Optional[float] = None  # For override
    amplitude_y: Optional[int] = None

    @model_validator(mode="after")
    def migrate_legacy_overrides(self):
        # Migrate events -> behaviors
        if self.events and not self.behaviors:
            self.behaviors = self.events

        def add_behavior(beh):
            self.behaviors.append(beh)

        if self.frequency is not None and self.amplitude_y is not None:
            add_behavior(OscillateBehavior(frequency=self.frequency, amplitude=self.amplitude_y))

        return self


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
