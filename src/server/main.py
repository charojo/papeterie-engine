from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import ASSETS_DIR, CORS_ORIGINS, LOGS_DIR
from src.server.logger import setup_server_logger
from src.server.routers import behaviors, scenes, sprites, system

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
app.include_router(sprites.router)
app.include_router(scenes.router)
app.include_router(system.router)
app.include_router(behaviors.router)


@app.get("/")
async def root():
    return {"message": "Papeterie Engine API is running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.server.main:app", host="0.0.0.0", port=8000, reload=True)
