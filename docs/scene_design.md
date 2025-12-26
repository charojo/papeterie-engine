# Scene Design Principles (`sceneX.json`)

This document outlines the principles for designing scenes using `sceneX.json` files. Scenes orchestrate the layers, their global positioning, and how they interact.

## Core Concepts

*   **Single Source of Truth**: For scene-specific attributes (like `z_depth`, global positioning, and animation overrides), `sceneX.json` is the canonical source. Base sprite characteristics (like image path, default bobbing, rotation ranges) remain in the sprite's `.meta` file.
*   **Layering (z_depth)**: The `z_depth` property defines the visual stacking order of sprites within a scene. `z_depth: 1` is the furthest back, and `z_depth: 10` is the furthest front. Layers are drawn from lowest `z_depth` to highest `z_depth`.
    *   **Best Practice**: Assign `z_depth` values explicitly in `sceneX.json` for all non-background layers to ensure consistent visual order.

## Scene Layer Properties

Each object within the `layers` array in `sceneX.json` represents a `SceneLayer` and can define the following properties:

*   `sprite_name` (string, **required**): The name of the sprite directory (e.g., "boat" for `/assets/sprites/boat`). This links to the sprite's `.meta` and `.png` files.
*   `x_offset` (integer, default: `0`): Horizontal offset in pixels from the sprite's calculated scroll position. Positive values move the sprite right.
*   `y_offset` (integer, default: `0`): Vertical offset in pixels from the sprite's calculated vertical position. Positive values move the sprite down.
*   `z_depth` (integer, default: `1`, range: `1-10`): The layer's depth. Lower values are further back. **This should always be set in `sceneX.json` for clarity.**
*   `vertical_percent` (float, default: `0.5`): The vertical anchor point of the sprite, as a percentage of screen height. `0.0` is the top, `1.0` is the bottom. This value determines the `base_y` before `y_offset` or bobbing.
    *   **Interaction with `vertical_anchor`**: The `vertical_anchor` (defined in `sprite_design.md`) influences *which part* of the sprite is anchored by `vertical_percent`.
*   `scroll_speed` (float, default: `0.0`): The horizontal scroll speed of the layer relative to the global scroll. `0.0` means no horizontal movement relative to the screen. Higher values move faster.
*   `reacts_to_environment` (boolean, default: `false`): If `true`, this sprite will dynamically tilt or react to the vertical motion of the sprite directly behind it (its environment layer).
*   `max_env_tilt` (float, default: `0.0`): The maximum tilt angle in degrees (positive or negative) that the sprite can achieve when `reacts_to_environment` is `true`.
*   `target_height` (integer, optional): Overrides the sprite's scaled height. If set, the sprite's image will be scaled to this height while preserving its aspect ratio.
*   `bob_amplitude` (float, optional): Overrides the sprite's vertical bobbing amplitude in pixels.
*   `bob_frequency` (float, optional): Overrides the sprite's vertical bobbing frequency in Hz.
*   `tile_horizontal` (boolean, optional): Overrides whether the sprite image should tile horizontally to fill the screen.
*   `fill_down` (boolean, optional): Overrides whether the sprite's bottom edge should be extended downwards with its dominant bottom color.
*   `vertical_anchor` (string, optional, values: "top", "center", "bottom"): Overrides how the sprite's `vertical_percent` is interpreted. Defaults to "center" if not specified.

## Example

```json
{
    "scene_name": "My Dynamic Scene",
    "duration_sec": 30,
    "layers": [
        {
            "sprite_name": "stars",
            "z_depth": 1,
            "scroll_speed": 0.0,
            "is_background": true
        },
        {
            "sprite_name": "wave1",
            "z_depth": 5,
            "vertical_percent": 0.8,
            "scroll_speed": 0.2,
            "x_offset": 50,
            "y_offset": -10
        },
        {
            "sprite_name": "boat",
            "z_depth": 6,
            "vertical_percent": 0.75,
            "scroll_speed": 0.2,
            "reacts_to_environment": true,
            "max_env_tilt": 15.0
        }
    ]
}
```