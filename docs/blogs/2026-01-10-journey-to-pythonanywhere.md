# The Long Road to PythonAnywhere: Deploying a React + FastAPI App
## 2026-01-10

We are finally taking the Papeterie Engine to the cloud. Our target: **PythonAnywhere**.

It's a platform we've eyed for a while, but hesitated on. Why? Because the Papeterie Engine is a modern stack: a **FastAPI** backend driving a **React (Vite)** frontend. PythonAnywhere, traditionally, is a stronghold of WSGI (synchronous Python) and server-side rendering.

Would they play nice? Is this a dead end?

This blog post documents our journey, the technical hurdles we cleared, and the final architecture that made it work.

## The Challenge

1.  **FastAPI is ASGI**: PythonAnywhere natively supports WSGI. Modern Python async frameworks need an adapter.
2.  **SPA Routing**: We want "Deep Links" (e.g., `/scene/123`). Standard static file serving breaks this because `index.html` isn't served for unknown paths. We need a fallback mechanism.

## The Plan

We aren't rewriting our app. Instead, we are adapting the environment to us.

### 1. The Adapter: `a2wsgi`
To bridge the gap between FastAPI (ASGI) and PythonAnywhere (WSGI), we are using `a2wsgi`. This library allows us to wrap our async app in a WSGI container that PythonAnywhere understands.

### 2. The Hybrid SPA Strategy
We are using a hybrid serving model:
*   **Static Assets (`/assets`)**: Served directly by Nginx (via PythonAnywhere's "Static Files" tab) for maximum performance.
*   **The Fallback**: The FastAPI app itself will act as the "catch-all" handler. If a request doesn't match an API route or a static file, FastAPI will serve `index.html`. This ensures that a user visiting `/scene/sailboat` gets the React app, which then handles the routing client-side.

## Implementation Notes

We successfully implemented the plan with three key changes:

### Step 1: Dependencies & Entry Point
We added `a2wsgi` to `pyproject.toml` and created `src/wsgi.py`. This single file is the magic key for PythonAnywhere:
```python
from src.server.main import app
from a2wsgi import ASGIMiddleware
application = ASGIMiddleware(app)
```

### Step 2: The "UI Assets" Trick
We realized that `src/web/dist/assets` (Vite's default) would conflict with our API's User Content route (`/assets/...`).
**The Fix:** We updated `vite.config.js` to output to `dist/ui_assets` instead.
```javascript
build: {
  assetsDir: 'ui_assets',
},
```

### Step 3: The Fallback
In `src/server/main.py`, we implemented the logic to hold it all together.
1.  **Serve UI Assets**: Mounted `/ui_assets` to the static directory.
2.  **Serve Root**: Explicitly mapped `GET /` to `index.html`.
3.  **Catch-All**: Added a regex wildcard route `/{full_path:path}` that catches any unknown URL and serves `index.html`.

Now, whether you visit `/`, `/scene/123`, or even `/random/path`, you get the React app, which then handles the routing logic in the browser.

### Step 4: Automation
To make this repeatable, we wrote `scripts/setup_pythonAnywhere.py`. This interactive script runs *on* PythonAnywhere to:
1.  Create the virtualenv.
2.  Install dependencies.
3.  Auto-generate the correct WSGI configuration file for the user.


