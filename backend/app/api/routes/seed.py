from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/api/seed", tags=["seed"])


@router.post("")
async def seed_data(count: int = Query(default=120, ge=10, le=500), db: AsyncSession = Depends(get_db)):
    """Generate synthetic recovery cases and related data."""
    from app.seed.data_generator import generate_synthetic_data
    result = await generate_synthetic_data(count, db)
    await db.commit()
    return result

