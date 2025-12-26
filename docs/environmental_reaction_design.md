# Environmental Reaction Design Document

## 1. Introduction

This document outlines the design and implementation of the "Sprite Environmental Reaction" feature within the Papeterie Engine. This feature enables sprites to react dynamically to their environment, specifically by detecting the first non-transparent area in a subsequent parallax layer and adjusting their orientation (e.g., pivoting) accordingly. The initial implementation focuses on allowing a sprite, such as a boat, to pivot as if riding wave crests.

## 2. Core Concepts

To support dynamic environmental reactions, two new Pydantic models and an Enum were introduced:

*   **`EnvironmentalReactionType` (Enum):** Defines the available types of environmental reactions. Currently, only `PIVOT_ON_CREST` is supported.
    ```python
    from enum import Enum

    class EnvironmentalReactionType(str, Enum):
        PIVOT_ON_CREST = "pivot_on_crest"
    ```

*   **`EnvironmentalReaction` (Pydantic Model):** Encapsulates the configuration for how a sprite should react to its environment.
    *   `reaction_type`: Specifies the type of reaction (e.g., `PIVOT_ON_CREST`).
    *   `target_sprite_name`: The `sprite_name` of the layer this sprite should react to (e.g., "wave1").
    *   `max_tilt_angle`: The maximum angle (in degrees, 0.0 to 90.0) the sprite can tilt.

    ```python
    from pydantic import BaseModel, Field

    class EnvironmentalReaction(BaseModel):
        reaction_type: EnvironmentalReactionType = Field(..., description="The type of environmental reaction.")
        target_sprite_name: str = Field(..., description="The name of the sprite layer this sprite reacts to.")
        max_tilt_angle: float = Field(..., ge=0.0, le=90.0, description="Maximum tilt angle in degrees when reacting to the environment.")
    ```

## 3. Data Model Changes (`src/compiler/models.py`)

*   The `SpriteMetadata` model was updated to include an optional `environmental_reaction` field:
    ```python
    class SpriteMetadata(BaseModel):
        # ... existing fields ...
        environmental_reaction: Optional[EnvironmentalReaction] = Field(None, description="Defines how this sprite reacts to its environment.")
    ```

*   The `SceneLayer` model was also updated to allow scene-specific overrides for `environmental_reaction`:
    ```python
    class SceneLayer(BaseModel):
        # ... existing fields ...
        environmental_reaction: Optional[EnvironmentalReaction] = Field(None, description="Defines how this sprite reacts to its environment (scene override).")
    ```

## 4. Compiler Integration

*   **`prompts/MetaPrompt.prompt`:** The system instruction prompt for the LLM was updated to guide it in generating the `environmental_reaction` object when a sprite's description implies environmental interaction. This ensures that the generated JSON metadata adheres to the new schema.

    ```
    ... (previous prompt content)
    - "environmental_reaction": (optional object if the sprite interacts with another layer)

    If the sprite's description implies interaction with another layer (e.g., a boat on waves), include an 'environmental_reaction' object with these EXACT keys:
    - "reaction_type": (string, currently only "pivot_on_crest")
    - "target_sprite_name": (string, the name of the sprite it reacts to, e.g., "wave1")
    - "max_tilt_angle": (float between 0.0 and 90.0)

    Example for a reacting sprite (boat on wave1): {"frequency": 0.3, "amplitude_y": 5, "rotation_range": [-2, 2], "z_depth": 7, "opacity": 1.0, "environmental_reaction": {"reaction_type": "pivot_on_crest", "target_sprite_name": "wave1", "max_tilt_angle": 15.0}}
    ```

*   **`src/compiler/engine.py`:** The `SpriteCompiler` implicitly handles the new Pydantic model structure. When the LLM generates JSON with the `environmental_reaction` field, Pydantic's `SpriteMetadata` model automatically validates and parses it into an `EnvironmentalReaction` object.

## 5. Renderer Logic (`src/renderer/theatre.py`)

*   **`ParallaxLayer.__init__`:** The constructor for `ParallaxLayer` was updated to accept and store an `EnvironmentalReaction` object.
    ```python
    class ParallaxLayer:
        def __init__(
            # ... existing parameters ...
            environmental_reaction: Optional[EnvironmentalReaction] = None
        ):
            # ... initialization ...
            self.environmental_reaction = environmental_reaction
    ```

*   **`ParallaxLayer.from_sprite_dir`:** This class method now correctly instantiates the `EnvironmentalReaction` object from the `meta` dictionary if present.

*   **`ParallaxLayer.draw` method:** The core drawing logic was updated to apply rotation based on the environmental reaction:
    *   If `self.environmental_reaction` is present and its `reaction_type` is `PIVOT_ON_CREST`:
        *   It calculates `reacting_sprite_bottom_y` (the bottom Y-coordinate of the reacting sprite).
        *   It compares `reacting_sprite_bottom_y` with `environment_y` (the Y-coordinate of the environment's surface at the sprite's horizontal center).
        *   A `y_diff` is calculated and normalized. This `y_diff` determines how far above or below the sprite is from the environment's surface.
        *   `current_tilt` is calculated by scaling `y_diff` with `max_tilt_angle` and clamping it within `[-max_tilt_angle, max_tilt_angle]`.
        *   `pygame.transform.rotate` is then used to apply this `current_tilt` to the sprite's image.

*   **`run_theatre` function:**
    *   The scene loading (`load_scene`) was updated to correctly pass the `environmental_reaction` dictionary from `layer_data` to the `ParallaxLayer.from_sprite_dir` method.
    *   The main rendering loop now creates a `layers_by_name` dictionary to quickly look up target environment layers by their `sprite_name`.
    *   When iterating through layers, if a layer has `environmental_reaction` configured, it finds its `target_sprite_name`'s layer and calls `get_y_at_x` on the environment layer to determine the `environment_y` at the reacting sprite's horizontal center.
    *   This `environment_y` is then passed to the reacting sprite's `draw` method.

## 6. Example Configuration (`story/scene1.json` excerpt)

To make a `boat` sprite pivot on a `wave1` sprite, the `boat` layer in `scene1.json` (or its `.meta` file) would include:

```json
{
    "sprite_name": "boat",
    "vertical_percent": 0.69,
    "x_offset": 0,
    "y_offset": 70,
    "scroll_speed": 0.30,
    "environmental_reaction": {
        "reaction_type": "pivot_on_crest",
        "target_sprite_name": "wave1",
        "max_tilt_angle": 15.0
    }
}
```

This configuration would cause the `boat` to tilt up or down by a maximum of 15 degrees as its bottom interacts with the `wave1` layer's surface.
