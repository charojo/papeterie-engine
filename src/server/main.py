from contextlib import asynccontextmanager

## @DOC
# ### Papeterie Engine: Backend Server
# The backend is built with **FastAPI** and serves as the primary coordination layer for:
# 1. **Scene Compilation**: Leverages Gemini to turn natural language prompts into
#    animation metadata.
# 2. **Asset Management**: Handles sprite uploads, green screen removal, and storage.
# 3. **Live Preview**: Orchestrates the rendering pipeline for the Theatre mode.
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.config import ASSETS_DIR, LOGS_DIR
from src.server.database import init_db
from src.server.logger import setup_server_logger
from src.server.middleware.cors import UnifiedCORSMiddleware
from src.server.routers import auth, behaviors, export, prompts, scenes, sounds, sprites, system

# Setup logging
logger = setup_server_logger(LOGS_DIR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    # Startup
    init_db()

    # Seed default user assets with community samples
    from src.server.dependencies import seed_user_assets

    seed_user_assets("default")

    yield
    # Shutdown (nothing needed currently)


app = FastAPI(title="Papeterie Engine Editor", lifespan=lifespan)


# Include Asset Router BEFORE mounting static files to allow interception
app.include_router(sprites.asset_router)


# Mount static files
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

# The unified CORS middleware handles both API and Assets
app.add_middleware(UnifiedCORSMiddleware)

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(sprites.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(behaviors.router, prefix="/api")
app.include_router(sounds.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
app.include_router(export.router)  # /api/export has prefix defined in router


@app.get("/")
async def root():
    return {"message": "Papeterie Engine API is running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.server.main:app", host="0.0.0.0", port=8000, reload=True)
