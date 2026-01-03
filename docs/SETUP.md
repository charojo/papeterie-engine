# 🛠️ SETUP.md: Project Installation & Workflow

This document contains the complete set of instructions for a human or an AI agent to initialize and manage the Papeterie Engine.

## 1. System Prerequisites

* **WSL2** (Ubuntu 22.04 or 24.04).
* **Python 3.10+** (Current project uses 3.10.12).
* **Node.js 20+** (for Web Dashboard).
* **uv**: The primary package manager for Python.
* **npm**: Node Package Manager.

## 2. Environment Initialization

Run these commands in your terminal to build the local environment:

```bash
# 1. Sync dependencies and create the .venv
uv sync

# 2. Install the project in editable mode (Essential for internal imports)
uv pip install -e .

# 3. Install Web Dashboard dependencies
cd src/web && npm install && cd ../..
```

## 3. Configuration & Secrets (`.env`)

You must manually create a `.env` file in the root directory. This file is ignored by Git.

**Create `.env` with the following content:**

```text
GEMINI_API_KEY=your_google_ai_studio_api_key

```

## 4. Project Directory Structure

* `src/`: All Python source code (Compiler, Renderer, Models).
* `assets/prompts/`: Meta-instruction templates for Gemini.
* `assets/sprites/`: Folder for sprite assets (e.g., `/sprites/boat/boat.png`).
* `tests/`: Behavioral test suite.
* `AGENTS.md`: Specific behavioral rules for AI Thought Partners.

## 5. Core Workflow Commands

| Task | Command |
| --- | --- |
| **Run All Tests** | `uv run pytest -v` |
| **Run Smart Tests** | `./scripts/smart_validate.sh` |
| **Check AI Model Access** | `uv run python scripts/check_models.py` |
| **Process New Sprites** | `uv run python main.py` |
| **Run Web Backend** | `uv run python -m src.server.main` |
| **Run Web Frontend** | `cd src/web && npm run dev` |
| **Add New Library** | `uv add [package_name]` |

## 6. AI Agent Initialization

When starting a new session with an AI Agent (Gemini):

1. **Enable Agent Mode** in the IDE sidebar.
2. Command the agent: *"Read SETUP.md and AGENTS.md to initialize project context."*


## 7. AI Agent Initialization

When using an LLM thought partner (Gemini/Claude):

1. Use **Agent Mode**.
2. Instruct the AI: *"Read SETUP.md and AGENTS.md to understand the current architecture and environment constraints."*


## 8. VS Code Integration
To ensure the environment activates on restart:
1. Ensure the `.vscode/settings.json` file exists in the root.
2. If the terminal doesn't show `(.venv)`, press `Ctrl+Shift+P` -> `Python: Select Interpreter` -> Select the path pointing to `./.venv/bin/python`.
3. Use the **Python Debugger** extension for running tests directly in the IDE.

## 9. Maintenance & Governance
### Branch Protection
The `main` branch is protected. To contribute:
1. `git checkout -b feature/your-feature-name`
1.  `git checkout -b feature/your-feature-name`
2.  Commit changes and `git push origin feature/your-feature-name`
3.  Open a Pull Request on GitHub. 

### Environment Troubleshooting
*   **Asyncio Warnings**: Ensure `pytest-asyncio` is installed via `uv add pytest-asyncio` and that `pyproject.toml` contains `asyncio_default_fixture_loop_scope = "function"`.
*   **VS Code Sync**: If the `(.venv)` prompt is missing, kill the terminal and open a new one after selecting the correct interpreter.
*   **WSL Mouse/Input Lag**: If the mouse becomes unresponsive or requires double-clicks to register in Pygame windows, the WSL graphics/input state might be stale. Run `wsl --shutdown` from a Windows PowerShell/CMD and then restart WSL.
*   **Git Auth**: If terminal push fails, use the VS Code Source Control sidebar to "Publish Branch."