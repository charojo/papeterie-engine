# Design: Multi-Repo Agent Architecture

**Status**: Draft
**Date**: 2026-01-10
**Context**: Moving towards a model where generic agent tools are shared across multiple projects (`papeterie`, `agent-dev-env`, etc.).

## 1. The "Standard Stack" Concept

To maximize reuse while maintaining simplicity, we define a **Standard Agent Stack** that serves as the baseline for our AI development environment.

**The Baseline**:
*   **Backend**: Python 3.10+ (managed by `uv`).
*   **Frontend**: Node.js 20+ (managed by `npm`).
*   **Validation**: `pytest` (backend) + `vitest` (frontend).
*   **Standard Context Files**: `AGENTS.md`, `GEMINI.md`, and `llm.txt`.

By standardizing on this stack, we can build robust, reusable tooling (like `validate.sh`) that works "out of the box" for 90% of our use cases, while still allowing configuration for exceptions.

## 2. Infrastructure Sharing

The `agent_env/` directory is the unit of sharing.

### 2.1. The Kernel (`agent_env/bin`)
Contains the "Operating System" for the agent:
*   `validate.sh`: The universal test runner.
*   `ensure_env.sh`: The universal bootstrapper.
*   `analyze.sh`: The universal log parser.
*   **Templates**: Standard templates for context files reside in `agent_env/config/templates/`.

**Constraint**: These scripts MUST NOT contain hardcoded paths to "Papeterie" specific files (like `src/renderer/theatre.py`). They can only reference:
1.  Standard paths (`src/`, `tests/`).
2.  Configuration values from `agent_env/config.toml`.

### 2.2. The Configuration (`agent_env/config.toml`)
Defines how the abstract "Standard Stack" maps to this specific repo.

```toml
[project]
name = "papeterie"
type = "standard-python-js"  # Signals the generic scripts to use default logic

[validation]
# Overrides or additions to the standard stack
```

## 3. Workflow Separation

Workflows in `agent_env/workflows/` are categorized into:

1.  **Core Workflows (Global)**:
    *   `validate.md`: "Run the tests."
    *   `cleanup.md`: "Clean the artifacts."
    *   `security-review.md`: "Scan for secrets."
    *   *These are identical across ALL projects.*

2.  **Project Workflows (Local)**:
    *   `add-scene.md`: Specific to Papeterie.
    *   `deploy-pythonanywhere.md`: Specific to Papeterie's infra.

**Implementation**:
Future tooling will likely separate these into `agent_env/workflows/core` (git submodule from `agent-dev-env`) and `agent_env/workflows/local`.

## 4. Documentation Strategy
*   **Methodology Docs** (`agent_env/docs/`): Belong to the Agent Environment / Kernel. (e.g., "How we code together").
*   **Product Docs** (`docs/`): Belong to the Repo. (e.g., "How the Scene Engine works").
*   **Design Docs** (`docs/design/`): Belong to the Repo. (e.g., this file, `multi_repo_architecture.md`).

## 5. Component Lifecycle (Migration Inventory)

This table defines the disposition of files in the transition to the Agent Platform.

| Component / File | Status | Location | Notes |
| :--- | :--- | :--- | :--- |
| **Generic Infrastructure** | | | |
| `validate.sh` | **MOVED** | `agent_env/bin/` | Now config-driven. |
| `ensure_env.sh` | **MOVED** | `agent_env/bin/` | |
| `analyze.sh` | **MOVED** | `agent_env/bin/` | |
| `analyze_project.py` | **MOVED** | `agent_env/bin/` | |
| `check_contrast.py` | **MOVED** | `agent_env/bin/` | Generic compliance tool. |
| `check_css_compliance.py` | **MOVED** | `agent_env/bin/` | Generic compliance tool. |
| `enforce_relative_paths.py` | **MOVED** | `agent_env/bin/` | Documentation integrity. |
| **Product Specific (Kept)** | | | |
| `start_dev.sh` | **KEPT** | `scripts/` | Specific to Papeterie servers. |
| `process_assets.py` | **KEPT** | `scripts/` | Core product logic. |
| `migrate_*.py` | **KEPT** | `scripts/` | Database migrations. |
| `bootstrap_dev_ai.sh` | **KEPT** | `scripts/` | Installs specific ML deps. |
| `generate_backend_matrix.py` | **KEPT** | `scripts/` | Specific test matrix logic. |
| **Standard Context Files** | | | |
| `AGENTS.md` | **STANDARDIZED** | `docs/` | Project-specific; instance of template. |
| `GEMINI.md` | **STANDARDIZED** | `docs/` | Project-specific; instance of template. |
| `llm.txt` | **NEW** | `root/` | Project-specific summary. |
| **Project Identity & Memory** | | | |
| `2026-01-09-architecture-and-ai-partnership.md`| **RESTORED**| `docs/blogs/` | Project narrative/history. |
| **New Components** | | | |
| `config/templates/` | **NEW** | `agent_env/config/` | Source of truth for context templates. |
| **Workflows** | | | |
| `validate.md` | **MOVED** | `agent_env/workflows/` | Generic core workflow. |
| `cleanup.md` | **MOVED** | `agent_env/workflows/` | Generic core workflow. |
| `add-scene.md` | **KEPT** | `agent_env/workflows/` | Project-specific; stays in Repo. |
