"""
Common Recovery Engine
───────────────────────
All 7 recovery scenarios use this engine.
Pipeline: Signal → AI Classify → Policy Governor → Simulate → Audit

This is the core of the Revenue Recovery OS.
"""
import uuid
import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.recovery_case import RecoveryCase
from app.models.customer import Customer
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.ai_recommendation import AIRecommendation
from app.models.policy_decision import PolicyDecision
from app.models.intervention import Intervention
from app.models.audit_event import AuditEvent

from app.ai.classifier import classify_recovery_signal
from app.policy.governor import evaluate_action
from app.simulator.simulator import simulate_recovery

logger = logging.getLogger(__name__)


async def _write_audit(
    *,
    case_id: str,
    event_type: str,
    actor: str,
    action: str,
    reason: Optional[str] = None,
    metadata: Optional[dict] = None,
    db: AsyncSession,
) -> AuditEvent:
    event = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=case_id,
        timestamp=datetime.utcnow(),
        event_type=event_type,
        actor=actor,
        action=action,
        reason=reason,
        metadata_=json.dumps(metadata) if metadata else None,
    )
    db.add(event)
    await db.flush()
    return event


async def run_recovery_engine(case_id: str, db: AsyncSession) -> dict:
    """
    Run the full recovery pipeline on a case.
    
    EVENT → NORMALIZE → UNDERSTAND → AI RECOMMENDATION
    → POLICY GOVERNOR → INTERVENTION → OUTCOME → AUDIT → METRICS
    """
    case = await db.get(RecoveryCase, case_id)
    if not case:
        return {"error": "Case not found"}

    customer = await db.get(Customer, case.customer_id)

    # --- Load source data ---
    payment_method = None
    failure_code = None
    failure_reason = None
    mandate_status = None
    mandate_type = None
    last_attempt_at = None
    attempt_count = 0

    if case.source_type == "payment":
        payment = await db.get(Payment, case.source_id)
        if payment:
            payment_method = payment.method
            failure_code = payment.failure_code
            failure_reason = payment.failure_reason

    elif case.source_type == "subscription":
        sub = await db.get(Subscription, case.source_id)
        if sub:
            payment_method = "card" if not sub.mandate_type else sub.mandate_type
            mandate_status = sub.mandate_status
            mandate_type = sub.mandate_type
            attempt_count = int(sub.retry_count or 0)
            last_attempt_at = sub.last_charge_at

    # --- Update case status ---
    case.status = "IN_PROGRESS"
    case.updated_at = datetime.utcnow()
    await db.flush()

    await _write_audit(
        case_id=case_id,
        event_type="CASE_STARTED",
        actor="SYSTEM",
        action="Recovery engine started",
        reason=f"Running pipeline for scenario: {case.scenario_type}",
        db=db,
    )

    # ─── STEP 1: AI Classification ───────────────────────────────────────
    customer_history = {
        "risk_segment": customer.risk_segment if customer else "MEDIUM",
        "language": customer.language_preference if customer else "en",
    }

    classification = await classify_recovery_signal(
        scenario_type=case.scenario_type,
        failure_code=failure_code,
        failure_reason=failure_reason,
        payment_method=payment_method,
        amount=case.amount_at_risk,
        customer_history=customer_history,
        attempt_count=attempt_count,
        gemini_api_key=settings.gemini_api_key,
    )

    # Persist AI recommendation
    ai_rec = AIRecommendation(
        id=str(uuid.uuid4()),
        case_id=case_id,
        root_cause=classification.root_cause,
        confidence=classification.confidence,
        recommendation=classification.recommendation,
        reason=classification.reason,
        signals=json.dumps(classification.signals),
        model_used="gemini-1.5-flash" if not classification.is_fallback else "rule-based-fallback",
        is_fallback=str(classification.is_fallback).lower(),
    )
    db.add(ai_rec)
    await db.flush()

    # Update root cause on case
    case.root_cause = classification.root_cause

    await _write_audit(
        case_id=case_id,
        event_type="AI_ANALYZED",
        actor="AI",
        action=f"Classified: {classification.root_cause} → {classification.recommendation}",
        reason=f"Confidence: {classification.confidence:.0%}. {'Fallback mode.' if classification.is_fallback else 'Gemini analysis.'}",
        metadata={
            "root_cause": classification.root_cause,
            "recommendation": classification.recommendation,
            "confidence": classification.confidence,
            "is_fallback": classification.is_fallback,
        },
        db=db,
    )

    # ─── STEP 2: Policy Governor ──────────────────────────────────────────
    gov_decision = await evaluate_action(
        case=case,
        recommended_action=classification.recommendation,
        payment_method=payment_method,
        amount=case.amount_at_risk,
        mandate_status=mandate_status,
        attempt_count=attempt_count,
        last_attempt_at=last_attempt_at,
        mandate_type=mandate_type,
        db=db,
    )

    # Persist policy decision
    policy_dec = PolicyDecision(
        id=str(uuid.uuid4()),
        case_id=case_id,
        recommendation_id=ai_rec.id,
        decision=gov_decision.decision,
        reason=gov_decision.reason,
        rules_checked=json.dumps([
            {
                "rule_key": r.rule_key,
                "rule_name": r.rule_name,
                "passed": r.passed,
                "reason": r.reason,
            }
            for r in gov_decision.rules_checked
        ]),
        policy_version=gov_decision.policy_version,
        timestamp=gov_decision.timestamp,
    )
    db.add(policy_dec)
    await db.flush()

    await _write_audit(
        case_id=case_id,
        event_type="POLICY_EVALUATED",
        actor="POLICY_GOVERNOR",
        action=f"Decision: {gov_decision.decision}",
        reason=gov_decision.reason,
        metadata={"decision": gov_decision.decision, "rules_checked": len(gov_decision.rules_checked)},
        db=db,
    )

    # ─── STEP 3: Execute or Block ─────────────────────────────────────────
    if gov_decision.decision == "BLOCK":
        case.status = "BLOCKED"
        intervention = Intervention(
            id=str(uuid.uuid4()),
            case_id=case_id,
            action=classification.recommendation,
            channel="system",
            requested_at=datetime.utcnow(),
            policy_decision_id=policy_dec.id,
            result="POLICY_BLOCKED",
            amount_recovered=0.0,
            notes=f"Blocked by Policy Governor: {gov_decision.reason}",
        )
        db.add(intervention)
        await db.flush()

        await _write_audit(
            case_id=case_id,
            event_type="INTERVENTION_BLOCKED",
            actor="POLICY_GOVERNOR",
            action=f"Blocked: {classification.recommendation}",
            reason=gov_decision.reason,
            db=db,
        )

        case.updated_at = datetime.utcnow()
        await db.flush()
        return {
            "status": "BLOCKED",
            "ai_recommendation": classification.recommendation,
            "policy_decision": "BLOCK",
            "reason": gov_decision.reason,
        }

    elif gov_decision.decision == "ESCALATE":
        case.status = "ESCALATED"
        intervention = Intervention(
            id=str(uuid.uuid4()),
            case_id=case_id,
            action="ESCALATE",
            channel="manual",
            requested_at=datetime.utcnow(),
            policy_decision_id=policy_dec.id,
            result="CUSTOMER_ACTION_REQUIRED",
            amount_recovered=0.0,
            notes=f"Escalated: {gov_decision.reason}",
        )
        db.add(intervention)
        await db.flush()

        await _write_audit(
            case_id=case_id,
            event_type="CASE_ESCALATED",
            actor="POLICY_GOVERNOR",
            action="Escalated to manual review",
            reason=gov_decision.reason,
            db=db,
        )

        case.updated_at = datetime.utcnow()
        await db.flush()
        return {
            "status": "ESCALATED",
            "ai_recommendation": classification.recommendation,
            "policy_decision": "ESCALATE",
            "reason": gov_decision.reason,
        }

    # ─── STEP 4: Simulate Recovery ────────────────────────────────────────
    # Generate deterministic seed from case_id
    sim_seed = abs(hash(case_id)) % 100000

    sim_result = simulate_recovery(
        root_cause=classification.root_cause,
        action=classification.recommendation,
        amount=case.amount_at_risk,
        seed=sim_seed,
    )

    intervention = Intervention(
        id=str(uuid.uuid4()),
        case_id=case_id,
        action=classification.recommendation,
        channel="system",
        requested_at=datetime.utcnow(),
        policy_decision_id=policy_dec.id,
        executed_at=datetime.utcnow(),
        result=sim_result.outcome,
        amount_recovered=sim_result.amount_recovered,
        simulator_seed=sim_seed,
        notes=sim_result.notes,
    )
    db.add(intervention)
    await db.flush()

    await _write_audit(
        case_id=case_id,
        event_type="INTERVENTION_EXECUTED",
        actor="SYSTEM",
        action=f"Executed: {classification.recommendation} [SIMULATED]",
        reason=sim_result.notes,
        metadata={"outcome": sim_result.outcome, "amount_recovered": sim_result.amount_recovered},
        db=db,
    )

    # ─── STEP 5: Record Outcome ───────────────────────────────────────────
    if sim_result.outcome == "SUCCESS":
        case.status = "RECOVERED"
        case.amount_recovered = sim_result.amount_recovered
        await _write_audit(
            case_id=case_id,
            event_type="CASE_RECOVERED",
            actor="SYSTEM",
            action=f"Recovered ₹{sim_result.amount_recovered:,.2f}",
            reason="Recovery intervention succeeded",
            metadata={"amount_recovered": sim_result.amount_recovered},
            db=db,
        )
    elif sim_result.outcome in ("FAILED", "TIMEOUT"):
        # Check if we've exhausted retries
        existing_iv = await db.execute(
            select(Intervention).where(
                Intervention.case_id == case_id,
                Intervention.result.in_(["FAILED", "TIMEOUT"]),
            )
        )
        failed_count = len(existing_iv.scalars().all())

        if failed_count >= 3:
            case.status = "UNRECOVERABLE"
            await _write_audit(
                case_id=case_id,
                event_type="CASE_CLOSED",
                actor="SYSTEM",
                action="Case marked UNRECOVERABLE",
                reason=f"Recovery failed after {failed_count} attempts",
                db=db,
            )
        else:
            case.status = "OPEN"
    elif sim_result.outcome == "CUSTOMER_ACTION_REQUIRED":
        case.status = "ESCALATED"
        await _write_audit(
            case_id=case_id,
            event_type="CASE_ESCALATED",
            actor="SYSTEM",
            action="Customer action required",
            reason="Recovery simulation requires customer input",
            db=db,
        )

    case.updated_at = datetime.utcnow()
    await db.flush()

    return {
        "status": case.status,
        "ai_recommendation": classification.recommendation,
        "policy_decision": "ALLOW",
        "simulation_outcome": sim_result.outcome,
        "amount_recovered": sim_result.amount_recovered,
        "notes": sim_result.notes,
    }


async def execute_intervention(case_id: str, action: str, channel: str, db: AsyncSession) -> dict:
    """Manually execute a specific intervention on a case (UI-triggered)."""
    case = await db.get(RecoveryCase, case_id)
    if not case:
        return {"error": "Case not found"}

    # Still goes through policy governor
    gov = await evaluate_action(
        case=case,
        recommended_action=action or "RETRY",
        payment_method=None,
        amount=case.amount_at_risk,
        mandate_status=None,
        attempt_count=0,
        last_attempt_at=None,
        mandate_type=None,
        db=db,
    )

    policy_dec = PolicyDecision(
        id=str(uuid.uuid4()),
        case_id=case_id,
        recommendation_id=None,
        decision=gov.decision,
        reason=gov.reason,
        rules_checked=json.dumps([
            {"rule_key": r.rule_key, "rule_name": r.rule_name, "passed": r.passed, "reason": r.reason}
            for r in gov.rules_checked
        ]),
        policy_version=gov.policy_version,
    )
    db.add(policy_dec)
    await db.flush()

    if gov.decision != "ALLOW":
        iv = Intervention(
            id=str(uuid.uuid4()), case_id=case_id, action=action or "UNKNOWN",
            channel=channel or "manual", requested_at=datetime.utcnow(),
            policy_decision_id=policy_dec.id, result="POLICY_BLOCKED", amount_recovered=0.0,
            notes=f"Manual action blocked: {gov.reason}",
        )
        db.add(iv)
        await db.flush()
        return {"decision": gov.decision, "reason": gov.reason}

    sim_seed = abs(hash(case_id + (action or ""))) % 100000
    sim = simulate_recovery(
        root_cause=case.root_cause or "UNKNOWN",
        action=action or "RETRY",
        amount=case.amount_at_risk,
        seed=sim_seed,
    )

    iv = Intervention(
        id=str(uuid.uuid4()), case_id=case_id, action=action or "RETRY",
        channel=channel or "manual", requested_at=datetime.utcnow(),
        policy_decision_id=policy_dec.id, executed_at=datetime.utcnow(),
        result=sim.outcome, amount_recovered=sim.amount_recovered,
        simulator_seed=sim_seed, notes=sim.notes,
    )
    db.add(iv)

    if sim.outcome == "SUCCESS":
        case.status = "RECOVERED"
        case.amount_recovered = (case.amount_recovered or 0) + sim.amount_recovered

    await _write_audit(
        case_id=case_id, event_type="INTERVENTION_EXECUTED",
        actor="USER", action=f"Manual: {action}",
        reason=sim.notes, db=db,
    )

    case.updated_at = datetime.utcnow()
    await db.flush()
    return {"decision": "ALLOW", "outcome": sim.outcome, "amount_recovered": sim.amount_recovered}
