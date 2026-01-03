# HOWTO: Develop for Papeterie Engine

This guide covers the standard workflows for developing the backend and frontend, as well as using the project's utility scripts.

## Prerequisites

- **Python**: Managed via `uv` (Project uses Python 3.10+).
- **Node.js**: Required for the frontend (v18+ recommended).

## Backend Development

The backend consists of the core engine (compiler/renderer) and the FastAPI server.

### Running the Theatre (Engine)
To run a scene locally using the Pygame renderer:

```bash
# Run the default sailboat scene
uv run python src/renderer/theatre.py
```
This will open a Pygame window displaying the animation.

### Running the API Server
To start the FastAPI backend (used by the web frontend):

```bash
uv run fastapi dev src/server/main.py
```
The API will be available at `http://localhost:8000`.

## Frontend Development

The frontend is a React application located in `src/web`.

### Starting the Dev Server
```bash
cd src/web
npm install  # First time only
npm run dev
```
The web interface will be available at `http://localhost:5173`. It expects the backend API to be running on port 8000.

## Scripts & Validation

The `scripts/` directory contains essential tools for maintaining the project.

### Core Scripts

### Helper Scripts

The `scripts/` directory contains tools for development, validation, and maintenance.

| Script | Description | Usage |
| :--- | :--- | :--- |
| **Validation** | | |
| `validate.sh` | **Master Validator**. Runs linting (Ruff, ESLint), formatting, and all tests. Run before pushing. | `./scripts/validate.sh` |
| `smart_validate.sh` | **Fast Validation**. Runs only tests affected by uncommitted changes (uses `pytest-testmon` and `vitest --changed`). | `./scripts/smart_validate.sh` |
| `analyze.sh` | Generates a coverage report from `validate.log` and compares against a baseline if provided. | `./scripts/analyze.sh logs/validate.log` |
| `check_contrast.py` | Checks WCAG contrast compliance for project themes. | `uv run python scripts/check_contrast.py` |
| **Development** | | |
| `start_dev.sh` | Starts both backend and frontend servers (requires tmux). | `./scripts/start_dev.sh` |
| `process_assets.py` | Utilities for processing sprites (e.g. green screen removal). | `uv run python scripts/process_assets.py --help` |
| `generate_backend_matrix.py` | Generates backend coverage matrix. (Used by `validate.sh`) | `python scripts/generate_backend_matrix.py` |
| **Documentation** | | |
| `generate_diagrams.py` | Converts `.dot` files in `docs/assets/diagrams` to PNGs. | `uv run python scripts/generate_diagrams.py` |
| `update_workflow_docs.py` | Updates `HOWTO_Agent_Workflows.md` from `.agent/workflows`. | `uv run python scripts/update_workflow_docs.py` |

## Directory Structure

- `src/compiler`: LLM integration and metadata generation.
- `src/renderer`: Pygame and MoviePy rendering logic.
- `src/server`: FastAPI backend routes.
- `src/web`: React frontend.
- `assets`: Sprites, scenes, and prompts.
- `docs`: Project documentation.
