from fastapi import APIRouter
from datetime import datetime

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Revenue Recovery OS",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/")
async def root():
    return {
        "service": "Revenue Recovery OS API",
        "tagline": "Detect the leakage. Decide the recovery. Recover the revenue.",
        "docs": "/docs",
        "health": "/health",
    }
