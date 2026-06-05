from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.coins import router as coins_router

router = APIRouter(prefix="/api")
router.include_router(health_router)
router.include_router(coins_router)