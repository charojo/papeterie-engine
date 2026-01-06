# Project Backlog

This file lists features, improvements, and bugs to be addressed in the Papeterie Engine. Gemini can refer to this backlog for future tasks and suggestions.

## Done (Accepted for now)

*   **Sprite Environmental Reaction:** Implemented feature where a sprite reacts to its environment by detecting the first non-transparent area in the next parallax layer, enabling interactions like a boat bobbing on waves. Includes a bug where full tilt range and consistent peak/valley detection require further refinement, and an enhancement for predictive tilting is proposed.
*   **Token Usage Ledger:** Implemented a persistent CSV-based tracking system in `src/compiler/token_logger.py` that records Gemini API usage (prompt/candidate/total tokens) for every metadata generation event.
*   **Gemini 3 Pro Image Fixup:** Integration of Gemini 3 Pro for advanced image processing and automated fixup loops.
*   **Web Dashboard (Beta):** Initial release of a React/Vite web dashboard for sprite management and visualisation.
*   **Starbuilders Scene:** Added the full "Starbuilders" scene with new assets and logic (`scene_starbuilders.json`).
*   **Unified Scene View**: Merged the static `ImageViewer` and the animated `TheatreStage` into a single, interactive scene editor. Supports actual-size rendering, direct manipulation of position, scale, and rotation, and Shift-Click to add sprites.
*   **Interactive Sprite Editing Mode**: Implemented via the Unified Scene View, allowing users to select and transform sprites directly on the stage with persistence back to the scene configuration.
*   **Local Image Processing Toggle**: Added a processing mode toggle (Local/LLM) for scene optimization. Local mode uses `rembg` + OpenCV for $0 cost extraction, defaulting to "Local" to reduce API expenses. Design: [`docs/design/high_level_design.md`](design/high_level_design.md).
*   **Dynamic CORS & Centralized Config**: Eliminated hardcoded origin strings in the frontend and backend. Implemented a centralized `config.js` with dynamic hostname detection and robust backend CORS reflection for local development.

## Active Development

*   **UI Overhaul & Workflow Refinement**: Complete refactor of the web dashboard to remove the sidebar, centralize the Scene View, and improve sprite manipulation tools (Scale Widget, Overlay). Design: [`docs/design/ui_redesign_2026.md`](design/ui_redesign_2026.md).

## Security & Hardening

*   **Remediate Path Traversal in Authentication**: Sanitize the `user_id` in `get_current_user` to prevent arbitrary directory creation via the `Authorization` header. Reference: [`security_review.md`](../.gemini/antigravity/brain/5ce10f11-0789-4fff-a4e9-dd44b0a2389e/security_review.md).
*   **Remediate Path Traversal in Asset Serving**: Implement path validation in `get_sprite_asset` to ensure file retrieval is restricted to the `ASSETS_DIR` and prevent `../` attacks.
*   **Secure Secret Management**: Move sensitive keys like `AUTH_SECRET_KEY` from `src/config.py` to environment variables managed via `.env`.
*   **Sanitize API Error Responses**: Ensure internal server errors and tracebacks are not leaked to the client in `HTTPException` details.

## Unprioritized / Ideas

*   **Twinkling Stars Effect:** Implement a visual effect for star sprites that makes them appear to twinkle. This involves randomly selecting individual stars within the sprite image and applying a temporary brightness or opacity change to simulate twinkling. This effect should be configurable via sprite metadata to control frequency and intensity.
*   **Export Scene to Movie File:** Add functionality to export a specified number of seconds of the current animation scene as a movie file (e.g., MP4, GIF) for easy sharing. Design: [`docs/design/export_scene_design.md`](design/export_scene_design.md).
*   **Agent Self-Reflection Loop:** Enhance the `SpriteCompiler` to allow the agent to generate its own unit tests for the metadata it produces, ensuring "physics-correctness" before human review.
*   **Token Optimization Analyzer:** Create a script that analyzes `logs/token_ledger.csv` and suggests prompt compression or model switching to reduce operational costs.
*   **Sprite Remixing**: Allow users to "remix" existing sprites by editing their prompts.
*   **Scene Templates**: Provide pre-configured scene templates (e.g., "Forest Theater", "Space Stage").
*   **SMTP Email Verification**: Implement real email verification using Python's `smtplib`. This is planned for when the engine is hosted on PythonAnywhere. For now, email validation is assumed to be successful on registration.
*   **Two-Stage LLM Scene Composition Pipeline**: Refactor scene optimization to separate creative interpretation (descriptive text output) from technical formatting (JSON generation). Stage 1 has the LLM describe sprites and animations in natural language; Stage 2 converts those descriptions into valid `BehaviorConfig` JSON. Design: [`docs/design/high_level_design.md`](design/high_level_design.md).
*   **Undo/Redo System**: Replace confirmation dialogs with an optimistic Undo/Redo command system. This involves implementing a history manager, command pattern for actions like deleting/moving sprites, and backend support for soft-deletes. Design: [`docs/design/undo_redo_system.md`](design/undo_redo_system.md).
*   **Sound File Picker**: Implement a UI to browse and select audio files in the Behavior Editor. Currently, users must manually type paths. See "Feature Backlog FB-1" in [`docs/design/scene_editing_architecture.md`](design/scene_editing_architecture.md).
*   **Draggable Timeline Keyframes**: allow users to drag keyframes on the timeline to adjust their timing. See "Feature Backlog FB-2" in [`docs/design/scene_editing_architecture.md`](design/scene_editing_architecture.md).
*   **Local Sprite Isolation Enhancement**: Improve `LocalImageProcessor` to detect individual sprites within a scene image using bounding box detection or SAM (Segment Anything Model) integration, rather than extracting the entire foreground as one unit.
*   **Hybrid Processing Mode**: Add a "Hybrid" mode that uses local processing for initial extraction but falls back to LLM mode for complex sprites that fail quality checks.
*   **Local Model Selection**: Allow users to choose between different rembg models (u2net, u2netp, silueta) based on quality vs speed tradeoffs.


## Verification & Quality Assurance

*   **Improve Verification Coverage**: See `docs/verification.md` for the detailed backlog of testing improvements (E2E, Visual Regression, etc.).
*   **Add E2E Simple Test**: Implement a basic end-to-end test using Playwright that:
    1. Starts the dev server
    2. Navigates to the dashboard
    3. Opens a scene (e.g., sailboat)
    4. Plays the scene and verifies canvas renders
    5. Stops playback
    - Priority: Medium
    - Files: `e2e/basic_flow.spec.js` (new), `playwright.config.js` (new)
*   **Add Linting to Validate Script**: Incorporate `eslint` and `ruff` checks into `scripts/validate.sh`.

## Technical Debt

*   **Refactor `main.py`**: The entry point is currently too large and logic should be distributed.
