from fastapi import APIRouter

from .crud import router as crud_router
from .maintenance import router as maintenance_router
from .optimize import router as optimize_router

router = APIRouter(tags=["scenes"])

# Include sub-routers with appropriate prefixes if needed, but since they were all /scenes
# and the main router is mounted on nothing (in main.py probably), we need to check how it's
# included.
# Original definitions were @router.get("/scenes") etc.
# But I removed "/scenes" prefix in the sub-routers?
# Let's check crud.py: @router.get("").
# Wait, list_scenes was @router.get("/scenes").
# Optimize: @router.post("/{name}/optimize").
# So if I mount this main router with prefix="/scenes" in main.py, it would be logical.
# BUT, main.py likely imports `router` and includes it.
# If I change the prefix structure, I break the API.
#
# Original: `router = APIRouter(tags=["scenes"])`
# `@router.get("/scenes")` -> `/scenes`
#
# My sub-routers:
# crud.py: `router = APIRouter()`
# @router.get("") -> which will be... ?
#
# If I do `router.include_router(crud_router, prefix="/scenes")`, then `@router.get("")`
# becomes `/scenes`. This matches.
#
# Let's check other endpoints.
# Upload: @router.post("/scenes/upload") (Original)
# My crud.py: @router.post("/upload")
# If prefix is /scenes, it becomes `/scenes/upload`. Matches.
#
# Optimize: @router.post("/scenes/{name}/optimize") (Original)
# My optimize.py: @router.post("/{name}/optimize")
# If prefix is /scenes, it becomes `/scenes/{name}/optimize`. Matches.
#
# So, the plan is to instantiate a main router, and include sub-routers with `prefix="/scenes"`.

router.include_router(crud_router, prefix="/scenes")
router.include_router(optimize_router, prefix="/scenes")
router.include_router(maintenance_router, prefix="/scenes")
