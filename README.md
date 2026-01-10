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

---

## 📖 Blog Timeline: How This Project Matured

This project was developed with an AI coding agent as a collaborative partner. The following blog posts document key phases of the architecture effort:

| Date | Post | Focus |
|------|------|-------|
| 2026-01-09 | [Component Map Architecture](docs/blogs/2026-01-09-component-map-architecture.md) | Frontend-backend communication, Theatre.js engine, state synchronization |
| 2026-01-09 | [Integration Pattern: Gemini API](docs/blogs/2026-01-09-integration-pattern-gemini-api.md) | LLM validation-fixup loop, two-stage analysis, async patterns |
| 2026-01-09 | [The AI Partnership](docs/blogs/2026-01-09-ai-partnership-debugging.md) | Agent-in-the-loop debugging, mindset shift from coder to thought partner |
| 2026-01-09 | [QA System & Workflows](docs/blogs/2026-01-09-qa-system-tests-workflows.md) | Tiered validation, agentic workflows, QA reasoning loops |

These posts serve as both:
- **Developer onboarding**: Understand the architecture and design decisions
- **Process documentation**: How AI-assisted development shaped the codebase

---

## 🤖 AI Interaction Protocol
This project uses an `AGENTS.md` file to maintain persistent context for LLM collaborators. When working with Gemini, ensure **Agent Mode** is active to allow full-repository awareness. See the \"AI Agent Initialization\" section in **[HOWTO_Develop.md](docs/HOWTO_Develop.md)** for details.

