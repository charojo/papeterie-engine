# Sprite Design Principles (`.meta` files)

This document outlines the principles for designing individual sprites and their associated metadata (`.meta` files). Sprite metadata describes inherent visual and animation characteristics of a sprite asset.

## Core Concepts

*   **Intrinsic Properties**: `.meta` files should define properties that are intrinsic to the sprite asset itself, regardless of the scene it appears in. These are default values that can be overridden by `sceneX.json`.
*   **Visual Integrity**: Ensure sprite assets maintain alpha transparency (RGBA) where intended.

## Sprite Metadata Properties

Each `.meta` file (e.g., `boat.meta`) is a JSON file defining the following properties:

*   `name` (string, **inferred from directory name**): The logical name of the sprite, used to link `.png`, `.prompt`, and `.meta` files. Not explicitly in the `.meta` file itself.
*   `frequency` (float, range: `0.1-2.0`, default: `0.5`): The oscillation speed of the sprite's bobbing motion in Hertz (cycles per second).
*   `amplitude_y` (integer, range: `0-100`, default: `0`): The vertical amplitude of the sprite's bobbing motion in pixels.
*   `rotation_range` (tuple of floats, default: `(-5.0, 5.0)`): A tuple `[min_degrees, max_degrees]` defining the range of tilt (rotation) for the sprite. Used for subtle, inherent sprite movements.
*   `opacity` (float, range: `0.0-1.0`, default: `1.0`): The transparency of the sprite, where `0.0` is fully transparent and `1.0` is fully opaque.
*   `target_height` (integer, optional): The target height in pixels to which the sprite's image should be scaled. If specified, the image is scaled to this height while preserving its aspect ratio.
*   `height_scale` (float, optional): A scaling factor applied to the screen height to determine the target height of the sprite. If `target_height` is also specified, `target_height` takes precedence.
*   `tile_horizontal` (boolean, default: `false`): If `true`, the sprite image will be tiled horizontally to seamlessly fill the screen width. Useful for continuous backgrounds like clouds or water.
*   `tile_border` (integer, default: `0`): When `tile_horizontal` is `true`, this specifies the number of pixels to crop from each horizontal edge of the image before tiling. Useful for removing seams in tileable assets.
*   `fill_down` (boolean, default: `false`): If `true`, the bottom edge of the sprite's image will be extended downwards with its dominant bottom color. This creates a solid fill below the visible part of the sprite, useful for water or ground layers.
*   `vertical_anchor` (string, default: `"center"`, values: `"top"`, `"center"`, `"bottom"`): Defines which part of the sprite's vertical extent is anchored by the `vertical_percent` value specified in `sceneX.json`:
    *   `"top"`: The top edge of the sprite is aligned with `vertical_percent`.
    *   `"center"`: The vertical center of the sprite is aligned with `vertical_percent`.
    *   `"bottom"`: The bottom edge of the sprite is aligned with `vertical_percent`.

## Example (`sprites/boat/boat.meta`)

```json
{
    "frequency": 0.5,
    "amplitude_y": 10,
    "rotation_range": [-2.0, 2.0],
    "opacity": 1.0,
    "target_height": 150,
    "bob_frequency": 0.05,
    "bob_amplitude": 5
}
```
