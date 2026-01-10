# Undo/Redo System Design

## Overview
This document outlines the design for substituting confirmation dialogs (e.g., for deletion) with a robust Undo/Redo system. The goal is to improve user flow by making actions optimistic and reversible, rather than blocking the user with "Are you sure?" prompts.

## Core Architecture: Command Pattern

The system will leverage the **Command Pattern** to encapsulate all user actions as objects that can be executed and reversed.

### 1. `Command` Interface
Every reversible action must implement a standard interface:
- **`execute()`**: Performs the action (optimistically updates UI, then syncs with backend).
- **`undo()`**: Reverts the state to before the action was taken.
- **`redo()`**: Re-applies the action (usually calling `execute()` again).

### 2. `HistoryManager`
A centralized service (React Context or Hook) to manage the stacks:
- **`undoStack`**: Array of executed commands.
- **`redoStack`**: Array of undone commands.

**logic:**
- When a new command is executed:
  - Call `command.execute()`.
  - Push to `undoStack`.
  - Clear `redoStack`.
- When `undo()` is triggered:
  - Pop from `undoStack`.
  - Call `command.undo()`.
  - Push to `redoStack`.
- When `redo()` is triggered:
  - Pop from `redoStack`.
  - Call `command.execute()`.
  - Push to `undoStack`.

### 3. Backend Synchronization
Since the application uses a decoupled frontend/backend:
- **Optimistic UI**: The frontend state updates immediately.
- **Snapshotting**: Commands should store a snapshot of the *relevant* data structure *before* the change.
  - *Example*: `RemoveSpriteCommand` stores the full `SceneLayer` configuration of the sprite being removed.
- **Sync**: `undo()` works by restoring the local snapshot and sending a `PUT` request to the backend with the restored config.

## Implementation Details for Specific Actions

### A. Deleting a Sprite Layer (Scene Context)
- **Current Flow**: `confirm()` -> `PUT /scenes/{name}/config` (with layer removed).
- **New Command**: `RemoveLayerCommand(sceneName, spriteName, currentConfig)`
  - **Execute**: Filter out layer locally, `PUT` updated config.
  - **Undo**: Insert layer back into config at original index, `PUT` updated config.

### B. Modifying Behaviors
- **Current Flow**: Direct `PUT` update.
- **New Command**: `UpdateBehaviorsCommand(assetName, oldBehaviors, newBehaviors)`
  - **Execute**: Set new behaviors, `PUT`.
  - **Undo**: Set old behaviors, `PUT`.

### C. Deleting an Asset (Global)
- **Challenge**: If an entire file is deleted via `DELETE /sprites/{name}`, undoing requires restoring the file.
- **Strategy**:
  - *Option 1 (Soft Delete)*: Move file to a `.trash/` folder on backend. `Undo` moves it back.
  - *Option 2 (Re-upload)*: Client keeps the full JSON/Image data in memory (risky if page reload).
  - *Recommendation*: Implement a "Trash" folder concept on the backend for safer restore.

## UI/UX Integration

1.  **Global Keyboard Shortcuts**: `Ctrl+Z` (Undo), `Ctrl+Shift+Z` / `Ctrl+Y` (Redo).
2.  **Toast Notification**: When a destructive action occurs (e.g., delete), show a Toast with an "Undo" button.
    - *Message*: "Sprite 'Boat' removed. [Undo]"
    - This provides immediate visibility of the safety net.
3.  **History Panel (Optional)**: A visual list of the stack (e.g., "Moved Boat", "Changed Opacity").

## Next Steps
1.  **Scaffold `HistoryContext`**: Create the provider and hooks.
2.  **Refactor `GenericDetailView`**:
    - Replace direct API calls with `executeCommand(new RemoveLayerCommand(...))`.
3.  **Implement 'Trash' Backend**: Update `DELETE` endpoints to support soft-deletion or build a recovery mechanism for full asset deletion.
