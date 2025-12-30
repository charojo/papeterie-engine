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
    *   `reaction_type`: Specifies the type of reaction (currently only `PIVOT_ON_CREST`).
    *   `target_sprite_name`: The `sprite_name` of the layer this sprite should react to (e.g., "wave1").
    *   `max_tilt_angle`: The maximum angle (in degrees, 0.0 to 90.0) the sprite can tilt.
    *   `vertical_follow_factor`: (float, 0.0 to 1.0) Determines how much the sprite's vertical position follows the environment's surface. 0.0 means no vertical movement due to environment, 1.0 means it follows it exactly.

    ```python
    from pydantic import BaseModel, Field

    class EnvironmentalReaction(BaseModel):
        reaction_type: EnvironmentalReactionType = Field(..., description="The type of environmental reaction.")
        target_sprite_name: str = Field(..., description="The name of the sprite layer this sprite reacts to.")
        max_tilt_angle: float = Field(..., ge=0.0, le=90.0, description="Maximum tilt angle in degrees.")
        vertical_follow_factor: float = Field(0.0, ge=0.0, le=1.0, description="Vertical follow factor (0.0 to 1.0).")
    ```

## 3. Data Model Changes (`src/compiler/models.py`)

*   The `SpriteMetadata` model includes an optional `environmental_reaction` field:
    ```python
    class SpriteMetadata(BaseModel):
        # ...
        environmental_reaction: Optional[EnvironmentalReaction] = Field(None, description="Defines how this sprite reacts to its environment.")
    ```

*   The `SceneLayer` model also allows scene-specific overrides for `environmental_reaction`.

## 4. Compiler Integration

*   **`assets/prompts/MetaPrompt.prompt`:** Guides the LLM in generating the `environmental_reaction` object.
*   **`src/compiler/engine.py`:** Handles validation via Pydantic models.

## 5. Renderer Logic (`src/renderer/theatre.py`)

The renderer uses a **slope-based** tilt mechanism for the `PIVOT_ON_CREST` reaction:

1.  **Sampling**: The engine samples the environment's Y-coordinate at two points slightly ahead and behind the sprite's horizontal center (using a `sample_offset` of 2.0 pixels).
2.  **Slope Calculation**: It calculates the raw slope ($\Delta Y / \Delta X$).
3.  **Sensitivity**: A sensitivity factor of **50.0** is applied to the calculated angle ($\arctan(\text{slope}) \times 50.0$). This ensures the tilt is visually significant even for gentle waves without being overly "drastic".
4.  **Ramp-In**: To ensure sprites "begin even" at the start of a scene, a `start_ramp` is applied: `min(1.0, scroll_x / 300.0)`. This smoothly transitions the tilt from 0.0 to full sensitivity over the first 300 pixels of scrolling.
5.  **Clamping**: The final tilt is clamped to the `max_tilt_angle` configuration.
6.  **Vertical Following**: If `vertical_follow_factor` is $> 0$, the sprite's $Y$ position is adjusted to ride the wave surface before the tilt is applied.

## 6. Example Configuration (`assets/story/scene_sailboat.json` excerpt)

To make a `boat` sprite pivot on a `wave1` sprite:

```json
{
    "sprite_name": "boat",
    "vertical_percent": 0.7,
    "environmental_reaction": {
        "reaction_type": "pivot_on_crest",
        "target_sprite_name": "wave1",
        "max_tilt_angle": 30.0,
        "vertical_follow_factor": 0.35
    }
}
```
