"""
Deterministic Database Seeder for AIRA
──────────────────────────────────────
Initializes the SQLite schema, populates regulatory policy guardrails,
and generates synthetic recovery cases and financial records using Random seed 42.
"""

import sys
import asyncio
from pathlib import Path

# Safe encoding for cross-platform consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import init_db, AsyncSessionLocal
from app.seed.policy_seeder import seed_policy_rules
from app.seed.data_generator import generate_synthetic_data


async def seed(count: int = 150):
    print(f"[INFO] Initializing AIRA database tables...")
    await init_db()

    print("[INFO] Seeding policy guardrails...")
    await seed_policy_rules()

    print(f"[INFO] Generating {count} synthetic recovery records (Random seed 42)...")
    async with AsyncSessionLocal() as session:
        result = await generate_synthetic_data(count, session)
        await session.commit()
        print(f"[PASS] Seeding complete: {result}")


def main():
    count = 150
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            pass
    asyncio.run(seed(count))


if __name__ == "__main__":
    main()
