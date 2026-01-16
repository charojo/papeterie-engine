# Subsystem Designs

This document aggregates the detailed design specifications for various subsystems of the Papeterie Engine.

---

## 1. Scene Editing Architecture

*Derived from `docs/design/scene_editing_architecture.md`*

The Papeterie Engine provides a comprehensive system for creating and editing 2D "Toy Theatre" animations through scene configuration, sprite behaviors, and an interactive web frontend.

> **📖 Deep-Dive**: For React-Theatre.js state synchronization patterns and technical deep-dives, see the [consolidated blogs](../blogs/).

### 1.1 Overview

#### Purpose
The scene editing system enables:
- **Composing scenes** from reusable sprite assets
- **Defining behaviors** that animate sprites with physics-based motion
- **Live previewing** animations in a web-based theatre stage
- **Persisting changes** back to JSON configuration files

#### Key Concepts

| Concept | Description |
|---------|-------------|
| **Scene** | A composition of layers with a name and duration |
| **Layer** | An instance of a sprite within a scene, with position and behavior overrides |
| **Sprite** | A reusable image asset with default metadata |
| **Behavior** | A unit of animation logic (oscillate, drift, pulse, etc.) |

### 1.2 Use Cases

**UC-1: Compose a Scene** (Drag-and-drop, Z-depth)
**UC-2: Animate a Sprite** (Behaviors: Oscillate, Drift, Pulse)
**UC-3: Create Keyframe Animation** (TimelineEditor)
**UC-4: Add Sound Effects** (SoundBehavior, Audio Manager)
**UC-5: React to Environment** (Physics: pivot_on_crest)
**UC-6: Debug Scene Issues** (Debug Tab, Telemetry)

### 1.3 Data Model

The data model is defined in [`src/compiler/models.py`](../src/compiler/models.py) using Pydantic.

**SceneConfig**: Top-level definition containing `layers` and `duration_sec`.
**SceneLayer**: Instance of a sprite with `z_depth`, `x_offset`, `y_offset`, `scale`, and `behaviors`.
**SpriteMetadata**: Default properties stored in `.prompt.json`.

### 1.4 Behavior System

Behaviors are modular animation units:
1.  **Oscillate**: Sine-wave motion (x, y, scale, rotation, opacity).
2.  **Drift**: Continuous linear motion (velocity, acceleration).
3.  **Pulse**: Modulates opacity or scale.
4.  **Background**: Static, scrolling background.
5.  **Location**: Keyframe positioning.
6.  **Sound**: Triggers audio at specific times/events.

### 1.5 Frontend Architecture

**Component Hierarchy**:
`App` -> `GenericDetailView` -> `TheatreStage` | `BehaviorEditor` | `TimelineEditor`.

**State Management**:
`useAssetController` manages loading, selection tracking, and persistence.

**Engine Layer**:
`Theatre.js`: Orchestrates the render loop.
`Layer.js`: Handles individual sprite rendering and behavior runtime.

---

## 2. Persistence & User Management

*Derived from `docs/design/persistence_and_user_design.md`*

### 2.1 Session Persistence

Client-side persistence ensures users resume work where they left off.
**Mechanism**: Syncs `App.jsx` state to `localStorage`.
**Keys**: `selectedItem`, `view` (active view), `isExpanded`.

### 2.2 User Management & SQL

Transitioning from single-user to multi-user via **SQLite**.
**Why SQL?**: Robustness for concurrent writes and complex queries (ownership).
**Schema**:
- `users`: id (UUID), username, email, password_hash (Argon2).
- `assets`: id, user_id (FK), asset_type, asset_name, is_shared.

### 2.3 Asset Isolation

**Directory Structure**: `assets/users/<user_id>/sprites/` and `assets/users/<user_id>/scenes/`.
**Storage Modes**:
- **LOCAL**: Saves to local disk (Dev/Hobby).
- **S3/GCS**: Cloud object storage (Production/Multi-user).
Configured via `STORAGE_MODE` env var.

---

## 3. Video Export Design

*Derived from `docs/design/export_scene_design.md`*

### 3.1 Overview
Feature to export animated scene segments to MP4/GIF using `MoviePy`.

### 3.2 Key Technologies
- **MoviePy**: Video editing and composition.
- **Pygame-ce**: Headless rendering of frames.

### 3.3 Implementation Logic
1.  **Trigger**: CLI or UI function `export_movie(scene, duration, output)`.
2.  **Render Loop**: Adapted `run_theatre` loop that returns surfaces instead of flipping to display.
3.  **Frame Capture**: Convert Pygame surface to NumPy array.
4.  **Composition**: `VideoFileClip` from `make_frame` generator.

### 3.4 Future Considerations
- Performance optimization for high-res/long clips.
- User feedback (progress bars).
- Audio mixing (if sound added).

---

## 4. Undo/Redo System

*Derived from `docs/design/undo_redo_system.md`*

### 4.1 Core Architecture: Command Pattern

**Interface**: `execute()`, `undo()`, `redo()`.
**Services**: `HistoryManager` (Stack management).
**Mechanism**:
- **Optimistic UI**: Immediate update.
- **Snapshotting**: Commands store state *before* change.
- **Sync**: Undo restors snapshot and PUTs to backend.

### 4.2 Current Usage
Implemented in `useHistory.js` and `Commands.js`.
Supports: Transformations, Layer Ops (visibility/order), Behavior changes.
**Shortcuts**: `Ctrl+Z` (Undo), `Ctrl+Y` (Redo).

---

## 5. Deployment Architecture

*Derived from `docs/design/deployment.md`*

### 5.1 Context
Moving from local-first to PythonAnywhere cloud hosting.

### 5.2 Components
1.  **Frontend**: Static React assets served by Nginx.
2.  **Backend**: FastAPI via WSGI adapter (`a2wsgi`).
3.  **Database**: SQLite (file-based) on persistent disk.

### 5.3 Key Decisions
- **Separation**: Frontend is static (`/`), Backend is API (`/api`).
- **Secrets**: Managed via `.env` (not in code).
- **Paths**: Vite base path validation.

---

## 6. UX Design System

*Derived from `docs/design/ux_design.md`*

### 6.1 Design Tokens
All visuals use CSS variables from `index.css`.
**Themes**: Purple (Default), Dark, Light, Stark.
**Colors**: `--color-bg-base`, `--color-primary`, `--color-text-main`.

### 6.2 Component Patterns
- **Icon Buttons**: `.btn-icon` (No inline styles).
- **Glassmorphism**: `.glass` class (Blur 12px, semi-transparent).

### 6.3 User Journey
**Flow**: Login -> Dashboard (Recent Scenes) -> Scene Editor.

### 6.4 Validation
- Automated CSS Compliance (`check_css_compliance.py`).
- E2E UX Consistency Tests (`ux_consistency.spec.js`).
- Accessibility: WCAG AA Contrast, Focus indicators.

---

## 7. TypeScript Migration Plan

*Derived from `docs/design/2026-01-11_typescript_migration_plan.md`*

### 7.1 Strategy
Gradual side-by-side migration.
**Config**: `allowJs: true`, `jsx: "react-jsx"`, `strict: true`.

### 7.2 Workflow
1.  Rename `.jsx` -> `.tsx`.
2.  Add Interfaces for Props.
3.  Type Hooks (`useState<Type>`).
4.  Handle implicit anys.

---

## 8. Keyboard Shortcut Design

*Derived from `docs/design/keyboard_design.md`*

### 8.1 Core Principles

1.  **Context Awareness**: Shortcuts should adapt to the current focus (e.g., Scene View vs. Detail View vs. Input fields).
2.  **Discoverability**: All major shortcuts should be listed in the Keyboard Shortcuts help dialog.
3.  **Conflict Prevention**: Standard browser shortcuts (e.g., `Ctrl+F`, `Ctrl+T`) should be avoided.
4.  **Consistency**: Similar actions should use similar keys across different components.

### 8.2 Current Shortcuts

#### Scene View (Global)
| Key | Action | Notes |
| :--- | :--- | :--- |
| `Space` | Play / Pause | Everywhere except when inside text/textarea inputs. |
| `+` / `=` | Zoom In | Only if no sprite is selected. |
| `-` / `_` | Zoom Out | Only if no sprite is selected. |
| `Escape` | Clear Selection / Close Dialogs | Clears sprite selection or closes the keymap dialog. |
| `R` | Reset View | *Gap: Proposed for implementation.* |

#### Sprite Selection (Selected)
| Key | Action | Notes |
| :--- | :--- | :--- |
| `Arrow Keys` | Move Sprite | 10px increments. |
| `Shift` + `Arrows` | Fast Move | 50px increments. |
| `Ctrl` + `Arrows` | Micro Move | 1px increments. |
| `+` / `=` | Scale Up | 0.1x increments. |
| `-` / `_` | Scale Down | 0.1x increments. |
| `Shift` + `+/-` | Fast Scale | 0.5x increments. |
| `Delete` | Delete Sprite | *Gap: Proposed for implementation.* |
| `[` / `]` | Adjust Z-Order | *Gap: Proposed for implementation.* |

#### Numeric Fields
| Key | Action | Notes |
| :--- | :--- | :--- |
| `+` | Increment Value | Uses the field's `step` value. |
| `-` | Decrement Value | Uses the field's `step` value. |
| `Enter` | Set / Blur | Commits the value and removes focus. |

#### Application Shortcuts
| Key | Action | Notes |
| :--- | :--- | :--- |
| `Ctrl + S` | Save Scene / Sprite changes. | |
| `Ctrl + Z` | Undo | |
| `Ctrl + Y` | Redo | |

### 8.3 Gap Analysis & Future Improvements

**1. Z-Order Control**
- `[`: Move Back (Decrement Z)
- `]`: Move Forward (Increment Z)
- `Shift + [`: Move to absolute Back
- `Shift + ]`: Move to absolute Front

**2. Scene Navigation**
- `G`: Go to Start (Time = 0)
- `L`: Toggle Loop mode
- `F`: Fit to Screen (Reset Camera)

**3. Selection Cycle**
- `Tab`: Cycle through sprites (ordered by Z-depth or Name).
- `Shift + Tab`: Cycle backwards.

### 8.4 Implementation Strategy

Shortcuts are primarily managed via `window` listeners in `TheatreStage.jsx` and `SceneDetailView.jsx`.
**Future Goal**: Move towards a centralized `useKeyboardShortcuts` hook or a formal `KeyMapManager` that components can subscribe to.

**Handling Conflicts**:
We use a global "input focus" check to allow certain global shortcuts (like `Space`) to pass through when appropriate, differentiating between "String Edit" and "Numeric Edit" fields.

