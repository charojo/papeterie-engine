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

