from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import ASSETS_DIR, CORS_ORIGINS, LOGS_DIR
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Intercept .prompt.json requests to handle 404s gracefully
@app.get("/assets/users/{user_id}/sprites/{sprite_name}/{filename}")
async def get_sprite_asset(user_id: str, sprite_name: str, filename: str):
    file_path = ASSETS_DIR / "users" / user_id / "sprites" / sprite_name / filename
    if filename.endswith(".prompt.json") and not file_path.exists():
        return {}  # Return empty JSON instead of 404

    if not file_path.exists():
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Asset not found")

    from fastapi.responses import FileResponse

    return FileResponse(file_path)


# Mount static files
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

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
    return {"message": "Papeterie Engine API is running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.server.main:app", host="0.0.0.0", port=8000, reload=True)
