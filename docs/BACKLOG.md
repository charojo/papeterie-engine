# Project Backlog

This file lists features, improvements, and bugs to be addressed in the Papeterie Engine. Gemini can refer to this backlog for future tasks and suggestions.

## Done (Accepted for now)

*   **Sprite Environmental Reaction:** Implemented feature where a sprite reacts to its environment by detecting the first non-transparent area in the next parallax layer, enabling interactions like a boat bobbing on waves. Includes a bug where full tilt range and consistent peak/valley detection require further refinement, and an enhancement for predictive tilting is proposed.
*   **Token Usage Ledger:** Implemented a persistent CSV-based tracking system in `src/compiler/token_logger.py` that records Gemini API usage (prompt/candidate/total tokens) for every metadata generation event.
*   **Gemini 3 Pro Image Fixup:** Integration of Gemini 3 Pro for advanced image processing and automated fixup loops.
*   **Web Dashboard (Beta):** Initial release of a React/Vite web dashboard for sprite management and visualisation.
*   **Starbuilders Scene:** Added the full "Starbuilders" scene with new assets and logic (`scene_starbuilders.json`).

## Unprioritized / Ideas

*   **Interactive Sprite Editing Mode:** Implement an in-application edit mode where users can select individual sprites and move them vertically (up/down) using interactive controls. This mode would require a 'Save' button to persist the adjusted `y_offset` (and potentially `x_offset`) values back into the `sceneX.json` file for the active scene. This would allow for visual fine-tuning of sprite positions.
*   **Twinkling Stars Effect:** Implement a visual effect for star sprites that makes them appear to twinkle. This involves randomly selecting individual stars within the sprite image and applying a temporary brightness or opacity change to simulate twinkling. This effect should be configurable via sprite metadata to control frequency and intensity.
*   **Export Scene to Movie File:** Add functionality to export a specified number of seconds of the current animation scene as a movie file (e.g., MP4, GIF) for easy sharing.
*   **Agent Self-Reflection Loop:** Enhance the `SpriteCompiler` to allow the agent to generate its own unit tests for the metadata it produces, ensuring "physics-correctness" before human review.
*   **Token Optimization Analyzer:** Create a script that analyzes `logs/token_ledger.csv` and suggests prompt compression or model switching to reduce operational costs.
