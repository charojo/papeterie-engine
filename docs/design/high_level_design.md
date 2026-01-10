This design document outlines the architecture for the **Papeterie Engine**, a 2D "Toy Theatre" animation system that uses AI-processed metadata to animate hand-drawn layers with realistic physics-based environmental reactions.

> **📖 Technical Deep-Dives**
> 
> For detailed architectural walkthroughs, see the [blog posts](../blogs/):
> - [Consolidated Blogs](../blogs/) — Technical deep-dives and development history

---

## 🎭 Papeterie Engine: System Design

### 1. Architectural Overview


The system is divided into two primary domains: the **Compiler Pipeline**, which handles AI-driven asset preparation, and the **Theatre Runtime**, which executes the parallax rendering and physics simulations.

* **Compiler Pipeline:** Uses Gemin to transform natural language descriptions into structured `SpriteMetadata` and `SceneConfig`.
* **Validation Layer:** Employs Pydantic models in `models.py` to enforce strict schema adherence and physical constraints.
* **Theatre Runtime:** A `pygame`-based engine (backend) and a React-based engine (frontend) that handle parallax scrolling, oscillations, and environmental reactions.
* **Data Persistence:** A SQLite database managing users, assets, and permissions.

---

### 2. Core Components

#### A. Data Models (`models.py`)

The engine is "Schema-First," using Pydantic to ensure all data moving through the system is valid.

* **`SpriteMetadata`**: Defines the intrinsic properties of an asset (z-depth, behaviors).
* **`SceneConfig`**: The master manifest for a scene, acting as the "Stage Script."
* **`BehaviorConfig`**: A modular system for defining animations (Oscillate, Drift, Pulse, etc.).

#### B. The Compiler (`engine.py` & `gemini_client.py`)

The `SpriteCompiler` orchestrates the relationship between the developer and the LLM via a specialized two-stage pipeline.

* **Two-Stage LLM Pipeline** (Partial Implementation):
    1. **Descriptive Analysis**: Gemini 2.5-Flash analyzes raw sprites and scenes to generate a natural language description of their intended "vibe" and motion. (Implemented in client, pending engine integration)
    2. **Structured Generation**: Gemini 3 Pro translates these descriptions into rigid `JSON` metadata that conforms to the Pydantic models. (Implemented in client, pending engine integration)
* **The Fixup Loop**: If the LLM returns malformed JSON or invalid physics, the engine automatically triggers a `MetaFixupPrompt` to repair the data.

#### C. Local Image Processing (`local_processor.py`)

The engine supports **Local** and **LLM** processing modes for image extraction:

*   **Local (Default)**: Uses `LocalImageProcessor` for $0 cost sprite/background extraction via rembg + OpenCV. See Section 5 (Technology Stack) for library details.
*   **LLM**: Uses Gemini 3 Pro Image for higher quality at API cost.

#### D. The Theatre (`theatre.py` & `Theatre.js`)

The runtime engine translates static metadata into dynamic movement.

* **Parallax Logic**: Layers are sorted by `z_depth`. Scrolling speeds are calculated based on these depths to create an illusion of 3D space.
* **Pivot-on-Crest Algorithm**: This physics routine samples the Y-position of a target "environment" layer (like a wave) at two points (ahead and behind the sprite) to determine the appropriate rotation (tilt).

#### E. React-Theatre Bridge

The frontend uses a bidirectional communication pattern to synchronize the React UI with the imperative Pygame-based `Theatre.js` engine.

![React-Theatre State Sync](../assets/diagrams/react_theatre_sync.png)
*[Source: react_theatre_sync.dot](../assets/diagrams/react_theatre_sync.dot)*

---

### 3. Pipeline Data Flow

The metadata pipeline ensures a reliable transition from creative intent to structured animation.

![Detailed Pipeline Flow](../assets/diagrams/detailed_pipeline_flow.png)
*[Source: detailed_pipeline_flow.dot](../assets/diagrams/detailed_pipeline_flow.dot)*

---

### 4. User-Scoped Asset Management

Assets are isolated per user to ensure privacy and security, moving away from a flat global asset structure.

*   **Directory Structure**:
    ```text
    assets/users/<user_id>/
    ├── sprites/  # User-specific sprites (.png, .prompt, .prompt.json)
    └── scenes/   # User-specific scene configurations (.json)
    ```
*   **Asset Isolation**: The backend routers enforce `user_id` checks to ensure users only access and modify their own creative work.

---

### 5. Data Persistence & Database

The engine uses a relational database to manage user-scoped metadata, providing robustness and scalability beyond simple file-based storage.

*   **Database Engine**: **SQLite** is used for its simplicity and zero-configuration requirement. The database is stored as a local file (`papeterie.db`).

#### Database Tables

##### `users` table
Stores authentication and profile data for each user.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` | Primary Key. A unique identifier for the user (UUID format). |
| `username` | `TEXT` | Unique. The user's chosen display name. |
| `email` | `TEXT` | Unique. Used for login and system notifications. |
| `password_hash` | `TEXT` | Argon2 hash of the user's password. |
| `created_at` | `TIMESTAMP` | Automatic timestamp of user registration. |

##### `assets` table
Tracks ownership and sharing status for all creative assets (sprites and scenes).

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key. Auto-incrementing identifier. |
| `user_id` | `TEXT` | Foreign Key. References `users.id` to establish ownership. |
| `asset_type` | `TEXT` | The type of asset: `'sprite'` or `'scene'`. |
| `asset_name` | `TEXT` | The base name of the asset (e.g., `'boat'`). |
| `is_shared` | `BOOLEAN` | If `1`, the asset is visible/usable by other users. |

*   **Usage & Relationships**:
    *   **Asset Isolation**: The `user_id` in the `assets` table is the primary mechanism for asset isolation. Backend routers verify that the requesting user's ID matches the owner of the asset before allowing modifications.
    *   **Mapping to Disk**: The `asset_name` and `asset_type` are used to construct the file system paths (e.g., `assets/users/<user_id>/sprites/<asset_name>/`).
    *   **Sharing Mechanism**: The `is_shared` flag allows for collaborative features where assets can be "published" to a global or group library.

*   **Detailed Design**: See [persistence_and_user_design.md](./persistence_and_user_design.md) for further implementation details on user management and asset isolation.

---

All dependencies with their versions, purposes, and usage locations. The engine uses a **centralized, dynamic configuration** strategy to handle multiple development origins (localhost vs 127.0.0.1) without hardcoded strings.

#### Web Framework & API

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **fastapi** | ≥0.128.0 | Modern async web framework for the REST API backend | `src/server/main.py`, `src/server/routers/*.py` |
| **uvicorn** | ≥0.40.0 | ASGI server for running FastAPI in production | `scripts/start_dev.sh` |
| **python-multipart** | ≥0.0.21 | Form/file upload handling for FastAPI | `src/server/routers/sprites.py`, `scenes.py` |
| **python-dotenv** | ≥1.0.0 | Environment variable management (.env files) | `src/compiler/gemini_client.py` |
| **email-validator** | ≥2.3.0 | Email validation for user registration | `src/server/auth.py` |

#### AI & LLM Integration

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **google-genai** | ≥1.56.0 | Official Google Generative AI SDK for Gemini models | `src/compiler/gemini_client.py` |

#### Image Processing (Local Mode)

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **rembg[cpu]** | ≥2.0.50 | Background removal using U2-Net AI model (ONNX) | `src/server/local_processor.py` |
| **opencv-python** | ≥4.8.0 | Image inpainting (Telea algorithm) | `src/server/local_processor.py` |
| **Pillow** | ≥11.3.0 | Image manipulation, green screen compositing | `src/server/image_processing.py`, `local_processor.py` |
| **numpy** | ≥1.26.0 | N-dimensional array operations for image data | `src/server/local_processor.py` |
| **numba** | ≥0.60.0 | JIT compilation for performance (rembg dep) | Transitive (rembg) |
| **llvmlite** | ≥0.43.0 | LLVM bindings for numba JIT | Transitive (numba) |

#### Animation & Rendering

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **pygame-ce** | ≥2.5.6 | 2D game engine for backend Theatre rendering | `src/renderer/theatre.py` |
| **moviepy** | ≥2.0.0 | Video rendering and scene export to MP4/GIF | `src/renderer/theatre.py` (planned) |

#### Data & Validation

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **pydantic** | ≥2.0.0 | Data validation and schema enforcement | `src/compiler/models.py`, `src/server/routers/*.py` |

#### Database & Persistence

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **sqlite3** | Built-in | Core database engine for user and asset metadata | `src/server/database.py` |
| **sqlite-web** | (dev) | Web-based SQLite database browser | `scripts/inspect_db.sh` |

#### Development & Testing

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **pytest** | ≥9.0.2 | Python test framework | `tests/*.py` |
| **pytest-asyncio** | ≥1.3.0 | Async test support for FastAPI | `tests/test_routers*.py` |
| **pytest-mock** | ≥3.10.0 | Mocking utilities for unit tests | `tests/*.py` |
| **pytest-cov** | ≥4.1.0 | Test coverage reporting | `scripts/validate.sh` |
| **pytest-testmon** | ≥2.1.0 | Smart test selection based on changes | `scripts/validate.sh --fast` |
| **ruff** | ≥0.1.0 | Fast Python linter and formatter | `scripts/validate.sh` |

#### Frontend (Node.js)

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| **React** | 18.x | UI component framework | `src/web/src/**/*.jsx` |
| **Vite** | 5.x | Fast dev server and bundler | `src/web/vite.config.js` |
| **Vitest** | 2.x | Frontend unit testing | `src/web/src/**/*.test.jsx` |
| **TailwindCSS** | 3.x | Utility-first CSS framework | `src/web/src/index.css` |

---

### 6. Asset Logging & Status Tracking

The `AssetLogger` tracks the progression of an asset through its lifecycle, providing real-time feedback to the user.

*   **Status Transitions**:
    1. **Importing**: File is uploaded to the server.
    2. **Optimizing**: The Two-Stage LLM Pipeline is processing the asset.
    3. **Ready**: Metadata is generated and the asset is ready for the theatre.
*   **Telemetry**: Logs are stored per asset and user, allowing the frontend to display progress bars and status indicators.

---

### 7. Technical Constraints & Rules

*   **Asset Integrity**: All image processing must maintain **RGBA alpha transparency**.
*   **Environment**: Built for **Python 3.10+** using `uv` and **Node.js 20+**.
*   **Governance**: All changes must pass `scripts/validate.sh` and occur on feature branches.

### 9. Methodology: The AI Partnership

This project is built on an **Agent-in-the-Loop** methodology where the AI partner is treated as a thought partner and infrastructure architect, not just a code generator.

#### A. Prompt Memory vs. Git History

| Feature | Git History (The *What*) | Prompt History (The *How* & *Why*) |
|---------|-------------------------|-----------------------------------|
| **Storage** | Local `.git` folder | AI Platform (Cloud) |
| **Resilience** | Wiped by `git reset --hard` | Survives all local file deletions |
| **Context** | Shows the final diff | Records reasoning and failed attempts |

#### B. Reasoning Loops

The agent employs structured chain-of-thought processing when debugging or implementing complex features, ensuring that architectural integrity is maintained even through rapid iterations.

---

### 10. Token Usage & Cost Tracking

*   **Persistence**: All token counts are recorded in `logs/token_ledger.csv`.
*   **Transparency**: Each entry includes a timestamp, the task name, and the specific model used.

---

### **9. Class Relationships (PlantUML)**

![Class Relationships](../assets/diagrams/class_relationships.png)

---

### **10. System Architecture (Dual-Backlog)**

![System Architecture](../assets/diagrams/system_architecture.png)
*(Source: [system_architecture.dot](../assets/diagrams/system_architecture.dot))*

### 11. Deployment Strategy

The engine is designed for dual deployment:
*   **Local**: Single-user, zero-latency development.
*   **Cloud (PythonAnywhere)**: Multi-user, hosted environment for sharing.

For detailed deployment architecture, see [`deployment.md`](./deployment.md) and [`persistence_and_user_design.md`](./persistence_and_user_design.md).
