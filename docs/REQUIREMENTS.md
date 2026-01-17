# Requirements Specification

This document captures the requirements for the Papeterie Engine, including implementation status, traceability, and future plans.

> [!IMPORTANT]
> **Traceability Policy**: All REQUIREMENTS must be verified. If a failure occurs that cannot be resolved immediately, an **Issue** must be created and linked to the relevant Requirement. If no specific Requirement exists for a discovered issue, a new one must be created to ensure traceability.

## 1. High-Level System Requirements

| ID | Requirement Description | Status | Test Coverage | Design Source | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | **Compile Sprite Metadata**<br>Translate user prompts and sprite images into valid animation metadata (JSON) via LLM. Includes validation and fixup loops. | Implemented | `tests/test_compiler.py` | [`high_level_design.md`](design/high_level_design.md) | Core logic covers initialization and fixup. |
| **REQ-002** | **Fixup Loop**<br>Automatically repair malformed JSON received from the LLM during compilation. | Implemented | `tests/test_compiler.py` | [`high_level_design.md`](design/high_level_design.md) | Explicitly tested with mocked malformed inputs. |
| **REQ-003** | **Parallax Rendering**<br>Render layered 2D assets with parallax depth offsets based on `z_depth`. | Implemented | `test_renderer.py`, `Layer.test.js` | [`high_level_design.md`](design/high_level_design.md) | Full parity between backend. |
| **REQ-004** | **Environmental Physics**<br>Sprites must react (tilt/bob) to other layers (e.g., boats on waves). | Implemented | `test_renderer.py`, `Layer.test.js` | [`high_level_design.md`](design/high_level_design.md) | Hull contact model unit tested. |
| **REQ-005** | **Web Dashboard Smoke Test**<br>Critical user flows (Open, Play, Compose) must work via the UI. | Implemented | `smoke_test.spec.js` | [`high_level_design.md`](design/high_level_design.md) | Covers "Happy Path". |
| **REQ-006** | **User Isolation**<br>Users cannot access other users' data; prevention of path traversal. | Implemented | `test_user_isolation.py` | [`high_level_design.md`](design/high_level_design.md) | |
| **REQ-007** | **Timeline Editing**<br>Users can adjust keyframes, timing, drag-and-drop clips. | Implemented | `TimelineEditor.test.jsx` | [`subsystem_design.md`](design/subsystem_design.md#1-scene-editing-architecture) | |
| **REQ-008** | **Token Usage Tracking**<br>Log API costs and token usage. | Implemented | `test_token_logger.py` | [`high_level_design.md`](design/high_level_design.md) | |
| **REQ-009** | **UX Consistency**<br>UI elements must maintain style/layout consistency. | Implemented | `ux_consistency.spec.js` | [`subsystem_design.md`](design/subsystem_design.md#6-ux-design-system) | |
| **REQ-010** | **Two-Stage LLM Pipeline**<br>Use Descriptive Analysis followed by Structured Generation for sprites. | Partial | `test_compiler.py` | [`high_level_design.md`](design/high_level_design.md) | Defined in design, partial impl in client. |
| **REQ-011** | **Local Image Processing**<br>Support local background removal via RemBG/OpenCV as an alternative to LLM. | Implemented | `local_processor.py` | [`high_level_design.md`](design/high_level_design.md) | Default mode ($0 cost). |
| **REQ-012** | **Asset Isolation Structure**<br>Filesystem organization `assets/users/<uid>/<type>/` for privacy. | Implemented | `test_user_isolation.py` | [`high_level_design.md`](design/high_level_design.md) | Enforced by routers. |
| **REQ-013** | **Session Persistence**<br>Frontend state (view, selection) syncs to `localStorage`. | Implemented | - | [`subsystem_design.md`](design/subsystem_design.md#2-persistence--user-management) | |
| **REQ-014** | **SQLite Database**<br>Relational storage for Users and Asset Metadata. | Implemented | `test_database.py` | [`subsystem_design.md`](design/subsystem_design.md#2-persistence--user-management) | |
| **REQ-015** | **Storage Abstraction**<br>Switch between Local/S3/GCS via ENV config. | Designed | - | [`subsystem_design.md`](design/subsystem_design.md#2-persistence--user-management) | Currently Local-only active. |
| **REQ-016** | **Behavior System**<br>Modular behaviors (Oscillate, Drift, Pulse, Location). | Implemented | `Layer.test.js` | [`subsystem_design.md`](design/subsystem_design.md#1-scene-editing-architecture) | |
| **REQ-017** | **Sound Behavior**<br>Trigger audio at specific times or events with fade/loop support. | Completed | `AudioManager.js`, `SoundPicker.jsx` | [`subsystem_design.md`](design/subsystem_design.md#1-scene-editing-architecture) | Implemented. |
| **REQ-018** | **Timeline Playhead**<br>Draggable playhead and keyboard control (Space/Arrows). | Implemented | `TimelineEditor.test.jsx` | [`subsystem_design.md`](design/subsystem_design.md#1-scene-editing-architecture) | |
| **REQ-019** | **Static Frontend Deployment**<br>Serve frontend via Nginx/PythonAnywhere static files. | Planned | - | [`subsystem_design.md`](design/subsystem_design.md#5-deployment-architecture) | |
| **REQ-020** | **WSGI Compatibility**<br>Adapter for running FastAPI on standard WSGI hosts. | Planned | - | [`subsystem_design.md`](design/subsystem_design.md#5-deployment-architecture) | |
| **REQ-021** | **Video Export**<br>Export scene segments to MP4/GIF using MoviePy. | Planned | - | [`subsystem_design.md`](design/subsystem_design.md#3-video-export-design) | |
| **REQ-022** | **Headless Rendering**<br>Frame capture loop for offline video generation. | Planned | - | [`subsystem_design.md`](design/subsystem_design.md#3-video-export-design) | |
| **REQ-023** | **Command Pattern**<br>Implement Execute/Undo/Redo interface for actions. | Implemented | `useHistory.js` | [`subsystem_design.md`](design/subsystem_design.md#4-undo-redo-system) | |
| **REQ-024** | **History Stacks**<br>Manage Undo/Redo stacks with optimistic UI updates. | Implemented | `useHistory.js` | [`subsystem_design.md`](design/subsystem_design.md#4-undo-redo-system) | |
| **REQ-025** | **Hybrid/TypeScript Support**<br>Allow side-by-side JS/TS execution during migration. | Planned | - | [`subsystem_design.md`](design/subsystem_design.md#7-typescript-migration-plan) | |
| **REQ-026** | **Standard Agent Stack**<br>Share `agent_env` tooling across projects. | Partial | - | [`multi_repo_architecture.md`](design/multi_repo_architecture.md) | |
| **REQ-027** | **Robust Testing**<br>Ensure a test failure is able to check both backend and frontend and reports them as a test failure that aborts additional tests until resolved. | Implemented | `validate.sh`, `test_e2e_wrapper.py` | - | Validated by process; enforces fail-fast. |
| **REQ-028** | **Security Best Practices**<br>Ensure sensitive configuration (keys, secrets) are managed via environment variables and not hardcoded. | Implemented | `config.py` | [`subsystem_design.md`](design/subsystem_design.md#2-persistence--user-management) | Covers HP-004. |
| **REQ-029** | **Code Maintainability**<br>Adhere to architectural best practices (SRP, Modularization) to ensure system extensibility. | Continuous | - | [`architecture_review.md`](design/architecture_review.md) | Covers architectural refactoring like CR-001. |
| **REQ-030** | **Sprite List Hover Zoom**<br>Display a 250% scale preview of sprite thumbnails when hovering in the sprite list for better visibility. | Implemented | - | [`subsystem_design.md`](design/subsystem_design.md#6-ux-design-system) | Enhances asset identification. |
| **REQ-031** | **PythonAnywhere Hosting**<br>Support hosting on PythonAnywhere including WSGI configuration and static file serving. | Planned | - | - | Migrated from BACKLOG `TASK-002`. |
| **REQ-032** | **Compiler User-Scope Support**<br>Update compiler to support user-scoped directories. | Planned | - | - | Migrated from BACKLOG `TECH-002`. |
| **REQ-033** | **Audio Fade-In**<br>Implement fade_in functionality for audio playback. | Planned | - | - | Migrated from BACKLOG `TECH-003`. |
| **REQ-034** | **Twinkling Stars Effect**<br>Implement a visual effect for star sprites that makes them appear to twinkle. | Planned | - | - | Migrated from BACKLOG `IDEA-001`. |
| **REQ-035** | **Git Hooks for Validation**<br>Implement pre-commit/push hooks to automatically run validation. | Planned | - | - | Migrated from BACKLOG `IDEA-015`. |
| **REQ-036** | **Export Scene to Movie**<br>Export scene segments to movie files (MP4/GIF). | Planned | - | [`export_scene_design.md`](design/export_scene_design.md) | Migrated from BACKLOG `IDEA-002`. |
| **REQ-037** | **Agent Self-Reflection**<br>Enhance `SpriteCompiler` to allow agent to generate its own unit tests. | Planned | - | - | Migrated from BACKLOG `IDEA-003`. |
| **REQ-038** | **Sprite Remixing**<br>Allow users to "remix" existing sprites by editing prompts. | Planned | - | - | Migrated from BACKLOG `IDEA-005`. |
| **REQ-039** | **Scene Templates**<br>Provide pre-configured scene templates. | Planned | - | - | Migrated from BACKLOG `IDEA-006`. |
| **REQ-040** | **SMTP Email Verification**<br>Implement real email verification. | Planned | - | - | Migrated from BACKLOG `IDEA-007`. |
| **REQ-041** | **Local Model Selection**<br>Allow users to choose between different rembg models. | Planned | - | - | Migrated from BACKLOG `IDEA-014`. |

---

## 2. Layer Management and Selection Rules

| Rule ID | Description | Status | Design Source |
| :--- | :--- | :--- | :--- |
| **RULE-001** | **Selection Visibility**: Select on top without Z change. | Implemented | [`layer_and_selection_rules`](#) (Consolidated) |
| **RULE-002** | **Timeline Nav**: Arrow keys move layer Z. | Implemented | [`layer_and_selection_rules`](#) (Consolidated) |
| **RULE-003** | **List Editability**: Z-Depth input editable. | Implemented | [`layer_and_selection_rules`](#) (Consolidated) |
| **RULE-004** | **Selection Scroll**: Auto-scroll to selected item. | Implemented | [`layer_and_selection_rules`](#) (Consolidated) |
| **RULE-005** | **Hover Zoom**: Sprite thumbnails enlarge (2.5x) on hover. | Implemented | [`subsystem_design.md`](design/subsystem_design.md#6-ux-design-system) |

---

## 3. Keyboard Shortcuts

| ID | Requirement | Status | Design Source |
| :--- | :--- | :--- | :--- |
| **KEY-001** | **Global Scene Shortcuts**<br>Support standard shortcuts: `Space` (Play/Pause), `Ctrl+S` (Save), `Ctrl+Z/Y` (Undo/Redo), Zoom (+/-). | Implemented | [`subsystem_design.md`](design/subsystem_design.md#8-keyboard-shortcut-design) |
| **KEY-002** | **Sprite Manipulation**<br>Support transformation shortcuts: Arrows (Move), `Ctrl+Arrows` (Micro-move), `Shift+Arrows` (Fast-move), Scale (+/-). | Implemented | [`subsystem_design.md`](design/subsystem_design.md#8-keyboard-shortcut-design) |
| **KEY-003** | **Numeric Field Shortcuts**<br>Support increment/decrement via `+` / `-` and commit via `Enter`. | Implemented | [`subsystem_design.md`](design/subsystem_design.md#8-keyboard-shortcut-design) |


---

## 4. CSS Design & Architecture

Derived from `docs/design/css_design.md` (Consolidated).

| ID | Requirement | Status | Design Source |
| :--- | :--- | :--- | :--- |
| **CSS-001** | **Design System**: Use variables. | Implemented | [`subsystem_design.md`](design/subsystem_design.md#6-ux-design-system) |
| **CSS-002** | **Modules**: Modular CSS files. | Implemented | [`css_design`](#) (Consolidated) |

---

## 5. Roadmap & Gaps

| Gap ID | Area | Description | Priority |
| :--- | :--- | :--- | :--- |
| **GAP-001** | **Frontend Unit Tests** | Editors rely too heavily on E2E. | **High** |
| **GAP-002** | **LLM Stability** | "Live" tests flaky/skipped. | **Medium** |
| **GAP-003** | **Visual Regression** | Snapshots sensitive. | **Medium** |

---

## Appendix A: Design Document Status

This appendix lists all current design documents and their coverage in this requirements specification.

| Design Document | Status in REQ | Notes |
| :--- | :--- | :--- |
| `subsystem_design.md` | **Consolidated** | Contains Scene Editing, Persistence, Export, Undo/Redo, Deployment, UX, TS Plan. |
| `high_level_design.md` | **Fully Populated** | Core architecture, pipelines, and isolation requirements covered. |
| `multi_repo_architecture.md` | **Fully Populated** | Infrastructure requirements covered. |
| `verification.md` | **Process Doc** | Defines *how* we verify (Process), rather than specific feature requirements. |

---

## Appendix B: Undesigned Requirement Categories

The following high-level categories appear in the Backlog or Requirements but currently lack a specific, dedicated Design Document.

| Category | Description | Source / Reference |
| :--- | :--- | :--- |
| **Security Hardening** | Detailed auth flows, rate limiting, and specific vulnerability remediations (e.g., Path Traversal details beyond high-level reqs). | Backlog `SEC-001`, `SEC-002` |
| **Mobile & Touch** | UX adaptations for mobile devices or touch screens. | Implicit in `ux_design.md` but not detailed. |
| **Community Features** | Remixing, sharing mechanisms, social graph, public galleries. | Backlog `IDEA-005` (Remixing) |
| **Notification System** | Email verification (SMTP), system alerts, toaster notifications architecture. | Backlog `IDEA-007` |
| **Localization (i18n)** | Support for multiple languages in UI and prompts. | Future Consideration |
