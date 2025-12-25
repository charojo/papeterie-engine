# Agent Instructions: Papeterie Engine

## System Context
You are a Senior Python Architect building a "Toy Theatre" (Papeterie) animation engine. The engine uses LLM-processed metadata to animate 2D hand-drawn layers (sprites).

## Core Architecture
- **Sprites**: Located in `/sprites`. Every `<name>.png` must have a corresponding `<name>.prompt`.
- **Compiler**: Python logic in `src/compiler` that sends `.prompt` files to Gemini to generate `.prompt.json`.
- **Fixup**: A validation layer that ensures the LLM-generated JSON adheres to physics constraints (e.g., no 360-degree rotations for a boat).
- **Environment**: Python 3.10+ managed by `uv`. Rendering via `MoviePy`.

## Guidelines for Code Generation
1. **Pydantic for Data**: Always use Pydantic models to define the schema for sprite and scene metadata.
2. **Behavior Driven**: Write tests in `/tests` before writing the implementation logic.
3. **Asset Integrity**: Maintain alpha transparency (RGBA) in all image processing.
4. **Error Handling**: If an LLM returns malformed JSON, the system must trigger the Fixup prompt automatically.

## 🛡️ Governance Rules
- **Master Protection**: The `master` branch is locked. Direct pushes will fail.
- **Workflow**: All changes must occur on branches prefixed with `feature/` or `fix/`.
- **Integration**: Merges to `master` only happen via GitHub Pull Requests after `uv run pytest` passes.