from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
from app.core.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables on startup."""
    # Import all models to ensure they are registered with Base.metadata
    import app.models.customer         # noqa: F401
    import app.models.payment          # noqa: F401
    import app.models.subscription     # noqa: F401
    import app.models.invoice          # noqa: F401
    import app.models.webhook_event    # noqa: F401
    import app.models.recovery_case    # noqa: F401
    import app.models.ai_recommendation  # noqa: F401
    import app.models.policy_decision  # noqa: F401
    import app.models.intervention     # noqa: F401
    import app.models.audit_event      # noqa: F401
    import app.models.promise_to_pay   # noqa: F401
    import app.models.policy_rule      # noqa: F401
    import app.models.checkout_session # noqa: F401
    async with engine.begin() as conn:

        await conn.run_sync(Base.metadata.create_all)
