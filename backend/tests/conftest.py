import asyncio
from pathlib import Path

def pytest_sessionstart(session):
    """
    Ensure the test database is initialized and seeded before tests run.
    This guarantees offline deterministic test execution on fresh CI runners.
    """
    from scripts.seed_database import seed
    from app.core.database import AsyncSessionLocal, init_db
    from app.models.recovery_case import RecoveryCase
    from sqlalchemy import select

    async def _init_if_needed():
        await init_db()
        async with AsyncSessionLocal() as db_session:
            result = await db_session.execute(select(RecoveryCase).limit(1))
            if result.scalar_one_or_none() is None:
                await seed()

    asyncio.run(_init_if_needed())
