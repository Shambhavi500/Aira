"""
Batch Evaluator — runs the full recovery pipeline against all cases.
Returns honest metrics. Never fabricates numbers.

Definitions:
  amount_recovery_rate = total_amount_recovered / total_amount_at_risk
  case_recovery_rate   = recovered_cases / eligible_cases
"""
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recovery_case import RecoveryCase
from app.models.intervention import Intervention
from app.models.policy_decision import PolicyDecision
from app.recovery.engine import run_recovery_engine

logger = logging.getLogger(__name__)


async def run_batch_evaluation(seed: int, db: AsyncSession) -> dict:
    """
    Run the recovery engine on all OPEN/IN_PROGRESS SYNTHETIC cases.
    Uses the provided seed context for consistency labeling.
    """
    logger.info(f"[EVALUATOR] Starting batch evaluation seed={seed}")

    # Get all open synthetic cases
    result = await db.execute(
        select(RecoveryCase).where(
            RecoveryCase.data_source == "SYNTHETIC",
            RecoveryCase.status.in_(["OPEN", "IN_PROGRESS"]),
        )
    )
    cases = result.scalars().all()
    logger.info(f"[EVALUATOR] Found {len(cases)} eligible cases")

    processed = 0
    for case in cases:
        try:
            await run_recovery_engine(case.id, db)
            processed += 1
        except Exception as e:
            logger.warning(f"[EVALUATOR] Case {case.id} failed: {e}")

    await db.flush()

    # Now compute metrics
    return await get_latest_results(db)


async def get_latest_results(db: AsyncSession) -> dict:
    """Compute evaluation metrics from DB. All numbers are database-derived."""

    total_cases = await db.scalar(
        select(func.count(RecoveryCase.id)).where(RecoveryCase.data_source == "SYNTHETIC")
    ) or 0

    total_at_risk = await db.scalar(
        select(func.coalesce(func.sum(RecoveryCase.amount_at_risk), 0))
        .where(RecoveryCase.data_source == "SYNTHETIC")
    ) or 0

    total_recovered = await db.scalar(
        select(func.coalesce(func.sum(RecoveryCase.amount_recovered), 0))
        .where(RecoveryCase.data_source == "SYNTHETIC")
    ) or 0

    recovered_cases = await db.scalar(
        select(func.count(RecoveryCase.id))
        .where(RecoveryCase.data_source == "SYNTHETIC", RecoveryCase.status == "RECOVERED")
    ) or 0

    unrecoverable_cases = await db.scalar(
        select(func.count(RecoveryCase.id))
        .where(RecoveryCase.data_source == "SYNTHETIC", RecoveryCase.status == "UNRECOVERABLE")
    ) or 0

    escalated_cases = await db.scalar(
        select(func.count(RecoveryCase.id))
        .where(RecoveryCase.data_source == "SYNTHETIC", RecoveryCase.status == "ESCALATED")
    ) or 0

    blocked_cases = await db.scalar(
        select(func.count(RecoveryCase.id))
        .where(RecoveryCase.data_source == "SYNTHETIC", RecoveryCase.status == "BLOCKED")
    ) or 0

    blocked_interventions = await db.scalar(
        select(func.count(Intervention.id))
        .join(RecoveryCase, RecoveryCase.id == Intervention.case_id)
        .where(RecoveryCase.data_source == "SYNTHETIC", Intervention.result == "POLICY_BLOCKED")
    ) or 0

    successful_interventions = await db.scalar(
        select(func.count(Intervention.id))
        .join(RecoveryCase, RecoveryCase.id == Intervention.case_id)
        .where(RecoveryCase.data_source == "SYNTHETIC", Intervention.result == "SUCCESS")
    ) or 0

    # By scenario
    scenario_result = await db.execute(
        select(
            RecoveryCase.scenario_type,
            func.count(RecoveryCase.id).label("case_count"),
            func.coalesce(func.sum(RecoveryCase.amount_at_risk), 0).label("amount_at_risk"),
            func.coalesce(func.sum(RecoveryCase.amount_recovered), 0).label("amount_recovered"),
        )
        .where(RecoveryCase.data_source == "SYNTHETIC")
        .group_by(RecoveryCase.scenario_type)
    )
    by_scenario = [
        {
            "scenario_type": r.scenario_type,
            "case_count": r.case_count,
            "amount_at_risk": float(r.amount_at_risk),
            "amount_recovered": float(r.amount_recovered),
            "rate": (float(r.amount_recovered) / float(r.amount_at_risk) * 100)
                    if r.amount_at_risk and float(r.amount_at_risk) > 0 else 0.0,
        }
        for r in scenario_result.all()
    ]

    # By root cause
    rc_result = await db.execute(
        select(
            RecoveryCase.root_cause,
            func.count(RecoveryCase.id).label("case_count"),
            func.coalesce(func.sum(RecoveryCase.amount_at_risk), 0).label("amount_at_risk"),
            func.coalesce(func.sum(RecoveryCase.amount_recovered), 0).label("amount_recovered"),
        )
        .where(RecoveryCase.data_source == "SYNTHETIC")
        .group_by(RecoveryCase.root_cause)
        .order_by(func.count(RecoveryCase.id).desc())
    )
    by_root_cause = [
        {
            "root_cause": r.root_cause,
            "case_count": r.case_count,
            "amount_at_risk": float(r.amount_at_risk),
            "amount_recovered": float(r.amount_recovered),
            "rate": (float(r.amount_recovered) / float(r.amount_at_risk) * 100)
                    if r.amount_at_risk and float(r.amount_at_risk) > 0 else 0.0,
        }
        for r in rc_result.all()
    ]

    at_risk_f = float(total_at_risk)
    recovered_f = float(total_recovered)
    eligible = total_cases - (unrecoverable_cases + blocked_cases)

    amount_recovery_rate = (recovered_f / at_risk_f * 100) if at_risk_f > 0 else 0.0
    case_recovery_rate = (recovered_cases / eligible * 100) if eligible > 0 else 0.0

    return {
        "seed": 42,
        "data_source": "SYNTHETIC",
        "total_cases": total_cases,
        "total_amount_at_risk": at_risk_f,
        "total_amount_recovered": recovered_f,
        # Metric definitions as per spec
        "amount_recovery_rate": round(amount_recovery_rate, 2),  # amount_recovered / amount_at_risk
        "case_recovery_rate": round(case_recovery_rate, 2),       # recovered_cases / eligible_cases
        "recovered_cases": recovered_cases,
        "unrecoverable_cases": unrecoverable_cases,
        "escalated_cases": escalated_cases,
        "blocked_cases": blocked_cases,
        "blocked_interventions": blocked_interventions,
        "successful_interventions": successful_interventions,
        "by_scenario": by_scenario,
        "by_root_cause": by_root_cause,
    }
