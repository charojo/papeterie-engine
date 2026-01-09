# Building the Papeterie Engine: Architecture, AI Partnership, and the Future of Coding

*A deep dive into the Toy Theatre engine's design and the Agent-in-the-Loop methodology that built it.*

---

> [!NOTE]
> This comprehensive guide consolidates our technical architecture decisions, the "Component Map" design pattern, and the evolving human-AI partnership using the "Agent-in-the-Loop" methodology.

---

## Introduction

The **Papeterie Engine** is a metadata-driven 2D animation system designed to create "Toy Theatre" style animations. But beyond the pixels, it represents a new way of building software: a partnership where an AI agent acts not just as a coder, but as a co-architect and meta-developer.

This post explores both the **System Architecture**—how we bridge natural language to physics-based animation—and the **Development Methodology** that made it possible.

---

## Part 1: The Engine Architecture

The engine is built on a strict **Compiler-Renderer** separation. This allows us to use high-powered AI for asset preparation while maintaining a lightweight, high-performance runtime for animation.

### 1.1 The High-Level Pipeline

![Detailed Pipeline Flow](../assets/diagrams/detailed_pipeline_flow.png)
*[Source: detailed_pipeline_flow.dot](../assets/diagrams/detailed_pipeline_flow.dot)*

### 1.2 The Two-Stage Gemini Pipeline

LLM outputs are notoriously creative but often unreliable with strict schemas. We solved this by splitting metadata generation into two distinct stages:

1.  **Stage 1: Creative Analysis (Gemini 2.5-Flash)**: The model analyzes the sprite's visual "vibe" and motion intent in free-form text.
2.  **Stage 2: Structured Generation (Gemini 3 Pro)**: A second pass translates that intent into a rigid JSON structure that matches our Pydantic models.

#### The Validation-Fixup Loop

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

### 1.3 Component Map Architecture (React ↔ Pygame)

The frontend uses a **Component Map Architecture**, allowing a modern React UI to control a legacy-style imperative engine (`Theatre.js`) through a shared state model.

#### State Synchronization Pattern

We avoid "two sources of truth" by using `useEffect` hooks to push React state updates into the imperative engine.

![React-Theatre State Sync](../assets/diagrams/react_theatre_sync.png)
*[Source: react_theatre_sync.dot](../assets/diagrams/react_theatre_sync.dot)*

The `useAssetController` hook acts as the central bridge, handling API persistence, selection state, and the command chain.

### 1.4 The Animation Runtime

The runtime applies modular **Behaviors** to sprite transforms every frame.

#### Timeline Synchronicity & Environmental Reactions
The `elapsedTime` is the single source of truth. The engine supports complex interactions, like a boat tilting on ocean waves, using the "Pivot on Crest" algorithm which samples the height of the "target" layer dynamically.

---

## Part 2: The AI Partnership & Methodology

Our collaboration evolved through three distinct phases as the project's complexity grew:

1.  **The Assistant**: Generating code from detailed prompts.
2.  **The Consultant**: Diagnosing complex environment issues (like WSLg lag).
3.  **The Meta-Developer**: Improving the *development process* itself (e.g., building the validation system).

### 2.1 The Agent-in-the-Loop Workflow

The engine uses a collaborative debugging partner model where the agent handles research and implementation while the human provides vision and judgment.

![Agent-in-the-Loop Workflow](../assets/diagrams/agent_in_the_loop.png)
*[Source: agent_in_the_loop.dot](../assets/diagrams/agent_in_the_loop.dot)*

### 2.2 Prompt Memory vs. Git History

One of the most powerful aspects of this partnership is the **Prompt History**. It serves as a **Catastrophe Recovery** layer. Even if local state is wiped, the **Intent and Reasoning** survive in the AI partner's memory, allowing for instant re-implementation and access to the *why* behind decisions.

| Feature | Git History (The *What*) | Prompt History (The *How* & *Why*) |
|---------|-------------------------|-----------------------------------|
| **Storage** | Local `.git` folder | AI Platform (Cloud) |
| **Resilience** | Wiped by local resets | Survives all local deletions |
| **Context** | Shows the final diff | Records reasoning and failed attempts |

### 2.3 Case Studies in Collaboration

*   **WSL Input Capture Lock**: The agent recognized environmental issues (WSLg display server caching) that I mistook for code bugs.
*   **Theatre Selection Size**: The agent identified a type mismatch where the Timeline sent an object but the Theatre expected a string.
*   **Drift Behavior Bug**: The agent followed a "detect-trace-hypothesize" loop to find that `drift_cap` was not enforced in the runtime `apply()` method.

---

## Part 3: Quality Assurance & Tooling

To keep the feedback loop fast, we implemented a **Tiered Validation System** and a catalog of **Agentic Workflows**.

### 3.1 Tiered Validation

![Tiered Validation System](../assets/diagrams/tiered_validation.png)
*[Source: tiered_validation.dot](../assets/diagrams/tiered_validation.dot)*

*   **Fast**: Runs only tests affected by changed lines (LOC-based gating).
*   **Full**: Pre-merge check with all tests.
*   **Exhaustive**: Release-level deep analysis.

This reduced quick fix validation time from **3 minutes to 5 seconds**.

### 3.2 Registered Agentic Workflows

We maintain a catalog of workflows in `.agent/workflows/` that the agent can execute autonomously, such as `/validate`, `/css-review`, and `/security-review`.

---

## Part 4: The Compilation Journey

Every major milestone in the Papeterie Engine was preceded by a "Compilation Session"—a deep dialogue between human intent and architectural reasoning.

| Milestone | Innovation |
|-----------|------------|
| **Project Inception** | Python-based Pydantic schema-first design. |
| **Stage 1 & 2** | Two-stage Gemini analysis and validation-fixup loop. |
| **Timeline v2** | Keyframe interpolation and real-time scrubbing. |
| **User Isolation** | Multi-tenant directory structures for assets. |

### The Compiler's Ledger

| Session Title | Context Depth | Key "Compiler Artifact" |
|---------------|---------------|-------------------------|
| **Scene Optimization** | 450 KB | `GeminiCompilerClient.decompose_scene` |
| **Unified Location** | 320 KB | `LocationRuntime` & Interp Logic |
| **Stability Playbook** | 850 KB | 6-Phase Stability Playbook |
| **Selection Sync** | 180 KB | `useAssetController` selection bridge |

---

## Conclusion

The Papeterie Engine architecture demonstrates that you don't have to choose between modern web flexibility and high-performance imperative rendering. By using a strictly defined metadata contract and a bidirectional sync bridge, we created a tool that is both AI-smart and manually precise.

But more importantly, it proved that the **Human-AI Partnership** allows us to move from "coding" to "architecting"—delegating the tedious parts to build faster, smarter, and with greater resilience.

---

*Published: January 9, 2026*
