# Project Backlog

This file lists features, improvements, and bugs to be addressed in the Papeterie Engine. Gemini can refer to this backlog for future tasks and suggestions.

## Work in Progress

*   **Sprite Environmental Reaction:** Implement a feature where a sprite reacts to its environment by detecting the first non-transparent area in the next parallax layer. This will enable sprites to interact dynamically with the scene's geometry, such as a boat bobbing on waves or a character standing on a platform.
    *   **BUG:** The wave crest calculation and boat tilting are still not functioning as expected. `previous_env_y` and `env_y_direction` are not updating correctly, preventing peak/valley detection. Further debugging of state management and directional change detection is required.
    *   **Enhancement: Predictive Tilting:** Introduce an `anticipation_factor` to allow reacting sprites to sample the environment's height at a point slightly ahead of their current horizontal position, leading to more fluid and believable interactions.

## Unprioritized / Ideas

*   **Interactive Sprite Editing Mode:** Implement an in-application edit mode where users can select individual sprites and move them vertically (up/down) using interactive controls. This mode would require a 'Save' button to persist the adjusted `y_offset` (and potentially `x_offset`) values back into the `sceneX.json` file for the active scene. This would allow for visual fine-tuning of sprite positions.
*   **Twinkling Stars Effect:** Implement a visual effect for star sprites that makes them appear to twinkle. This involves randomly selecting individual stars within the sprite image and applying a temporary brightness or opacity change to simulate twinkling. This effect should be configurable via sprite metadata to control frequency and intensity.
*   **Export Scene to Movie File:** Add functionality to export a specified number of seconds of the current animation scene as a movie file (e.g., MP4, GIF) for easy sharing.