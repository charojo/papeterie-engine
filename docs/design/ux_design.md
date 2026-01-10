# UX Design System

This document defines the visual design system and UX patterns for the Papeterie Engine web dashboard. It serves as the authoritative reference for maintaining consistency.

> **📖 Related**: The `/css-review` and `/ux-review` workflows are documented in [QA System & Workflows](../blogs/2026-01-09-qa-system-tests-workflows.md).

---

## 1. Design Tokens

All visual properties use CSS custom properties from [`index.css`](../../src/web/src/index.css).

### Color System

| Token | Purpose |
|-------|---------|
| `--color-bg-base` | Page/app background |
| `--color-bg-surface` | Cards, panels |
| `--color-bg-elevated` | Hover states, raised elements |
| `--color-bg-surface-glass` | Glassmorphism overlays |
| `--color-text-main` | Primary text |
| `--color-text-muted` | Secondary/helper text |
| `--color-text-subtle` | Disabled, placeholder |
| `--color-primary` | Interactive elements, accent |
| `--color-primary-glow` | Focus rings, selection |
| `--color-border` | Standard borders |
| `--color-danger` | Destructive actions |

> [!IMPORTANT]
> **Never use hardcoded colors** (`rgba()`, `#hex`) in JSX. Always use `var(--color-*)`.

### Themes

The app supports 4 themes (set via `data-theme` attribute):
- `purple` (default) - Deep violet accent
- `dark` - True dark with minimal accent  
- `light` - Bright with blue accent
- `stark` - High contrast (WCAG AAA)

---

## 2. Component Patterns

### Icon Buttons (`.btn-icon`)

Use for toolbar actions:

```jsx
<button className="btn-icon" title="Action Name">
    <Icon name="iconName" size={16} />
</button>
```

**Do NOT** override inline styles on `.btn-icon` - it breaks hover effects.

### Toolbars

| Context | Use |
|---------|-----|
| TopBar | Header bar with glass effect |
| Theatre Overlay | Use `.theatre-toolbar` class (TBD) |
| Panel Controls | Inline flex with `gap: 8px` |

### Glassmorphism (`.glass`)

For floating overlays:
```css
background: var(--color-bg-surface-glass);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

---

## 3. Known Inconsistencies

### TheatreStage Toolbars

The vertical (right) and horizontal (bottom) toolbars in `TheatreStage.jsx` currently use hardcoded styles rather than design tokens. This is tracked for refactoring.

**Current State** (48 violations):
- Hardcoded `rgba(0,0,0,0.6)` backgrounds
- Hardcoded `color: 'white'` overrides
- Inline `border-radius`, `padding` duplicated

**Target State**:
- Use new `.theatre-toolbar` CSS class
- Apply `var(--color-bg-surface-glass)` 
- Remove inline style overrides

---

## 4. Validation & Enforcement

### Automated Checks

Run regularly to catch regressions:

```bash
# CSS compliance report
./scripts/check_css_compliance.py

# Contrast standards
./scripts/check_contrast.py

# Full validation (includes both)
./scripts/validate.sh
```

### E2E UX Tests

Located in `src/web/e2e/ux_consistency.spec.js`:
- Icon sizing consistency
- Hover effect functionality
- Theme switching stability
- Visual regression snapshots

Run with: `./scripts/validate.sh --e2e`

### Development Workflow

Use `/css-review` workflow before merging UI changes.

---

## 5. Accessibility Requirements

- **Contrast**: WCAG AA minimum (4.5:1 for text)
- **Focus indicators**: All interactive elements must have visible focus
- **Keyboard nav**: Maintain logical tab order
- **Font scaling**: Use `rem` units, not `px` for text

---

## History

*Consolidated from `ui_redesign_2026.md` (Jan 2026)*

Previous design documents:
- UI Overhaul & Workflow Refinement (Jan 2026) - Removed sidebar, scene-centric layout
- Scene Editing Architecture - Behavior system, timeline editor

---

## 6. User Journey Workflow

The application follows a streamlined user flow designed to get creators into the editor as quickly as possible.

### High-Level Flow
1.  **Authentication**: Users start at the Login Screen.
    *   **Local Theater**: Direct entry to the dashboard (no credentials required).
    *   **Cloud Theater**: Standard username/password login or registration.
2.  **Dashboard**: The central hub displaying "Recent Scenes" and the option to "Create New Scene".
3.  **Scene Editor**: The core workspace where users interact with the Theatre stage, timeline, and sprite assets.

### Diagram
The following diagram illustrates the state transitions:

![User Journey Diagram](../assets/diagrams/user_journey_2026_01_09.png)
*[Source: user_journey_2026_01_09.dot](../assets/diagrams/user_journey_2026_01_09.dot)*
