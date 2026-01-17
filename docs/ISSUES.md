# Issues and Refactoring Tracker

This document tracks the current architectural issues, refactoring plans, and regression history for the Papeterie Engine.

## 1. Architectural Issues

Derived from `docs/design/architecture_review.md` (As of 2026-01-12).

| ID | Issue / Concern | Recommendation | Priority | Status | Related Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CR-001** | **God Router `scenes.py`**<br>`scenes.py` is ~952 lines... | Split into `scene_crud.py`... | **Critical** | Fixed / In Progress | **REQ-029** (Code Maintainability) |
| **CR-002** | **Inline Forms in `App.jsx`**<br>`App.jsx` contained inline forms... | Extract `NewSpriteForm.jsx`... | **Critical** | Fixed | **REQ-029** (Code Maintainability) |
| **CR-003** | **`Theatre.js` Responsibilities**<br>Mixes rendering/selection/debug... | Create `SelectionManager`... | **Critical** | Fixed | **REQ-029** (Code Maintainability) <br> **REQ-009** (UX Consistency) |
| **HP-001** | **`GenericDetailView` Split**<br>Handled both scenes and sprites... | Decompose into `SceneDetailView`. | **High** | Fixed | **REQ-029** (Code Maintainability) <br> **REQ-009** (UX Consistency) |
| **HP-002** | **`TimelineEditor` Drag Handling**<br>200+ lines of drag logic... | Extract `useTimelineDrag` hook. | **High** | Fixed | **REQ-007** (Timeline Editing) <br> **REQ-029** (Code Maintainability) |
| **HP-003** | **Duplicated CORS Logic**<br>In `main.py` and routers. | Create unified `cors_utils.py`. | **High** | Fixed | **REQ-029** (Code Maintainability) <br> **REQ-020** (WSGI Compatibility) |
| **HP-004** | **Hardcoded Security Key**<br>Key in `config.py`. | Move to env vars. | **High** | Fixed (SEC-003) | **REQ-028** (Security Best Practices) |
| **LP-001** | **Behavior Strategy Pattern** | Use Strategy pattern. | **Low** | Fixed | **REQ-016** (Behavior System) <br> **REQ-029** (Code Maintainability) |
| **LP-002** | **Token Logging Separation** | Separate from `gemini_client.py`. | **Low** | Open | **REQ-008** (Token Usage Tracking) <br> **REQ-029** (Code Maintainability) |
| **LP-003** | **Extract `CollapsibleSection`** | Extract from `App.jsx`. | **Low** | Fixed | **REQ-009** (UX Consistency) |
| **DS-001** | **Dialog & Modal Fragmentation**<br>Duplicated styles in `ExportDialog.css` and `DeleteConfirmationDialog.css`. | Consolidate into global `.modal-*` classes. | **High** | Planned | **CSS-001** (Design System) <br> **CSS-002** (Modules) <br> **REQ-009** (UX Consistency) |
| **DX-001** | **WSL Connection Drops**<br>Using `pkill -f "node"` terminates VS Code Server. | Use `lsof` or specific patterns to kill processes. | **High** | Documented | **REQ-029** (Code Maintainability) |

---

## 2. Refactoring Plan

Derived from `docs/design/refactoring_plan.md`.

| Phase | Description | Status | Details |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Camera/Zoom Hardening** | ✅ Complete | Created `CameraController.js`, `useCameraController`. |
| **Phase 2** | **Dual Runtime Parity** | ✅ Complete | Added `BEHAVIOR_RUNTIME_VERSION`, parity tests. |
| **Phase 3** | **`useAssetController` Split** | ✅ Complete | Extracted `useAssetLogs`, `useBehaviorEditor`, `useLayerOperations`. |
| **Phase 4** | **`Theatre.updateAndDraw` Split** | ✅ Complete | Refactored `updateAndDraw` in `Theatre.js`. |
| **Phase 5** | **Legacy Migration Cleanup** | ✅ Complete | Removed legacy `bob_amplitude` and environment reactor code. |
| **Phase 6** | **Schema Validation** | ✅ Complete | Added Zod schemas mirroring Pydantic models. |

---

## 3. Regression History

Derived from `docs/design/regression_analysis_report.md` (Dated 2026-01-13).

| Fix ID | Category | Description | Status |
| :--- | :--- | :--- | :--- |
| **FIXED 7** | Engine Core | **`Theatre.js`**: Stage background clipping/misalignment with camera moves. | [FIXED] |
| **FIXED 8** | Engine Core | **`Layer.js`**: Background layer scaling holes. | [FIXED] |
| **FIXED 2** | UI/UX | **`TimelineEditor.jsx`**: Invisible timeline markers (0 width/height). | [FIXED] |
| **FIXED 5** | Design Standards | **`SpriteListEditor.jsx`**: Hardcoded hex colors. | [FIXED] |
| **FIXED 6** | Design Standards | **`SpriteListEditor.jsx`**: Excessive inline styles (26 instances). | [FIXED] |
| **FIXED 1** | Code Hygiene | **`TimelineEditor.jsx`**: Unused functions. | [FIXED] |
| **FIXED 3** | Code Hygiene | **`useAssetController.js`**: Empty blocks. | [FIXED] |
| **FIXED 4** | Code Hygiene | **`cors.py`**: Line length. | [FIXED] |
| **FIXED 13** | Code Hygiene | **`InteractionManager.js`**: Unused variables. | [FIXED] |
| **FIXED 9** | Critical (Late) | **`SpriteListEditor.jsx`**: Syntax error. | [FIXED] |
| **FIXED 10** | Critical (Late) | **E2E Suite**: App crash. | [FIXED] |
| **FIXED 11** | Critical (Late) | **`Theatre.js`**: Visual rendering mismatch. | [FIXED] |
| **FIXED 12** | Critical (Late) | **`test_renderer.py`**: Race condition. | [FIXED] |
// ... existing content ...

---

## 4. Extended Architectural Analysis

Derived from `docs/design/architecture_review.md`.

### Detailed Component Concerns
| Component | Severity | Concern | Recommendation |
| :--- | :--- | :--- | :--- |
| **`main.py`** | Medium | App setup, CORS, static files all in one. | Extract CORS logic to middleware. |
| **`sprites.py`** | Medium | Handles CRUD, processing, and compilation. | Consider separating processing operations. |
| **`gemini_client.py`** | Low | Mixes API communication with token logging. | Separate token logging. |
| **`App.jsx`** | High | Handles main app, state, routing, and tiles. | Continue extracting sub-components. |

### Principle of Least Astonishment (POLA) Violations
| Violation | Location | Fix |
| :--- | :--- | :--- |
| **`get_sprite_asset` in `main.py`** | `src/server/main.py` | Move to `sprites.py` router. |
| **`useAssetController` location** | `GenericDetailView.jsx` | Moved to `src/web/src/hooks/` (Done). |
| **Forms in `App.jsx`** | `src/web/src/App.jsx` | Moved to `src/web/src/components/` (Done). |

---

## 5. Code Quality History

Derived from `docs/design/css_design.md` and `docs/design/architecture_review.md`.

| Issue Type | Count | Description | Status |
| :--- | :--- | :--- | :--- |
| **Hardcoded Colors** | 3 files | `Theatre.js`, `DebugRenderer.js`, `Layer.js` had hex codes. | Resolved |
| **Inline Styles** | ~73 | Excessive inline styles in `DeleteConfirmationDialog`, `TheatreStage`, etc. | Resolved |
| **Component Size** | 6 files | Components > 500 lines (`scenes.py`, `TimelineEditor`, etc.). | In Progress |
| **Security** | 4 items | SEC-001 to SEC-004 (Hardcoded keys, etc.). | Fixed/Tracked |
| **Cleanup** | 1 item | Removed `SampleTSComponent` and legacy "Back to List" button. | Resolved |

---

## 6. UI/UX Issues (Active)

| Issue | Description | Status |
| :--- | :--- | :--- |
| **UX-001** | **Escape Key Closing**<br>Escape key does not close the "Add Behavior" popup. | [FIXED] |

---

## 7. Active Defects & Technical Debt (Migrated from Backlog)

| ID | Issue / Concern | Description | Priority | Related Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-004** | **Sprite Selection Z-Index** | When a sprite is selected, it needs to visually "pop" to the top in both the main view and the timeline. No Z-index override logic exists for selection. | **Medium** | **REQ-009** (UX Consistency) |
| **DEF-006** | **Sprite Loading Regression** | Sprites for community scenes (e.g., Sailboat) fail to load if a user has a shadowing local copy. Need to prioritize community scenes or handle conflict in `Theatre.js`. | **Medium** | **REQ-001** (Sprite Compilation) |
| **SEC-001** | **Auth Path Traversal** | Sanitize the `user_id` in `get_current_user` to prevent arbitrary directory creation via the `Authorization` header. Reference: `security_review.md`. | **High** | **REQ-006** (User Isolation) |
| **SEC-002** | **Asset Path Traversal** | Implement path validation in `get_sprite_asset` to ensure file retrieval is restricted to the `ASSETS_DIR` and prevent `../` attacks. | **High** | **REQ-006** (User Isolation) |
| **SEC-004** | **Sanitize API Errors** | Ensure internal server errors and tracebacks are not leaked to the client in `HTTPException` details. | **Medium** | **REQ-028** (Security Best Practices) |
| **TASK-005** | **Button Variant Review** | Consolidate dialog buttons to use only "Small" and "Normal" variants. Strictly enforce `btn` base class. | **Low** | **REQ-009** (UX Consistency) |
| **TECH-001** | **Refactor `main.py`** | The entry point is currently too large and logic should be distributed. | **Medium** | **REQ-029** (Code Maintainability) |
