from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import ASSETS_DIR, CORS_ORIGINS, LOGS_DIR
from src.server.logger import setup_server_logger
from src.server.routers import auth, behaviors, scenes, sounds, sprites, system

# Setup logging
logger = setup_server_logger(LOGS_DIR)

app = FastAPI(title="Papeterie Engine Editor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(sprites.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(behaviors.router, prefix="/api")
app.include_router(sounds.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    from src.server.database import init_db

    init_db()


@app.get("/")
async def root():
    return {"message": "Papeterie Engine API is running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.server.main:app", host="0.0.0.0", port=8000, reload=True)
