# 🎭 Papeterie Engine (2025)
**An Agentic "Toy Theatre" Animation System**

Papeterie is a metadata-driven 2D animation engine that uses Gemini to translate natural language creative prompts into physics-based animation parameters. It specializes in the "Paper Theatre" aesthetic—layered 2D assets with procedural oscillatory motion and environmental physics.

![The engine in action: A paper boat riding procedural waves with slope-based tilting.](docs/assets/media/sailing.mp4)

---

## 🏗️ The Architecture
The engine follows a strict **Compiler-Renderer** separation:

1.  **The Compiler (`src/compiler`)**: 
    - Consumes `.png` sprites and `.prompt` text files.
    - Uses **Gemini 2.5-Flash** to generate structured `JSON` metadata.
    - Validates physics constraints via **Pydantic**.
2.  **The Fixup Loop**: 
    - Automatically repairs malformed or unrealistic LLM outputs using **Gemini 3 Pro**.
3.  **The Renderer (`src/renderer`)**:
    - Procedurally animates layers using **MoviePy 2.0+** and NumPy sine-wave functions.



## �� Directory Structure
- `/assets/sprites`: Source `.png` files and their generated `.prompt.json` sidecars.
- `/assets/prompts`: System instructions (MetaPrompts) for the AI.
- `/src`: Modular Python package (Compiler, Renderer, Validator).
- `/tests`: Pytest suite for behavioral validation.

## 🚀 Getting Started
Check out **[docs/HOWTO_Develop.md](docs/HOWTO_Develop.md)** for installation, environment setup, and development workflows.

## 🤖 AI Interaction Protocol
This project uses an `AGENTS.md` file to maintain persistent context for LLM collaborators. When working with Gemini, ensure **Agent Mode** is active to allow full-repository awareness. See the "AI Agent Initialization" section in **[HOWTO_Develop.md](docs/HOWTO_Develop.md)** for details.
