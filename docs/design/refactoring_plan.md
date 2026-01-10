# Refactoring Plan: Addressing Sprawl & Stability

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Camera/Zoom Hardening | ✅ Complete |
| 2 | Dual Runtime Parity | ✅ Complete |
| 3 | useAssetController Split | ✅ Complete (573 LOC extracted) |
| 4 | Theatre.updateAndDraw Split | ✅ Complete (6 methods extracted) |
| 5 | Legacy Migration Cleanup | ✅ Complete (70 lines removed) |
| 6 | Schema Validation | ✅ Complete (155 LOC Zod schemas) |

---

## Phase 1: Camera/Zoom Hardening ✅

### Completed Work
- Created `CameraController.js` (190 LOC) - single source of truth for camera state
- Created `useCameraController.js` hook (109 LOC) - React integration layer
- Added invariant validation to `Theatre.js` camera setters
- 19 new unit tests for CameraController

### Future Integration Work
When ready to fully integrate with TheatreStage:
1. Replace `const [camera, setCamera] = useState(...)` with `useCameraController()`
2. Connect `handleWheel` from hook to canvas wheel listener
3. Update button handlers to use `zoomIn()`, `zoomOut()`, `reset()`

---

## Phase 2: Dual Runtime Parity ✅

### Problem
`Layer.js` (JS) and `theatre.py` (Python) implement identical behavior systems independently. Any behavior change requires updating both, with risk of drift.

### Completed Work
- [x] Add `BEHAVIOR_RUNTIME_VERSION` constant to both files
- [x] Document expected behavior for each runtime class
- [x] Create parity test that runs same inputs through both

---

## Phase 3: useAssetController Split

### Problem
- `useAssetController` in `GenericDetailView.jsx` is 800+ LOC with 25+ methods

### Proposed Extraction
```
useAssetController (orchestrator, ~100 LOC)
├── useAssetLogs (log fetching, ~50 LOC)
├── useBehaviorEditor (behavior CRUD, ~150 LOC)
├── useLayerOperations (add/remove/update, ~200 LOC)
├── useOptimization (LLM workflow, ~100 LOC)
└── useTransformEditor (position/scale/rotation, ~200 LOC)
```

---

## Phase 4: Theatre.updateAndDraw Split

### Problem
- `updateAndDraw()` is 200 LOC handling camera, layers, selection, occlusion, and telemetry

### Proposed Extraction
```javascript
updateAndDraw(dt) {
    this._applyCameraTransform();
    this._drawLayers(dt);
    this._drawSelectedLayer(dt);
    this._emitTelemetry();
}
```

---

## Phase 5: Legacy Migration Cleanup

### Locations
- `Layer._initEvents()` lines 306-336: `bob_amplitude`, `twinkle_amplitude`
- `Layer.constructor()` line 287: `reacts_to_environment`

### Pre-requisite
Run one-time asset migration script before removing code.

---

## Phase 6: Schema Validation

### Action
Add Zod schemas mirroring Pydantic models for frontend validation:
- `BehaviorSchema`
- `LayerConfigSchema`
- `SceneSchema`

---

## Original Analysis (Preserved)

### Component Sprawl
- `GenericDetailView.jsx` (60kb) - needs splitting
- `TheatreStage.jsx` (29kb) - mixes React/Canvas logic
- `Layer.js` - mixes data and rendering

### Error Logging ✅
- Created `src/web/src/utils/logger.js`
- Migrated TheatreStage, Theatre, Layer to use structured logger
