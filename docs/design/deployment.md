# Deployment Design: PythonAnywhere

This document outlines the architecture and design decisions for deploying the Papeterie Engine to PythonAnywhere.

## Context

The Papeterie Engine is currently a local-first application. To enable wider access and easier sharing, we are moving towards a cloud-hosted deployment on PythonAnywhere. This platform was chosen for its strong Python support and ease of use for small-scale applications.

## Architecture

The deployment consists of three main components:
1.  **Frontend (React/Vite)**: Built as static assets (HTML/CSS/JS) and served by the web server.
2.  **Backend (FastAPI)**: Running as a WSGI application via PythonAnywhere's infrastructure.
3.  **Database (SQLite/MySQL)**: Persistent storage for scenes and sprites.

![Deployment Diagram](../assets/diagrams/deployment.png)
*(Source: [deployment.dot](../assets/diagrams/deployment.dot))*

### Key Decisions

#### 1. Separation of Concerns
We will serve the frontend as static files. While FastAPI can serve static files, it is more efficient to let Nginx (managed by PythonAnywhere's "Static Files" configuration) handle this.
- **URL `/`**: Serves `index.html` and assets.
- **URL `/api`**: Proxies to the FastAPI backend.

#### 2. Database
- **Initial**: SQLite for simplicity. It works well on PythonAnywhere's persistent disk.
- **Future**: MySQL if concurrency becomes an issue. PythonAnywhere provides managed MySQL.

#### 3. Environment Variables
Secrets (like Gemini API keys) must be stored in the `.env` file or PythonAnywhere's environment variable configuration, NOT in the code.

## Challenges & Mitigations

| Challenge | Mitigation |
| :--- | :--- |
| **WSGI Compatibility** | FastAPI is ASGI. We need `a2wsgi` or similar adapter to run it on PythonAnywhere's standard WSGI implementation. |
| **Static Build** | The frontend must be built (`npm run build`) locally or in a CI pipeline before upload. |
| **Asset Paths** | Vite base path must be configured correctly so assets load relative to the domain root. |

