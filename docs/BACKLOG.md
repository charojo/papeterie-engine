# Project Backlog

This file lists features, improvements, and bugs to be addressed in the Papeterie Engine. Gemini can refer to this backlog for future tasks and suggestions.

## High Priority

*   **[TASK-002] PythonAnywhere Hosting**: Plan and implement hosting on PythonAnywhere (Free/Low-cost AWS alternative). This includes setting up the WSGI entry point, configuring static file serving, and adapting the environment setup (virtualenv) for the hosting platform.

## Defects & Known Issues

*   **[DEF-004] Sprite Selection Z-Index**: When a sprite is selected, it needs to visually "pop" to the top in both the main view and the timeline. No Z-index override logic exists for selection.
*   **[DEF-006] Sprite Loading Regression (Community Scenes)**: Sprites for community scenes (e.g., Sailboat) fail to load if a user has a shadowing local copy. Need to prioritize community scenes or handle conflict in `Theatre.js`.

## Security & Hardening

*   **[SEC-001] Remediate Path Traversal in Authentication**: Sanitize the `user_id` in `get_current_user` to prevent arbitrary directory creation via the `Authorization` header. Reference: [`security_review.md`](../.gemini/antigravity/brain/5ce10f11-0789-4fff-a4e9-dd44b0a2389e/security_review.md).
*   **[SEC-002] Remediate Path Traversal in Asset Serving**: Implement path validation in `get_sprite_asset` to ensure file retrieval is restricted to the `ASSETS_DIR` and prevent `../` attacks.
*   **[SEC-003] Secure Secret Management**: Move sensitive keys like `AUTH_SECRET_KEY` from `src/config.py` to environment variables managed via `.env`.
*   **[SEC-004] Sanitize API Error Responses**: Ensure internal server errors and tracebacks are not leaked to the client in `HTTPException` details.

## Active Development
(Empty)

## Verification & Quality Assurance
(Empty)

## Technical Debt

*   **[TECH-001] Refactor `main.py`**: The entry point is currently too large and logic should be distributed.
*   **[TECH-004] TypeScript Migration**: Prepare the project for TypeScript conversion by updating configuration and dependencies to support a hybrid JS/TS environment. Design: [`docs/design/2026-01-11_typescript_migration_plan.md`](design/2026-01-11_typescript_migration_plan.md).

## Unprioritized / Ideas

*   **[TECH-002] Compiler User-Scope Support**: Update compiler to support user-scoped directories (migrated from code TODO).
*   **[TECH-003] Audio Fade-In**: Implement fade_in functionality for audio playback (migrated from code TODO).
*   **[IDEA-001] Twinkling Stars Effect:** Implement a visual effect for star sprites that makes them appear to twinkle.
*   **[IDEA-015] Git Hooks for Validation:** Implement pre-commit/push hooks to automatically run `./bin/validate.sh --full` to prevent broken code from entering the repo.
*   **[IDEA-002] Export Scene to Movie File:** Add functionality to export a specified number of seconds of the current animation scene as a movie file (e.g., MP4, GIF) for easy sharing. Design: [`docs/design/export_scene_design.md`](design/export_scene_design.md).
    > [!NOTE] 
    > **Workaround Available**: Users can use xbox capture (Win+G) or similar OS-level screen recording tools to capture playback.
*   **[IDEA-003] Agent Self-Reflection Loop:** Enhance the `SpriteCompiler` to allow the agent to generate its own unit tests.
*   **[IDEA-005] Sprite Remixing**: Allow users to "remix" existing sprites by editing their prompts.
*   **[IDEA-006] Scene Templates**: Provide pre-configured scene templates (e.g., "Forest Theater", "Space Stage").
*   **[IDEA-007] SMTP Email Verification**: Implement real email verification using Python's `smtplib`.
*   **[IDEA-009] Undo/Redo System**: Replace confirmation dialogs with an optimistic Undo/Redo command system.
*   **[IDEA-014] Local Model Selection**: Allow users to choose between different rembg models (u2net, u2netp, silueta).

## Done (Accepted)

*   **[DONE-017] Debug Tab Auto Mode UX**: Added tooltips for debug modes (auto/on/off) and a "Clear Selection" button. The button appears in its own row when in `auto` mode and a sprite is selected, allowing for easy hiding of the debug overlay. (Derived from IDEA-015)

*   **[DONE-001] Sprite Environmental Reaction:** Implemented feature where a sprite reacts to its environment by detecting the first non-transparent area in the next parallax layer, enabling interactions like a boat bobbing on waves.
*   **[DONE-002] Token Usage Ledger:** Implemented a persistent CSV-based tracking system in `src/compiler/token_logger.py` that records Gemini API usage (prompt/candidate/total tokens) for every metadata generation event.
*   **[DONE-003] Gemini 3 Pro Image Fixup:** Integration of Gemini 3 Pro for advanced image processing and automated fixup loops.
*   **[DONE-004] Web Dashboard (Beta):** Initial release of a React/Vite web dashboard for sprite management and visualisation.
*   **[DONE-005] Starbuilders Scene:** Added the full "Starbuilders" scene with new assets and logic (`scene_starbuilders.json`).
*   **[DONE-006] Unified Scene View:** Merged the static `ImageViewer` and the animated `TheatreStage` into a single, interactive scene editor. Supports actual-size rendering, direct manipulation of position, scale, and rotation, and Shift-Click to add sprites.
*   **[DONE-007] Interactive Sprite Editing Mode:** Implemented via the Unified Scene View, allowing users to select and transform sprites directly on the stage with persistence back to the scene configuration.
*   **[DONE-008] Local Image Processing Toggle:** Added a processing mode toggle (Local/LLM) for scene optimization. Local mode uses `rembg` + OpenCV for $0 cost extraction, defaulting to "Local" to reduce API expenses. Design: [`docs/design/high_level_design.md`](design/high_level_design.md).
*   **[DONE-009] Dynamic CORS & Centralized Config:** Eliminated hardcoded origin strings in the frontend and backend. Implemented a centralized `config.js` with dynamic hostname detection and robust backend CORS reflection for local development.
*   **[DONE-010] CSS/UX Compliance Tooling:** Added automated CSS compliance checking (`check_css_compliance.py`), E2E UX consistency tests (`ux_consistency.spec.js`), and `/css-review` workflow. Integrated into `validate.sh`. Design: [`docs/design/ux_design.md`](design/ux_design.md).
*   **[DONE-011] Add E2E Simple Test:** Basic flow test in `e2e/basic_flow.spec.js` and UX consistency tests in `e2e/ux_consistency.spec.js`.
*   **[DONE-012] Add Linting to Validate Script:** ESLint and Ruff integrated, plus CSS compliance check.
*   **[DONE-013] Draggable Timeline Keyframes:** allow users to drag keyframes on the timeline to adjust their timing. Implemented in `TimelineEditor.jsx` with `handleItemDragStart`.
*   **[DONE-014] UI Overhaul & Workflow Refinement**: Complete refactor of the web dashboard to remove the sidebar, centralize the Scene View, and improve sprite manipulation tools (Scale Widget, Overlay).
*   **[DONE-015] Improve Verification Coverage**: Implemented E2E tests, visual regression infrastructure, and linting.
*   **[DONE-016] Sound File Picker**: Implement a UI to browse and select audio files in the Behavior Editor. Implemented in `BehaviorEditor.jsx`.
*   **[DONE-019] Token Optimization Analyzer**: Created `bin/analyze_tokens.py` to analyze ledger cost and usage.
*   **[DONE-020] Two-Stage LLM Scene Composition**: Refactored `SpriteCompiler` to support a creative elaboration stage before technical JSON generation.
*   **[FIX-004] CSS Cleanup**: Reduced inline styles in `TimelineEditor.jsx` by introducing `timeline-scrubber`, `timeline-tick-line`, etc. (DEF-005 improved).

## Resolved Defects

*   **[FIX-001] Double Fetching of Sprite Assets:** `Theatre.js` was fetching the same sprite image multiple times (checked via network logs). Implemented `spriteCache` (Map) in `Theatre` class to store and reuse load promises.
*   **[FIX-002] 404 Logs for Missing Prompt Files:** Frontend logs 404 errors when `.prompt.json` files are missing (which is a valid state). Added a specific API route to intercept `.prompt.json` requests; returns empty JSON `{}` if file is missing instead of 404.
*   **[FIX-003] CORS Origin Mismatch (localhost vs 127.0.0.1):** Accessing the frontend via `127.0.0.1` while the backend assumed `localhost` caused CORS blocks and hardcoded URL failures. Implemented dynamic hostname detection in the frontend and robust origin reflection on the backend.
*   **[FIX-005] Debug Mode Toggle Not Working:** The Debug tab's mode selector (auto/on/off) had no effect because all string values are truthy in JavaScript. Fixed `TheatreStage.jsx` to properly convert mode strings to boolean: `'on'` always shows overlay, `'off'` never shows, `'auto'` shows only when a sprite is selected.
*   **[DEF-001] Layer Numbers in Timeline**: User confirmed numbers are visible. CSS class `timeline-lane-header` is defined and style is correct (`z-index: 110`, `sticky`).
*   **[DEF-002] Timeline Selection Jumping**: `skipScrollRef` logic is implemented in `TimelineEditor.jsx` to prevent auto-scrolling on direct interaction.
*   **[DEF-003] Negative Timeline Values**: Resolved as "Overcome by Events" per user decision. Issue is no longer relevant.
*   **[DEF-005] CSS Design System Violations**: Refactored `TimelineEditor.jsx` to use CSS classes, significantly reducing inline styles (from >23 to 18).
*   **[FIX-007] E2E Visual Snapshots Missing from Git**: Fixed `.gitignore` which was excluding Playwright snapshots. These are now allowed in the repository to ensure visual regression tests pass on fresh clones.
*   **[FIX-006] Missing Asset Directories on Clean Pull**: `SpriteCompiler` and other components now ensure their required directories exist during initialization, preventing failures on clean environments where empty untracked directories are missing.
*   **[DONE-021] Clean Git Pull Validation**: Successfully validated the environment cleanup and rebuild process (`git clean -fdx`, `uv sync`, `npm install`). The validation suite now includes hints for initial/clean runs.
*   **[FIX-008] Fix Validation Script Counting**: Fixed a bug in `ADE_analyze_project.py` where it was incorrectly identifying the project root, leading to massively undercounted files and LOC in validation reports.

### 2026-01-10T03:10:06Z - master (c0febb4)
- ISSUE: Unit Test Failure: tests/test_backend.py fails in clean env due to missing mkdir(parents=True)

