# Event System Design Document

## Overview

The Papeterie Engine currently relies on a flat set of parameters within `SpriteMetadata` and `SceneLayer` (e.g., `bob_amplitude`, `vertical_drift`, `twinkle_frequency`) to define animation behaviors. As the complexity of animations grows (e.g., "Bobbing Ship", "Rising Lantern"), this flat structure becomes unwieldy and limits the composability of behaviors.

This document outlines a new **Event System** that encapsulates specific animation behaviors into reusable, configurable, and assignable units called **Events**.

## Core Concepts

### 1. The Event
An **Event** is a distinct behavior module that modifies a sprite's transform (Position, Scale, Rotation, Opacity) over time or in response to triggers.

**Structure:**
```json
{
  "type": "event_type_id",
  "enabled": true,
  "parameters": {
    "param1": "value",
    "param2": "value"
  }
}
```

### 2. Event Types

We will formalize existing behaviors into the following initial Event Types:

#### A. `oscillate` (Bobbing)
Applies a sine-wave offset to the Y position or other properties.
*   **Parameters**:
    *   `frequency` (float): Cycles per second (Hz).
    *   `amplitude` (float): Maximum offset in pixels.
    *   `phase_offset` (float): radians.
    *   `coordinate` (string): "y" (default), "x", "scale", "rotation".

#### B. `drift` (Rising/Falling)
Applies a continuous linear change to a property, potentially with limits.
*   **Parameters**:
    *   `velocity` (float): Units per second (pixels/sec for pos, multiplier/sec for scale).
    *   `acceleration` (float): Units per second squared.
    *   `cap_value` (float, optional): A hard limit for the value.
    *   `cap_behavior` (string): "stop", "bounce", "trigger_event".
    *   `coordinate` (string): "y" (vertical drift), "x" (horizontal drift), "scale".

#### C. `environment_reaction` (Tilt)
Reacts to another layer's geometry.
*   **Parameters**:
    *   `target_layer` (string): Name of the environment layer.
    *   `reaction_type` (string): "pivot_on_crest".
    *   `sensitivity` (float): Multiplier for the reaction.
    *   `max_output` (float): Clamping value (e.g., max tilt angle).

#### D. `pulse` (Twinkle)
Modulates opacity or scale.
*   **Parameters**:
    *   `frequency` (float).
    *   `min_value` (float).
    *   `max_value` (float).
    *   `waveform` (string): "sine", "spike" (power sine).

### 3. Assigning Events

Events can be assigned at two levels:

1.  **Sprite Level (`.prompt.json`)**: Defines the default inherent behavior of an asset (e.g., a boat always bobs).
2.  **Scene Level (`scene.json`)**: Overrides or adds events for a specific scene instance (e.g., a boat in a storm bobs more violently).

**JSON Schema Change:**

*Old:*
```json
{
  "bob_amplitude": 10,
  "bob_frequency": 0.5,
  "vertical_drift": 20
}
```

*New:*
```json
{
  "events": [
    {
      "type": "oscillate",
      "parameters": { "frequency": 0.5, "amplitude": 10, "coordinate": "y" }
    },
    {
      "type": "drift",
      "parameters": { "velocity": 20, "coordinate": "y" }
    }
  ]
}
```

## Setup & Configuration

### Data Types (Models)
We will introduce a polymorphic `EventConfig` class in `src/compiler/models.py`.
The `SpriteMetadata` and `SceneLayer` models will be updated to include an `events: List[EventConfig]` field.
A backward-compatibility layer will be added to `SpriteMetadata` to automatically convert legacy fields (like `bob_amplitude`) into their corresponding Event representations during loading.

### Renderer Implementation
The `ParallaxLayer` (both Python and JS) will be refactored to:
1.  Initialize a pipeline of `EventRuntime` objects from the `events` config.
2.  In the `update/draw` loop, pass the current state (DT, Scroll X/Y) through this pipeline.
3.  Each Event modifies the temporary transform state (x, y, scale, rotation, alpha).

## Editor UI
To support "Viewing events in the editor... and assign effects", we will enhance the `GenericDetailView`:

1.  **Events Category**: A new section distinct from "Visuals" and "Configuration".
2.  **Event List**: Shows all active events on the sprite.
    *   **Inherited Events**: Marked as from "Sprite Source".
    *   **Scene Overrides**: Events added specifically for this scene instance.
3.  **Event Editor**: When an Event is selected, a dedicated form allows editing its parameters (Frequency, Amplitude, etc.).
4.  **Add Event**: A dropdown menu to add new behaviors (e.g., "Add Twinkle Effect").
