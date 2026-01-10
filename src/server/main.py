from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import ASSETS_DIR, CORS_ORIGINS, LOGS_DIR, PROJECT_ROOT
from src.server.database import init_db
from src.server.logger import setup_server_logger
from src.server.routers import auth, behaviors, prompts, scenes, sounds, sprites, system

# Setup logging
logger = setup_server_logger(LOGS_DIR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    # Startup
    init_db()
    yield
    # Shutdown (nothing needed currently)


app = FastAPI(title="Papeterie Engine Editor", lifespan=lifespan)


# Intercept .prompt.json requests to handle 404s gracefully
@app.get("/assets/users/{user_id}/sprites/{sprite_name}/{filename}")
async def get_sprite_asset(user_id: str, sprite_name: str, filename: str, request: Request):
    file_path = ASSETS_DIR / "users" / user_id / "sprites" / sprite_name / filename
    if filename.endswith(".prompt.json") and not file_path.exists():
        return {}  # Return empty JSON instead of 404

    if not file_path.exists():
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Asset not found")

    from fastapi.responses import FileResponse

    response = FileResponse(file_path)
    # Manually add CORS for static assets that bypass middleware or hit this interceptor
    # Check all common casing for Origin header
    origin = None
    for k, v in request.headers.items():
        if k.lower() == "origin":
            origin = v
            break

    # Robust check against allowed origins
    is_allowed = False
    if origin:
        clean_origin = origin.rstrip("/").lower()
        clean_allowed = [o.rstrip("/").lower() for o in CORS_ORIGINS]

        if clean_origin in clean_allowed:
            is_allowed = True
        elif clean_origin.startswith("http://localhost:") or clean_origin.startswith(
            "http://127.0.0.1:"
        ):
            # Allow any local port for dev if it's the right IP/hostname
            is_allowed = True
        elif clean_origin == "null":  # Handle some edge cases
            is_allowed = True

    if is_allowed:
        # Use the actual origin provided if it's allowed
        response.headers["Access-Control-Allow-Origin"] = origin or CORS_ORIGINS[0]
    else:
        # Fallback for local development or if no origin
        # If we are here, something is wrong with the match.
        # Let's try to be smart about what we return.
        if origin:
            # Check if it looks like a local request anyway
            if "127.0.0.1" in origin or "localhost" in origin:
                response.headers["Access-Control-Allow-Origin"] = origin
            else:
                logger.warning(
                    f"CORS blocked for {filename}. Origin: '{origin}'. Allowed: {CORS_ORIGINS}"
                )
                response.headers["Access-Control-Allow-Origin"] = CORS_ORIGINS[0]
        else:
            response.headers["Access-Control-Allow-Origin"] = CORS_ORIGINS[0]

    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# Mount static files
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(sprites.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(behaviors.router, prefix="/api")
app.include_router(sounds.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")


@app.get("/")
async def root():
    # If the SPA is built, serve it at the root
    if DIST_DIR.exists():
        from fastapi.responses import FileResponse

        return FileResponse(DIST_DIR / "index.html")
    return {"message": "Papeterie Engine API is running"}


# --- SPA Serving & Fallback ---
# If the 'dist' directory exists (production build), we can serve it.
# In PythonAnywhere, /ui_assets will be handled by Nginx, but we need this for:
# 1. Local testing of the build.
# 2. Serving index.html for the fallback.

DIST_DIR = PROJECT_ROOT / "src" / "web" / "dist"

if DIST_DIR.exists():
    # Mount the UI assets for local production testing.
    # On PA, this should be handled by Nginx mapping /ui_assets -> .../dist/ui_assets
    app.mount("/ui_assets", StaticFiles(directory=str(DIST_DIR / "ui_assets")), name="ui_assets")

    # Catch-all route for SPA fallback
    # Must be the very last route defined
    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        # Allow API calls to 404 naturally if they don't match
        if full_path.startswith("api/"):
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="API endpoint not found")

        # For everything else (frontend routes), serve index.html
        from fastapi.responses import FileResponse

        return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.server.main:app", host="0.0.0.0", port=8000, reload=True)
