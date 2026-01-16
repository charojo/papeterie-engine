# CSS Refactoring & Design System Roadmap

## Problem Statement
The current CSS architecture suffers from fragmentation, leading to "oddities" and inconsistent design. Specifically:
- **Duplication**: Modal overlays, dialog containers, and form inputs are redefined in multiple component-specific CSS files (e.g., `ExportDialog.css` vs `DeleteConfirmationDialog.css` vs `StatusStepper.css`).
- **Inconsistency**: Slight variations in padding, shadows, and z-indexes create a disjointed user experience.
- **Maintenance Overhead**: Changing a core visual style (like a primary button color or border radius) requires updates across many files.

## Strategic Goals
1.  **Consolidate Global Patterns**: Extract common UI patterns (Dialogs, Cards, Forms) into `index.css` or dedicated global modules.
2.  **Enforce Design System Tokens**: Ensure all styles use CSS variables (`--color-*`, `--shadow-*`) strictly, avoiding hardcoded values.
3.  **Reduce Specificity**: Move away from per-component overrides for generic elements.

## Roadmap Phases

### Phase 1: The Dialog & Modal Unification
**Goal**: Replace ad-hoc modal styles with a shared `.modal-*` system.

- [x] **Audit**: Identify all modal implementations (Export, Delete, maybe others like Asset Picker).
- [x] **Define Global Classes**:
    - `.modal-overlay`: Standardize z-index (1000?), generic backdrop filter, and background color.
    - `.modal-container`: Standardize border-radius, background, border, and shadow.
    - `.modal-header`, `.modal-body`, `.modal-footer`: Standardize layout and padding.
- [x] **Refactor**: Update components to use these global classes and delete their specific CSS files (or drastically reduce them).

### Phase 2: Form & Input Standardization
**Goal**: Create a robust set of form controls.

- [/] **Standardize `.input`**: Ensure `ExportDialog` inputs and global Inputs match.
- [/] **Standardize Labels**: Create a global `.form-label` to replace `.form-group label`.
- [/] **Unified Validation Styles**: Global `.error-msg` and `.status-text`.

### Phase 3: Typography & Iconography
**Goal**: Consistent text hierarchy.

- [ ] **Headers**: Ensure `h1`-`h3` usage is consistent with `index.css`.
- [ ] **Text Colors**: Enforce `--color-text-muted` vs `--color-text-subtle` usage consistently.
- [ ] **Icons**: Standardize icon button sizes and hover states (merge `.btn-icon` variations).

### Phase 4: Utility Cleanup
**Goal**: Review `index.css` utilities.

- [ ] **Review Manual Utilities**: `index.css` contains manual utility classes (e.g., `.flex-col`, `.top-0`). Evaluate if these should be kept, expanded, or replaced with a formal utility class system.
- [ ] **Remove Redundancy**: Remove unused utilities.

## Immediate Next Step: Phase 2 (Forms)
Phase 1 is complete. We should now focus on **Phase 2** to ensure all form inputs across the app (Login, Settings, Asset Editors) use the standardized classes defined in `index.css`.
