import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api import api_router

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Aira Autonomous Revenue Recovery Platform...")
    await init_db()
    logger.info("Database initialized.")
    # Seed policy rules on first run
    from app.seed.policy_seeder import seed_policy_rules
    await seed_policy_rules()
    logger.info("Policy rules seeded.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Aira",
    description="Aira — Autonomous Revenue Recovery Platform. Detect. Diagnose. Decide. Govern. Act. Recover. Prove.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
