# UX Guidelines: Papeterie Engine

## Core Philosophy
The Papeterie Editor aims for a **Premium Developer Tool** aesthetic. It should feel like a modern IDE or creative suite (e.g., VS Code, Unity, Adobe).

-   **Theme**: Dark Mode base (`#0f172a` Slate-900).
-   **Accent**: Violet (`#8b5cf6`).
-   **Texture**: Glassmorphism (`backdrop-filter: blur`) used for cards and overlays to create depth.

## Interaction Patterns

### 1. Asset Lifecycle (The Stepper)
Every asset moves through a defined lifecycle. This must be visualized using the `StatusStepper` component.
-   **Sprites**: `Import` -> `Optimize` (AI) -> `Configure` (Metadata) -> `Ready`
-   **Scenes**: `Import` -> `Optimize` (Decomposition) -> `Configure` (Layers) -> `Ready`

### 2. Explicit Feedback (Toasts)
Do not use `alert()`. Use `toast()` from `sonner`.
-   **Success**: Short, affirmative message (e.g., "Sprite created").
-   **Error**: Clear failure reason. If technically complex, log details to server and show generic UI error.
-   **Loading**: Use `toast.promise` for long-running async operations (like AI generation).

### 3. Consistency (Unified Detail View)
All asset detail views (Sprites & Scenes) must use the unified `GenericDetailView` component to ensure a consistent experience.
-   **Header**:
    -   Title & Status Badge (Interactive).
    -   Global Actions (Delete, Refresh).
-   **Left Column (Visuals)**:
    -   **Viewer**: Interactive Image Viewer (Zoom/Pan).
    -   **Tabs**: Toggle between Current/Original versions.
    -   **Prompt Box**: "Visual Guidance" input for optimization or generation instructions.
    -   **Actions**: Primary "Optimize/Generate" button below the prompt.
-   **Right Column (Configuration)**:
    -   **Viewer**: Read-only JSON view of the asset's metadata.
    -   **Prompt Box**: "Refine Configuration" input for AI-assisted metadata updates.
    -   **Actions**: "Update Config" button.
-   **Bottom Panel**: System Logs (Contextual to the asset).

## Iconography
Use `lucide-react` via the `<Icon />` wrapper.
-   Avoid emojis for system actions.
-   Use consistent icons for actions (e.g., `Wand2` for AI/Optimize, `Settings` for Config).
