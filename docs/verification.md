# Verification Process

This document outlines the verification and testing strategies for the Papeterie Engine.

## Overview

We employ a comprehensive testing strategy covering both the Python backend (Compiler/Renderer) and the React frontend.

The primary entry point for running all verification checks is:

```bash
./scripts/validate.sh
```

This script runs:
1.  Backend tests with coverage.
2.  Frontend tests with coverage.

Output is automatically logged to `logs/verification.log`.

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

- [ ] **End-to-End (E2E) Testing**: Implement Playwright/Cypress/Selenium tests to verify the full flow from Web UI -> Backend -> Rendering.
- [ ] **Visual Regression Testing**: Automatically compare rendered output frames against "known good" baselines to detect rendering regressions.
- [ ] **Snapshot Testing**: Use Vitest snapshots for React components to catch unexpected UI changes.
- [ ] **CI Integration**: Set up GitHub Actions to run `validate.sh` on PRs.
