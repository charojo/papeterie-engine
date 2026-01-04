# Papeterie Engine - Project Overview for Gemini

This document provides a comprehensive overview of the Papeterie Engine project, intended to serve as persistent context for LLM collaborators.

## Project Purpose

The Papeterie Engine is a metadata-driven 2D animation system designed to create "Toy Theatre" or "Paper Theatre" style animations. It leverages Google Gemini models to translate natural language descriptions of sprites into structured, physics-based animation parameters. The engine specializes in creating layered 2D animations with procedural oscillatory motion.

## Core Architecture

The system follows a clear **Compiler-Renderer** separation:

1.  **The Compiler (`src/compiler`)**:
    *   **Input**: Consumes `.png` sprite assets and corresponding `.prompt` text files (natural language descriptions).
    *   **LLM Integration**: Uses Gemini models (specifically Gemini 2.5-Flash for initial compilation and Gemini 3 Pro for fixup) to generate structured `.prompt.json` metadata from the prompts.
    *   **Validation**: Employs Pydantic models (`src/compiler/models.py`) to validate the generated JSON metadata against predefined physics constraints (e.g., rotation ranges, oscillation speeds).
    *   **Fixup Loop**: Automatically attempts to repair malformed or unrealistic LLM outputs by feeding them back to Gemini 3 Pro with a `MetaFixupPrompt.prompt`.

2.  **The Renderer (`src/renderer`)**:
    *   **Animation**: Responsible for procedurally animating the 2D layers based on the compiled `.prompt.json` metadata.
    *   **Technologies**: Utilizes `pygame-ce` for drawing and display, and `MoviePy 2.0+` (as mentioned in `README.md`) for video rendering of the animated scenes.

3.  **The Web Dashboard (`src/web`)**:
    *   **Purpose**: A modern web interface for managing sprites, creating new assets, and visualizing the project state.
    *   **Technologies**: Built with React, Vite, and TailwindCSS. Interact with the backend via a FastAPI server (`src/server`).

## Key Technologies and Dependencies

*   **Language**: Python 3.10+, Node.js (for Web Dashboard)
*   **Environment Management**: `uv` (Python), `npm` (Node.js)
*   **LLM Interaction**: `google-genai>=1.56.0`
*   **Data Validation**: `pydantic>=2.0.0`
*   **Animation/Rendering**: `pygame-ce>=2.5.6`, `moviepy>=2.0.0`
*   **Local Image Processing**: `rembg[cpu]>=2.0.50` (background removal), `opencv-python>=4.8.0` (inpainting), `numpy>=1.26.0`, `numba>=0.60.0`, `llvmlite>=0.43.0`
*   **Testing**: `pytest>=9.0.2`, `pytest-asyncio>=1.3.0`, `pytest-mock>=3.10.0`

## Directory Structure Highlights

*   `/assets/sprites`: Contains `.png` sprite assets. Each `<name>.png` is expected to have a corresponding `<name>.prompt` and, after compilation, a `<name>.prompt.json` metadata file.
*   `/assets/story`: Contains scene configuration files (e.g., `scene_sailboat.json`) that define the composition of layers for an animation.
*   `/assets/prompts`: Stores system instructions for the AI, such as `MetaPrompt.prompt` (for initial metadata generation) and `MetaFixupPrompt.prompt` (for correcting malformed output).
*   `/src`: The main Python source code, organized into sub-packages:
    *   `/src/compiler`: Contains the `SpriteCompiler` logic (`engine.py`), Gemini client integration (`gemini_client.py`), and Pydantic data models (`models.py`).
    *   `/src/renderer`: Contains the `ParallaxLayer` and `run_theatre` logic (`theatre.py`) for scene rendering.
    *   `/src/server`: Contains the FastAPI backend for the web dashboard.
    *   `/src/web`: Contains the React/Vite frontend application.
*   `/tests`: Houses the Pytest test suite, ensuring behavioral validation of the engine components.
*   `pyproject.toml`: Defines project metadata and dependencies.
*   `uv.lock`: Lock file for `uv` managed dependencies.
*   `main.py`: A simple entry point for the application.

## Building, Running, and Testing

The project uses `uv` for dependency management.

*   **Install Dependencies**:
    ```bash
    uv sync
    ```
*   **Run Tests**:
    ```bash
    uv run pytest
    ```
    uv run pytest
    ```
    Tests are located in the `/tests` directory and leverage `pytest-asyncio` for asynchronous tests.

*   **Frontend Testing**:
    Frontend tests are located in `src/web` and use `vitest`.
    ```bash
    cd src/web && npm run test
    ```

*   **Full System Validation**:
    To run all tests (backend and frontend):
    ```bash
    ./scripts/validate.sh
    ```
*   **Running the Theatre**:
    The main rendering loop can be initiated via `src/renderer/theatre.py`. For example, to run `scene_sailboat.json`:
    ```bash
    python src/renderer/theatre.py
    ```
    (This will execute `run_theatre()` with default `scene_sailboat.json`).

## Development Conventions and Governance

*   **Pydantic for Data**: All sprite and scene metadata schemas are defined using Pydantic models for strict data validation.
*   **Behavior-Driven Development (BDD)**: Tests in `/tests` are written *before* implementation logic.
*   **Asset Integrity**: Image processing strictly maintains alpha transparency (RGBA).
*   **Error Handling**: The system includes automatic error handling for malformed LLM output via the Fixup prompt.
*   **Git Workflow**:
    *   The `master` branch is protected; direct pushes are prohibited.
    *   All changes must be made on branches prefixed with `feature/` or `fix/`.
    *   Merges to `master` occur only via GitHub Pull Requests, and `uv run pytest` must pass for integration.

## Known Issues & Troubleshooting

*   **WSL Input Capture Lock**: Occasionally, the WSL environment (especially when using WSLg for Pygame) can enter a stale state where mouse events are delayed,Require double-clicks, or are "grabbed" by a background ghost process.
    *   **Symptoms**: `Theatre` window doesn't respond to close button, mouse clicks require focus switch, debug controls feel sluggish.
    *   **Resolution**: Run `wsl --shutdown` in a Windows terminal and restart the environment. This reset is more effective than standard process killing for driver-level focus issues.

## Project Backlog

Future features, improvements, and bugs are tracked in `docs/BACKLOG.md`. This file serves as a reference for unprioritized tasks and ideas that Gemini can consult for potential future work. When presenting new ideas or tasks for later implementation, please add them to `docs/BACKLOG.md`.

## Design Documentation

Detailed design documentation is located in the `docs/design/` directory. Key documents include:
*   [`docs/design/scene_editing_architecture.md`](design/scene_editing_architecture.md): Comprehensive guide to scene composition, behaviors, and the editing UI. Replaces legacy `scene_design.md`.
*   [`docs/design/high_level_design.md`](design/high_level_design.md): System architecture, data flow, and core component overview.
*   [`docs/design/persistence_and_user_design.md`](design/persistence_and_user_design.md): User management and data persistence strategy.

## Diagrams & Visuals
*   **Location**: All `.dot` (source) and generated `.png` diagram files MUST be placed in `docs/assets/diagrams/`. Do not place them in the root of `docs/assets/`.
*   **Documentation**: Documentation must embed the generated `.png` image and provide a link to the source `.dot` file.
*   **Source of Truth**: The `.dot` files are the authoritative source for system architecture visuals. Always read the `.dot` file to understand the system structure.
*   **Generation**: After modifying any `.dot` file, you MUST run `python scripts/generate_diagrams.py` to update the corresponding `.png` images.
