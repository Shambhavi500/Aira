from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


@router.post("/run")
async def run_evaluation(seed: int = Query(default=42), db: AsyncSession = Depends(get_db)):
    """Run batch evaluation of the full recovery pipeline against synthetic cases."""
    from app.seed.evaluator import run_batch_evaluation
    result = await run_batch_evaluation(seed, db)
    await db.commit()
    return result


@router.get("/results")
async def get_evaluation_results(db: AsyncSession = Depends(get_db)):
    """Get the most recent evaluation results."""
    from app.seed.evaluator import get_latest_results
    return await get_latest_results(db)
