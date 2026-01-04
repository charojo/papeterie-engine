# Verification Process

This document outlines the verification and testing strategies for the Papeterie Engine.

## Overview

We employ a comprehensive testing strategy covering both the Python backend (Compiler/Renderer) and the React frontend.

The primary entry point for running all verification checks is:

```bash
./scripts/validate.sh          # Auto-fixes formatting, then validates
./scripts/validate.sh --nofix  # Validate only (for CI)
```

This script runs:
1.  **Auto-fix** code style issues (import sorting, formatting) — unless `--nofix` is passed.
2.  **Backend linting** via `ruff check` and `ruff format --check`.
3.  **Backend tests** with coverage.
4.  **Frontend linting** via ESLint.
5.  **Frontend tests** with coverage.

Output is automatically logged to `logs/validate.log`.

## Backend Verification

The backend (`src/compiler`, `src/renderer`, `src/server`) is tested using `pytest`.

- **Command**: `uv run pytest --cov=src --cov-report=term-missing`
- **Location**: `tests/`
- **Frameworks**: `pytest`, `pytest-asyncio`, `pytest-mock`, `pytest-cov`

### Coverage limits
We aim for high coverage in core logic (`compiler/engine.py`, `renderer/theatre.py`).

## Frontend Verification

The web dashboard (`src/web`) is tested using `vitest`.

- **Command**: `npm run test:coverage` (in `src/web`)
- **Location**: `src/web/src/**/__tests__`
- **Frameworks**: `vitest`, `react-testing-library`, `@vitest/coverage-v8`

## Test Impact Analysis (Smart Testing)

To optimize verification time, we support "Smart Testing" to run only tests affected by code changes.

### Backend (Python)
We use `pytest-testmon` to track dependencies between tests and code.

- **Setup**: `uv run pytest --testmon` (First run builds the dependency database)
- **Run Impacted**: `uv run pytest --testmon`
- **Principles**:
    - `testmon` monitors which lines of code are executed by each test.
    - When code changes, it selects only the tests that cover the changed lines.
    - If `testmon` database is missing or out of sync, it falls back to running all tests.

### Frontend (React)
We leverage Vitest's built-in related/changed logic.

- **Command**: `npm run test -- --changed` (or `vitest --changed`)
- **Principles**:
    - Runs tests for files that have been modified since the last commit.
    - Uses the module graph to find tests that import modified files.

### Automation
We have a unified script to run both of these:
```bash
./scripts/smart_validate.sh
```
This script will execute the relevant checks for both backend and frontend based on your current changes.


## Verification Backlog

Improvements planned for the verification system:

- [ ] **End-to-End (E2E) Testing**: Implement a basic Playwright test that verifies the full flow:
    1. Start dev server
    2. Navigate to dashboard
    3. Open a scene (sailboat)
    4. Play scene and verify canvas renders
    5. Stop playback
- [ ] **Visual Regression Testing**: Automatically compare rendered output frames against "known good" baselines to detect rendering regressions.
- [ ] **Snapshot Testing**: Use Vitest snapshots for React components to catch unexpected UI changes.
- [ ] **CI Integration**: Set up GitHub Actions to run `validate.sh` on PRs.

## Current Coverage (as of Jan 2026)

| Area | Coverage |
|------|----------|
| **Backend (Python)** | 78% |
| **Frontend (React)** | 72.52% |
| **Total** | 75.26% |

### Recent Improvements
- Full ESLint cleanup: reduced 229 errors to 0
- Fixed hooks rules violation in `DeleteConfirmationDialog.jsx`
- Added missing ignores for `.vite`, `node_modules`, `coverage` directories
- Disabled `react-hooks/set-state-in-effect` rule (intentional reset patterns)
- Added tests for `AudioManager.js` (21% → 52%)
- Added tests for `BehaviorEditor.jsx` (0% → 56%)
- Added tests for `TimelineEditor.jsx` (0% → 43%)
- Added tests for `sounds.py` router (44% → 100%)

