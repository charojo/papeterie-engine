# UI Overhaul & Workflow Refinement (Jan 2026)

## 1. Context & Problem Statement
The current Papeterie Engine UI utilizes a persistent left sidebar for navigation between scenes and sprites. This design has several drawbacks:
-   **Visual Clutter**: The sidebar consumes valuable horizontal screen real estate, limiting the "theatre" feel.
-   **Context Switching**: Editing a sprite often requires navigating away from the scene to a dedicated "Sprite Detail View", which loses the context of how that sprite fits into the scene.
-   **Navigation Friction**: The list of all sprites and scenes becomes unwieldy as the project grows.

## 2. Proposed Solution
We will refactor the UI to be **Scene-Centric**. The "Scene" is the primary document, and sprites are assets that are brought *into* the scene.

### 2.1 Core Navigation Changes
-   **Remove Sidebar**: The left-hand sidebar will be removed entirely.
-   **File Menu Pattern**: Scene selection will move to a top-level "Open" / "Open Recent" menu (accessed via the settings/hamburger menu or a dedicated top bar).
-   **Default View**: The application will default to the last opened scene (or an empty state/welcome screen), maximizing the canvas area.

### 2.2 Sprite Management Workflow
-   **Sprite Library Dialog**: Instead of a list in the sidebar, user clicks "Add Sprite" in the Scene Detail view. This opens a modal dialog to search, filter, and select sprites to add to the current scene.
-   **Contextual Editing**: The dedicated "Sprite Detail View" will be deprecated. Sprite configuration (metadata, behaviors) will happen *only* within the context of the Scene, selecting the sprite layer in the Scene View.
-   **Sprite Creation**: "New Sprite" flow will be triggered from the Sprite Library Dialog or the "File" menu, but will immediately prompt for adding it to the current scene or just saving it to the library.

### 2.3 Image Viewer & Manipulation Enhancements
The `ImageViewer` (and `TheatreStage` overlay) will receive significant upgrades to support precise composition:
-   **Scale Mode**: A specific tool state where the selected sprite displays draggable corner handles for resizing.
-   **Background Overlay**: A toggleable guide overlay showing the target resolution (e.g., 1920x1080) relative to the sprite, helping users judge scale without playing the scene.
-   **Contextual Toolbar**: Tools like "Hide", "Remove", and "Scale" will appear directly in the viewer toolbar, and will be:
    -   **Active**: When a sprite is selected and scene is paused.
    -   **Disabled/Grayed**: When the scene is playing (to prevent conflicts with physics engine).

## 3. Detailed Component Design

### 3.1 App Layout (`App.jsx`)
```jsx
<div className="app-container">
  <TopBar>
     <AppTitle />
     <OpenMenu />
     <SettingsMenu />
  </TopBar>
  <MainContent>
     {/* Scene Detail View or Welcome Screen */}
  </MainContent>
</div>
```

### 3.2 Sprite Library Dialog
A modal containing:
-   Search input (debounced).
-   Grid grid of sprite thumbnails.
-   "Add" button on hover.
-   "Upload New" button.

### 3.3 Scale Widget
Implemented within `ImageViewer` / `TheatreStage`:
-   **Visuals**: 4 corner handles (square dots) connected by a bounding box border.
-   **Interaction**: Dragging a handle updates `scale` (and potentially `x_offset`/`y_offset` to maintain center if desired, though simple scaling usually anchors to center).
-   **Constraint**: Shift-drag to preserve aspect ratio (default for sprites usually, but explicit locking might be needed).

## 4. Migration Strategy
1.  **Phase 1 (Layout)**: Remove sidebar, implement `TopBar` and `OpenMenu`.
2.  **Phase 2 (Dialogs)**: Implement `SpriteLibraryDialog` and connect to `GenericDetailView`.
3.  **Phase 3 (Tools)**: Enhance `ImageViewer` with Scale Widget and Overlays.
4.  **Phase 4 (Cleanup)**: Remove legacy Sprite routing and Sidebar components.
