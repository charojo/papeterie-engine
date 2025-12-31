# Agent Instructions: Papeterie Engine

## System Context
You are a Senior Python Architect building a "Toy Theatre" (Papeterie) animation engine. The engine uses LLM-processed metadata to animate 2D hand-drawn layers (sprites).

## Core Architecture
- **Sprites**: Located in `/assets/sprites`. Every `<name>.png` must have a corresponding `<name>.prompt`.
- **Compiler**: Python logic in `src/compiler` that sends `.prompt` files to Gemini to generate `.prompt.json`.
- **Fixup**: A validation layer that ensures the LLM-generated JSON adheres to physics constraints (e.g., no 360-degree rotations for a boat).
- **Environment**: Python 3.10+ managed by `uv`. Rendering via `MoviePy`.

## Guidelines for Code Generation
1. **Pydantic for Data**: Always use Pydantic models to define the schema for sprite and scene metadata.
2. **Behavior Driven**: Write tests in `/tests` before writing implementation logic.
3. **Asset Integrity**: Maintain alpha transparency (RGBA) in all image processing.
4. **Error Handling**: If an LLM returns malformed JSON, trigger the Fixup prompt automatically.
5. **Atomic Changes**: Commit small, logical changes frequently with descriptive commit messages.

## Technical Specifications
### 📐 Physics & Mathematics
- **Slope-based Tilt**: Reactive layers (like boats) calculate tilt using the slope between two points on the target layer: $tilt = \text{atan}(\text{slope}) \times \text{sensitivity}$.
- **Oscillation**: Use sine waves for "bobbing" (heave). Metadata defines `frequency` (Hz) and `amplitude` (px).

### 🌍 Coordinate Systems
- **World Space**: The horizontal position relative to the start of the scene (`scroll_x`).
- **Screen Space**: The actual pixel coordinates on the Pygame window. Conversion is usually `draw_x = x - (scroll_x * parallax_factor)`.

### 💰 Cost & Token Management
- **Ledger Recording**: All LLM calls from the engine MUST be logged to `logs/token_ledger.csv`.
- **Optimization**: Prioritize `gemini-2.5-flash` for high-volume tasks and `gemini-3-pro` only for complex fixups.
- **Master Protection**: The `master` branch is locked. Direct pushes will fail.
- **Workflow**: All changes must occur on branches prefixed with `feature/` or `fix/`.
- **Integration**: Merges to `master` only happen via GitHub Pull Requests after `uv run pytest` passes.

## Diagrams & Visuals
- **Source of Truth**: The `.dot` files in `docs/assets/diagrams/` are the authoritative source for system architecture visuals. Always read the `.dot` file to understand the system structure.
- **Generation**: After modifying any `.dot` file, you MUST run `python scripts/generate_diagrams.py` to update the corresponding `.png` images.