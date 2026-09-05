"""
Metrics aggregation — all numbers computed from DB, never hardcoded.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.recovery_case import RecoveryCase
from app.models.audit_event import AuditEvent
from app.models.intervention import Intervention
from app.models.policy_decision import PolicyDecision

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("")
@router.get("/overview")
async def overview_metrics(db: AsyncSession = Depends(get_db)):
    # Total revenue at risk
    at_risk = await db.scalar(
        select(func.coalesce(func.sum(RecoveryCase.amount_at_risk), 0))
    )
    recovered = await db.scalar(
        select(func.coalesce(func.sum(RecoveryCase.amount_recovered), 0))
    )
    active_cases = await db.scalar(
        select(func.count(RecoveryCase.id)).where(
            RecoveryCase.status.in_(["OPEN", "IN_PROGRESS", "ESCALATED"])
        )
    )
    total_cases = await db.scalar(select(func.count(RecoveryCase.id)))
    recovered_cases = await db.scalar(
        select(func.count(RecoveryCase.id)).where(RecoveryCase.status == "RECOVERED")
    )
    escalated_cases = await db.scalar(
        select(func.count(RecoveryCase.id)).where(RecoveryCase.status == "ESCALATED")
    )
    blocked_actions = await db.scalar(
        select(func.count(PolicyDecision.id)).where(PolicyDecision.decision == "BLOCK")
    )
    total_interventions = await db.scalar(select(func.count(Intervention.id)))

    recovery_rate = (
        (float(recovered) / float(at_risk) * 100) if at_risk and float(at_risk) > 0 else 0.0
    )

    return {
        "revenue_at_risk": float(at_risk or 0),
        "revenue_recovered": float(recovered or 0),
        "recovery_rate": round(recovery_rate, 2),
        "active_cases": int(active_cases or 0),
        "total_cases": int(total_cases or 0),
        "recovered_cases": int(recovered_cases or 0),
        "escalated_cases": int(escalated_cases or 0),
        "blocked_actions": int(blocked_actions or 0),
        "total_interventions": int(total_interventions or 0),
    }


@router.get("/by-scenario")
async def metrics_by_scenario(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            RecoveryCase.scenario_type,
            func.count(RecoveryCase.id).label("case_count"),
            func.coalesce(func.sum(RecoveryCase.amount_at_risk), 0).label("amount_at_risk"),
            func.coalesce(func.sum(RecoveryCase.amount_recovered), 0).label("amount_recovered"),
        ).group_by(RecoveryCase.scenario_type)
    )
    rows = result.all()
    return [
        {
            "scenario_type": r.scenario_type,
            "case_count": r.case_count,
            "amount_at_risk": float(r.amount_at_risk),
            "amount_recovered": float(r.amount_recovered),
        }
        for r in rows
    ]


@router.get("/by-root-cause")
async def metrics_by_root_cause(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            RecoveryCase.root_cause,
            func.count(RecoveryCase.id).label("case_count"),
            func.coalesce(func.sum(RecoveryCase.amount_at_risk), 0).label("amount_at_risk"),
            func.coalesce(func.sum(RecoveryCase.amount_recovered), 0).label("amount_recovered"),
        ).group_by(RecoveryCase.root_cause)
        .order_by(func.count(RecoveryCase.id).desc())
    )
    rows = result.all()
    return [
        {
            "root_cause": r.root_cause,
            "case_count": r.case_count,
            "amount_at_risk": float(r.amount_at_risk),
            "amount_recovered": float(r.amount_recovered),
        }
        for r in rows
    ]


@router.get("/recent-activity")
async def recent_activity(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AuditEvent)
        .order_by(AuditEvent.timestamp.desc())
        .limit(30)
    )
    events = result.scalars().all()
    import json
    return [
        {
            "id": e.id,
            "case_id": e.case_id,
            "timestamp": e.timestamp.isoformat(),
            "event_type": e.event_type,
            "actor": e.actor,
            "action": e.action,
            "reason": e.reason,
        }
        for e in events
    ]
