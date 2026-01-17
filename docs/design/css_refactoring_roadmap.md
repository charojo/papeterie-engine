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

- [x] **Standardize `.input`**: Ensure `ExportDialog` inputs and global Inputs match.
- [x] **Standardize Labels**: Create a global `.form-label` to replace `.form-group label`.
- [x] **Unified Validation Styles**: Global `.error-msg` and `.status-text`.

### Phase 3: Typography & Iconography
**Goal**: Consistent text hierarchy.

**Status**: ✅ Complete (2026-01-16)

- [x] **Headers**: h1-h3 usage audited and consistent.
- [x] **Text Colors**: Added `.text-subtle`, `.text-muted`, `.text-main`, `.text-primary` utilities.
- [x] **Icons**: Consolidated `.btn-icon` - removed 15 lines of redundant `.theatre-toolbar` overrides.

### Phase 4: Utility Cleanup
**Goal**: Review `index.css` utilities.

**Status**: ✅ Complete (2026-01-16)

- [x] **Review Manual Utilities**: Audited all utility classes for usage.
- [x] **Remove Redundancy**: Removed 8 unused utilities (`gap-lg`, `items-start`, `items-end`, `cursor-move`, `cursor-default`, `text-right`, `text-ellipsis`, `whitespace-nowrap`).

---

## Best Practices Phases (Added 2026-01-16)

### Phase 5: Specificity & `!important` Reduction
**Goal**: Eliminate specificity conflicts that require `!important`.

**Status**: ✅ Complete (2026-01-16) - Reduced from 17 → 7 uses.

- [x] **Restructure button modifiers**: Used `:where(.btn)` for base styles to reduce specificity.
- [ ] **Audit component overrides**: Find JSX `style={{}}` that fight CSS (see inline style counts below).
- [x] **Document justified uses**: 7 remaining uses are for `.no-round`, `.layer-row.selected`, `.layer-thumb` sizing.

### Phase 6: Utility Deduplication & Naming
**Goal**: Clean duplicate definitions and standardize naming conventions.

**Status**: ✅ Complete (2026-01-16)

- [x] **Remove duplicates**: Deduplicated redundant definitions like `.h-screen`, `.h-12`, `.h-14`.
- [x] **Consolidate sizing**: Unified `.w-20` and `.w-28` into a single scale.
- [ ] **Standardize naming**: Decide on Numeric (`.p-1`) vs Semantic (`.p-sm`) for the entire project.
- [ ] **Add lint rule**: Consider `stylelint` rule to prevent future duplicates.

### Phase 7: Modern CSS Architecture
**Goal**: Adopt modern CSS features for maintainability.

**Status**: ✅ Partial (2026-01-16)

- [x] **Add `@layer` structure**: Added layer declaration (reset, tokens, base, components, utilities).
- [x] **Use `:where()` for low-specificity defaults**: Implemented in Phase 5 for `.btn` base styles.
- [ ] **Consider CSS nesting**: Native nesting now supported in major browsers.

### Phase 8: Responsive Utilities
**Goal**: Add mobile/tablet/desktop breakpoint support.

**Status**: ✅ Complete (2026-01-16)

- [x] **Define breakpoints**: Added `--breakpoint-sm/md/lg/xl` tokens to `:root`.
- [x] **Add responsive utilities**: `.hidden-mobile`, `.flex-col-mobile`, `.w-full-mobile`, `.text-center-mobile`, `.hidden-tablet-up`, `.hidden-desktop`, `.show-mobile`.
- [x] **Audit components**: Foundation ready - components can now apply responsive classes as needed.

### Phase 9: Themed Scrollbars
**Goal**: Make scrollbars blend with theme colors.

**Status**: ✅ Complete (2026-01-16)

- [x] **Add scrollbar styling**: Added `::-webkit-scrollbar` and `scrollbar-color` for Firefox.
- [x] **Theme-aware colors**: Scrollbars use `--color-border`, `--color-bg-base`, `--color-text-muted`.

### Phase 10: Component Spacing Tokens
**Goal**: Replace magic numbers in components with CSS variables.

**Status**: ✅ Complete (2026-01-16)

- [x] **Define Timeline Tokens**: Added `--timeline-header-width`, `--timeline-padding-left`, etc.
- [x] **Refactor TimelineEditor**: Removed 5+ static inline styles by using these tokens and `.timeline-ruler-*` classes.
- [ ] **Sidebar Tokenization**: Apply similar logic to `SpriteListEditor`.

---

| Metric | Baseline | Current | Target |
|--------|----------|---------|--------|
| Total CSS lines | 2,100 | 2,050 | <2,500 |
| `!important` uses | 7 | 7 | <5 |
| Component CSS files | 9 | 9 | <6 |
| Duplicate utility defs | ~20 | 0 | 0 |
| Inline styles (highest) | TimelineEditor: 13 | TimelineEditor: 10 | <8 |

---

## Immediate Next Steps: E2E Stability & Final Refinement
Recent refactoring has caused visual changes in E2E snapshots.
1.  **Update Snapshots**: Run `./agent_env/bin/validate.sh --full --update-snapshots` to accept the new spacing layout.
2.  **Fix Behavior Menu Selector**: Restore `.sl-behavior-menu-item` class to `SpriteListEditor.jsx` to fix `timeline_markers.spec.js` timeout.
3.  **Phase 6 Naming**: Decide on a final project-wide naming convention for spacing utilities.
