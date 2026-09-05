import json
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.policy_rule import PolicyRule

router = APIRouter(prefix="/api/policy", tags=["policy"])


@router.get("/rules")
async def list_policy_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PolicyRule).order_by(PolicyRule.rule_type, PolicyRule.rule_key))
    rules = result.scalars().all()
    return [
        {
            "id": r.id,
            "rule_key": r.rule_key,
            "name": r.name,
            "description": r.description,
            "source": r.source,
            "source_url": r.source_url,
            "status": r.status,
            "rule_type": r.rule_type,
            "config": r.config,
            "effective_date": r.effective_date.isoformat() if r.effective_date else None,
            "last_verified": r.last_verified.isoformat() if r.last_verified else None,
        }
        for r in rules
    ]
