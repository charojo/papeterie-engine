# Engine Architecture & Gemini Integration: Building the Toy Theatre

*Deep-diving into the bridge between React, Pygame, and the Gemini AI Pipeline*

---

> [!NOTE]
> This post consolidates our technical architecture decisions, the "Component Map" design pattern, and the two-stage Gemini metadata compiler.

---

## Part 1: The Compiler-Renderer Architecture

The Papeterie Engine is built on a strict **Compiler-Renderer** separation. This allows us to use high-powered AI for asset preparation while maintaining a lightweight, high-performance runtime for animation.

### The Pipeline Overview

![Detailed Pipeline Flow](../assets/diagrams/detailed_pipeline_flow.svg)
*[Source: detailed_pipeline_flow.dot](../assets/diagrams/detailed_pipeline_flow.dot)*

---

## Part 2: The Two-Stage Gemini Pipeline

LLM outputs are notoriously creative but often unreliable with strict schemas. We solved this by splitting metadata generation into two distinct stages:

1.  **Stage 1: Creative Analysis (Gemini 2.5-Flash)**: The model analyzes the sprite's visual "vibe" and motion intent in free-form text.
2.  **Stage 2: Structured Generation (Gemini 3 Pro)**: A second pass translates that intent into a rigid JSON structure that matches our Pydantic models.

### The Validation-Fixup Loop

If the LLM returns invalid JSON or physically impossible parameters (e.g., an oscillation frequency of 1000Hz), the engine catches the error via Pydantic and triggers an automatic fixup:

```python
# Recursive Fixup Pattern
async def generate_metadata(self, prompt, sprite_path, attempts=3):
    try:
        raw_json = await self._call_llm(prompt)
        return SpriteMetadata.model_validate_json(raw_json)
    except ValidationError as e:
        if attempts > 0:
            return await self.fixup(raw_json, e.errors(), attempts - 1)
        raise
```

---

## Part 3: Component Map Architecture (React ↔ Pygame)

The frontend uses a **Component Map Architecture**, allowing a modern React UI to control a legacy-style imperative engine (`Theatre.js`) through a shared state model.

### State Synchronization Pattern

We avoid "two sources of truth" by using `useEffect` hooks to push React state updates into the imperative engine.

![React-Theatre State Sync](../assets/diagrams/react_theatre_sync.svg)
*[Source: react_theatre_sync.dot](../assets/diagrams/react_theatre_sync.dot)*

### The `useAssetController` Hook
This custom hook acts as the central bridge, handling API persistence, selection state, and the imperative command chain to the theatre.

---

## Part 4: The Animation Runtime

The runtime applies modular **Behaviors** to sprite transforms every frame.

### Timeline Synchronicity
The `elapsedTime` is the single source of truth. When the human scrubs the timeline in React, it sends a `setTime(t)` command to the engine, which immediately updates all behavior runtimes.

```javascript
// LocationRuntime interpolation example
static applyKeyframes(layer, elapsedTime, transform) {
    const [before, after] = findSurroundingKeyframes(layer, elapsedTime);
    if (before && after && after.interpolate) {
        const t = (elapsedTime - before.time) / (after.time - before.time);
        transform.x = lerp(before.x, after.x, t);
        transform.y = lerp(before.y, after.y, t);
    }
}
```

### Environmental Reactions: The "Pivot on Crest" Algorithm
The engine supports complex interactions, like a boat tilting on ocean waves. It samples the height of the "target" layer (the waves) at two points—the bow and stern of the boat—and calculates the tilt angle dynamically.

---

## Part 5: Technical Highlights Timeline

| Milestone | Innovation |
|-----------|------------|
| **Project Inception** | Python-based Pydantic schema-first design. |
| **Web Alpha** | The first React-Pygame bridge established. |
| **Timeline v2** | Keyframe interpolation and real-time scrubbing. |
| **Gemini Pipeline** | Two-stage analysis and validation-fixup loop. |
| **User Isolation** | Multi-tenant directory structures for assets. |

### The Compiler's Ledger: Mapping the Journey

Every major milestone in the Papeterie Engine was preceded by a "Compilation Session"—a deep dialogue between human intent and architectural reasoning.

| Session Title / Prompt ID | Commit | Commit Date | Commit Size | Context Depth (est. KB) | Key "Compiler Artifact" |
|---------------------------|--------|-------------|-------------|--------------------------|-------------------------|
| **Scene Optimization Pipeline** | `aceba04` | 2025-12-31 | +4279 / -541 | 450 KB | `GeminiCompilerClient.decompose_scene` |
| **Unified Location & Audio** | `d86e507` | 2026-01-02 | +4731 / -695 | 320 KB | `LocationRuntime` & Interp Logic |
| **Stability & UX Refactoring** | `a0d3d05` | 2026-01-04 | +2411 / -911 | 850 KB | 6-Phase Stability Playbook |
| **Interactive Timeline v2** | `9f3676f` | 2026-01-06 | +969 / -178 | 510 KB | `TimelineEditor.jsx` Core Refactor |
| **Multi-Tier Validation** | `e09c42b` | 2026-01-09 | +1277 / -197 | 240 KB | `validate.sh` (LOC-based gating) |
| **Selection Sync & Safeguards** | `1da56a0` | 2026-01-09 | +214 / -49 | 180 KB | `useAssetController` selection bridge |

---

## Conclusion

The Papeterie Engine architecture demonstrates that you don't have to choose between modern web flexibility and high-performance imperative rendering. By using a strictly defined metadata contract and a bidirectional sync bridge, we created a tool that is both AI-smart and manually precise.

---

*Published: January 9, 2026*
