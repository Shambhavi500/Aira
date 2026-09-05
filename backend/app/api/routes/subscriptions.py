"""
Subscription Recovery API Routes
Supports operational subscription dashboard, real retry sequencer,
payment links, escalation, and Policy Governor integration.
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.subscription import Subscription
from app.models.customer import Customer
from app.models.recovery_case import RecoveryCase
from app.models.policy_decision import PolicyDecision
from app.models.ai_recommendation import AIRecommendation
from app.models.intervention import Intervention
from app.models.audit_event import AuditEvent
from app.policy.governor import evaluate_action
from app.simulator.simulator import simulate_recovery

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


def _build_timeline(sub: Subscription, case: Optional[RecoveryCase], interventions: list[Intervention]) -> list[dict]:
    timeline = []
    
    # 1. Payment Failed
    fail_time = sub.last_charge_at.isoformat() if sub.last_charge_at else sub.created_at.isoformat()
    timeline.append({
        "stage": "Payment Failed",
        "status": "COMPLETED",
        "timestamp": fail_time,
        "detail": f"Failed recurring billing cycle for {sub.plan.title()} plan (₹{sub.amount:,.0f})",
    })

    # 2. Failure Diagnosed
    root_cause = case.root_cause if case else "INSUFFICIENT_FUNDS"
    timeline.append({
        "stage": "Failure Diagnosed",
        "status": "COMPLETED",
        "timestamp": fail_time,
        "detail": f"Root Cause: {root_cause.replace('_', ' ').title()}",
    })

    # 3. Retry Sequence / Attempts
    retries = int(sub.retry_count or 0)
    for i in range(1, retries + 1):
        matching_iv = interventions[i - 1] if len(interventions) >= i else None
        iv_result = matching_iv.result if matching_iv else "FAILED"
        timeline.append({
            "stage": f"Retry Attempt {i} of 3",
            "status": "COMPLETED" if iv_result == "SUCCESS" else "FAILED",
            "timestamp": matching_iv.executed_at.isoformat() if (matching_iv and matching_iv.executed_at) else fail_time,
            "detail": f"Outcome: {iv_result}. {matching_iv.notes if matching_iv else ''}",
        })

    # 4. Next Step / Terminal
    if case and case.status == "RECOVERED":
        timeline.append({
            "stage": "Payment Recovered",
            "status": "COMPLETED",
            "timestamp": case.updated_at.isoformat(),
            "detail": f"Recovered ₹{case.amount_recovered:,.0f} and restored subscription to Active.",
        })
    elif case and case.status == "ESCALATED":
        timeline.append({
            "stage": "Escalated to Human Ops",
            "status": "ACTION_REQUIRED",
            "timestamp": case.updated_at.isoformat(),
            "detail": "Automated retries exhausted or blocked by policy. Manual outreach required.",
        })
    elif sub.next_charge_at:
        timeline.append({
            "stage": "Next Retry Scheduled",
            "status": "SCHEDULED",
            "timestamp": sub.next_charge_at.isoformat(),
            "detail": f"Scheduled automated re-attempt under banking cooldown rules.",
        })
    else:
        timeline.append({
            "stage": "Autonomous Recovery Ready",
            "status": "PENDING",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": "Ready for intelligent retry execution.",
        })

    return timeline


@router.get("")
async def list_subscriptions(
    search: str = Query(default=""),
    status: str = Query(default=""),
    plan: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Subscription)

    if status:
        if status.lower() == "failed":
            stmt = stmt.where(Subscription.status.in_(["halted", "paused"]))
        else:
            stmt = stmt.where(Subscription.status == status)
    if plan:
        stmt = stmt.where(Subscription.plan == plan)

    stmt = stmt.order_by(Subscription.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    subs = result.scalars().all()

    items = []
    for sub in subs:
        customer = await db.get(Customer, sub.customer_id)

        case_r = await db.execute(
            select(RecoveryCase).where(
                RecoveryCase.source_id == sub.id,
                RecoveryCase.source_type == "subscription",
            ).limit(1)
        )
        case = case_r.scalar_one_or_none()

        if not case:
            case_r2 = await db.execute(
                select(RecoveryCase).where(
                    RecoveryCase.customer_id == sub.customer_id,
                    RecoveryCase.scenario_type == "FAILED_SUBSCRIPTION",
                ).order_by(RecoveryCase.created_at.desc()).limit(1)
            )
            case = case_r2.scalar_one_or_none()

        interventions = []
        last_policy = None
        last_ai = None
        if case:
            iv_r = await db.execute(
                select(Intervention).where(Intervention.case_id == case.id).order_by(Intervention.requested_at.asc())
            )
            interventions = iv_r.scalars().all()

            pd_r = await db.execute(
                select(PolicyDecision).where(PolicyDecision.case_id == case.id).order_by(PolicyDecision.timestamp.desc()).limit(1)
            )
            last_policy = pd_r.scalar_one_or_none()

            ai_r = await db.execute(
                select(AIRecommendation).where(AIRecommendation.case_id == case.id).order_by(AIRecommendation.created_at.desc()).limit(1)
            )
            last_ai = ai_r.scalar_one_or_none()

        timeline = _build_timeline(sub, case, interventions)
        strategy = last_ai.recommendation if last_ai else "SMART_SCHEDULED_RETRY"

        items.append({
            "id": sub.id,
            "customer_id": sub.customer_id,
            "customer_name": customer.name if customer else "Customer",
            "customer_email": customer.email if customer else None,
            "customer_phone": customer.phone if customer else None,
            "plan": sub.plan,
            "amount": sub.amount,
            "frequency": sub.frequency,
            "status": sub.status,
            "mandate_id": sub.mandate_id,
            "mandate_status": sub.mandate_status,
            "mandate_type": sub.mandate_type or "card",
            "payment_method": sub.mandate_type or "card",
            "retry_count": int(sub.retry_count or 0),
            "max_retries": 3,
            "last_charge_at": sub.last_charge_at.isoformat() if sub.last_charge_at else None,
            "next_retry_at": sub.next_charge_at.isoformat() if sub.next_charge_at else None,
            "failure_reason": case.root_cause if case else "INSUFFICIENT_FUNDS",
            "recovery_strategy": strategy,
            "case_id": case.id if case else None,
            "case_status": case.status if case else ("OPEN" if sub.status in ("halted", "paused") else "RESOLVED"),
            "amount_recovered": case.amount_recovered if case else (sub.amount if sub.status == "active" else 0.0),
            "policy_decision": last_policy.decision if last_policy else "ALLOW",
            "timeline": timeline,
        })

    if search:
        s_lower = search.lower()
        items = [
            i for i in items
            if s_lower in i["customer_name"].lower()
            or s_lower in (i["customer_email"] or "").lower()
            or s_lower in i["id"].lower()
            or s_lower in i["plan"].lower()
            or s_lower in i["failure_reason"].lower()
        ]

    active_count = await db.scalar(
        select(func.count(Subscription.id)).where(Subscription.status == "active")
    ) or 0

    failed_count = await db.scalar(
        select(func.count(Subscription.id)).where(Subscription.status.in_(["halted", "paused"]))
    ) or 0

    at_risk_sum = await db.scalar(
        select(func.coalesce(func.sum(Subscription.amount), 0)).where(
            Subscription.status.in_(["halted", "paused"])
        )
    ) or 0.0

    rec_sum = await db.scalar(
        select(func.coalesce(func.sum(RecoveryCase.amount_recovered), 0)).where(
            RecoveryCase.scenario_type == "FAILED_SUBSCRIPTION"
        )
    ) or 0.0

    rec_count = await db.scalar(
        select(func.count(RecoveryCase.id)).where(
            RecoveryCase.scenario_type == "FAILED_SUBSCRIPTION",
            RecoveryCase.status == "RECOVERED",
        )
    ) or 0

    upcoming_count = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.next_charge_at > datetime.utcnow()
        )
    ) or 0

    action_required_count = await db.scalar(
        select(func.count(RecoveryCase.id)).where(
            RecoveryCase.scenario_type == "FAILED_SUBSCRIPTION",
            RecoveryCase.status.in_(["ESCALATED", "OPEN"]),
        )
    ) or 0

    recovery_rate = (
        round((float(rec_sum) / float(at_risk_sum + rec_sum)) * 100, 1)
        if (at_risk_sum + rec_sum) > 0 else 0.0
    )

    return {
        "metrics": {
            "active_subscriptions": active_count,
            "failed_payments": failed_count,
            "total_failed": failed_count,
            "revenue_at_risk": float(at_risk_sum),
            "total_mrr_at_risk": float(at_risk_sum),
            "recovered_revenue": float(rec_sum),
            "recovered_mrr": float(rec_sum),
            "recovery_rate": recovery_rate,
            "recovered_cases": rec_count,
            "recovered_count": rec_count,
            "upcoming_renewals": upcoming_count,
            "customers_requiring_action": action_required_count,
        },
        "items": items,
        "total": len(items),
        "page": page,
        "page_size": page_size,
    }


@router.post("/{sub_id}/retry")
async def retry_subscription(sub_id: str, db: AsyncSession = Depends(get_db)):
    """
    Execute real retry sequencer for a subscription payment.
    Passes through Policy Governor, simulates recovery, logs audit trail,
    and updates both Subscription and RecoveryCase state.
    """
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    case_r = await db.execute(
        select(RecoveryCase).where(
            RecoveryCase.source_id == sub.id,
            RecoveryCase.source_type == "subscription",
        ).limit(1)
    )
    case = case_r.scalar_one_or_none()

    if not case:
        case = RecoveryCase(
            id=str(uuid.uuid4()),
            customer_id=sub.customer_id,
            source_type="subscription",
            source_id=sub.id,
            scenario_type="FAILED_SUBSCRIPTION",
            amount_at_risk=sub.amount,
            amount_recovered=0.0,
            root_cause="INSUFFICIENT_FUNDS",
            status="IN_PROGRESS",
            priority="HIGH",
            data_source="SYNTHETIC",
        )
        db.add(case)
        await db.flush()

    curr_retry = int(sub.retry_count or 0)
    gov_decision = await evaluate_action(
        case=case,
        recommended_action="RETRY",
        payment_method=sub.mandate_type or "card",
        amount=sub.amount,
        mandate_status=sub.mandate_status,
        attempt_count=curr_retry,
        last_attempt_at=sub.last_charge_at,
        mandate_type=sub.mandate_type,
        db=db,
    )

    policy_dec = PolicyDecision(
        id=str(uuid.uuid4()),
        case_id=case.id,
        recommendation_id=None,
        decision=gov_decision.decision,
        reason=gov_decision.reason,
        rules_checked=json.dumps([
            {"rule_key": r.rule_key, "rule_name": r.rule_name, "passed": r.passed, "reason": r.reason}
            for r in gov_decision.rules_checked
        ]),
        policy_version=gov_decision.policy_version,
    )
    db.add(policy_dec)

    if gov_decision.decision == "BLOCK":
        iv = Intervention(
            id=str(uuid.uuid4()),
            case_id=case.id,
            action="SMART_RETRY",
            channel="system",
            requested_at=datetime.utcnow(),
            policy_decision_id=policy_dec.id,
            result="POLICY_BLOCKED",
            notes=gov_decision.reason,
        )
        db.add(iv)
        case.status = "BLOCKED"
        await db.commit()
        return {
            "status": "BLOCKED",
            "decision": "BLOCK",
            "reason": gov_decision.reason,
            "message": f"Retry blocked by Policy Governor: {gov_decision.reason}",
        }

    curr_retry += 1
    sub.retry_count = str(curr_retry)
    sub.last_charge_at = datetime.utcnow()

    sim_seed = abs(hash(sub.id + str(curr_retry))) % 100000
    sim = simulate_recovery(
        root_cause=case.root_cause or "INSUFFICIENT_FUNDS",
        action="RETRY",
        amount=sub.amount,
        seed=sim_seed,
    )

    iv = Intervention(
        id=str(uuid.uuid4()),
        case_id=case.id,
        action="SMART_RETRY",
        channel="system",
        requested_at=datetime.utcnow(),
        executed_at=datetime.utcnow(),
        policy_decision_id=policy_dec.id,
        result=sim.outcome,
        amount_recovered=sim.amount_recovered,
        simulator_seed=sim_seed,
        notes=f"Retry attempt {curr_retry}/3: {sim.notes}",
    )
    db.add(iv)

    if sim.outcome == "SUCCESS":
        sub.status = "active"
        sub.next_charge_at = datetime.utcnow() + timedelta(days=30)
        case.status = "RECOVERED"
        case.amount_recovered = sim.amount_recovered

        audit = AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            timestamp=datetime.utcnow(),
            event_type="SUBSCRIPTION_RECOVERED",
            actor="AIRA_AUTONOMOUS_ENGINE",
            action=f"Subscription retry succeeded — ₹{sim.amount_recovered:,.0f} recovered",
            reason="Automated smart retry succeeded on active mandate",
        )
        db.add(audit)
        await db.commit()
        return {
            "status": "RECOVERED",
            "decision": "ALLOW",
            "amount_recovered": sim.amount_recovered,
            "retry_count": curr_retry,
            "message": f"Payment successfully recovered! ₹{sim.amount_recovered:,.0f} collected.",
        }
    else:
        if curr_retry >= 3:
            case.status = "ESCALATED"
            sub.status = "halted"
            audit = AuditEvent(
                id=str(uuid.uuid4()),
                case_id=case.id,
                timestamp=datetime.utcnow(),
                event_type="SUBSCRIPTION_ESCALATED",
                actor="AIRA_AUTONOMOUS_ENGINE",
                action="Max retry limit reached — escalated to human operations",
                reason=f"Failed after {curr_retry} consecutive retry attempts",
            )
            db.add(audit)
            await db.commit()
            return {
                "status": "ESCALATED",
                "decision": "ALLOW",
                "retry_count": curr_retry,
                "message": f"Retry failed ({sim.notes}). Max retry threshold reached; case escalated to manual review.",
            }
        else:
            sub.next_charge_at = datetime.utcnow() + timedelta(hours=6)
            audit = AuditEvent(
                id=str(uuid.uuid4()),
                case_id=case.id,
                timestamp=datetime.utcnow(),
                event_type="SUBSCRIPTION_RETRY_FAILED",
                actor="AIRA_AUTONOMOUS_ENGINE",
                action=f"Retry attempt {curr_retry} failed — cooldown scheduled",
                reason=sim.notes,
            )
            db.add(audit)
            await db.commit()
            return {
                "status": "RETRY_FAILED",
                "decision": "ALLOW",
                "retry_count": curr_retry,
                "next_retry": sub.next_charge_at.isoformat(),
                "message": f"Retry failed ({sim.notes}). Next attempt scheduled in 6 hours under banking cooldown.",
            }


@router.post("/{sub_id}/schedule-retry")
async def schedule_retry(sub_id: str, body: dict = None, db: AsyncSession = Depends(get_db)):
    """Schedule next retry attempt window."""
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    hours = int((body or {}).get("hours", 12))
    sub.next_charge_at = datetime.utcnow() + timedelta(hours=hours)

    case_r = await db.execute(
        select(RecoveryCase).where(RecoveryCase.source_id == sub.id).limit(1)
    )
    case = case_r.scalar_one_or_none()

    if case:
        audit = AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            timestamp=datetime.utcnow(),
            event_type="RETRY_SCHEDULED",
            actor="OPS_USER",
            action=f"Retry scheduled for +{hours}h",
            reason=f"Scheduled execution window set to {sub.next_charge_at.isoformat()}",
        )
        db.add(audit)

    await db.commit()
    return {
        "status": "SCHEDULED",
        "sub_id": sub_id,
        "next_retry_at": sub.next_charge_at.isoformat(),
        "message": f"Next retry successfully scheduled for {hours} hours from now.",
    }


@router.post("/{sub_id}/send-link")
async def send_payment_link(sub_id: str, db: AsyncSession = Depends(get_db)):
    """Dispatch payment recovery link to the customer via SMS/WhatsApp."""
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    customer = await db.get(Customer, sub.customer_id)

    case_r = await db.execute(
        select(RecoveryCase).where(RecoveryCase.source_id == sub.id).limit(1)
    )
    case = case_r.scalar_one_or_none()
    case_id = case.id if case else str(uuid.uuid4())

    link_token = str(uuid.uuid4())[:8]
    payment_link_url = f"https://pay.aira.recovery/sub/{link_token}"

    iv = Intervention(
        id=str(uuid.uuid4()),
        case_id=case_id,
        action="SEND_PAYMENT_LINK",
        channel="whatsapp",
        requested_at=datetime.utcnow(),
        executed_at=datetime.utcnow(),
        result="LINK_DISPATCHED",
        amount_recovered=0.0,
        notes=f"Payment link sent to {customer.phone if customer else 'customer'}: {payment_link_url}",
    )
    db.add(iv)

    if case:
        audit = AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            timestamp=datetime.utcnow(),
            event_type="PAYMENT_LINK_SENT",
            actor="AIRA_AUTONOMOUS_ENGINE",
            action="Payment link dispatched to customer",
            reason=f"Dispatched URL: {payment_link_url}",
        )
        db.add(audit)

    await db.commit()
    return {
        "status": "SUCCESS",
        "payment_link": payment_link_url,
        "message": f"Payment recovery link dispatched via WhatsApp/SMS to {customer.name if customer else 'Customer'}.",
    }


@router.post("/{sub_id}/escalate")
async def escalate_subscription(sub_id: str, body: dict = None, db: AsyncSession = Depends(get_db)):
    """Escalate subscription recovery to manual review."""
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    reason = (body or {}).get("reason", "Manual escalation from Subscription Workspace")
    sub.status = "paused"

    case_r = await db.execute(
        select(RecoveryCase).where(RecoveryCase.source_id == sub.id).limit(1)
    )
    case = case_r.scalar_one_or_none()
    if case:
        case.status = "ESCALATED"
        audit = AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            timestamp=datetime.utcnow(),
            event_type="CASE_ESCALATED",
            actor="OPS_USER",
            action="Subscription escalated to human review",
            reason=reason,
        )
        db.add(audit)

    await db.commit()
    return {"status": "ESCALATED", "message": "Subscription escalated to human operations."}


@router.post("/{sub_id}/mark-recovered")
async def mark_subscription_recovered(sub_id: str, db: AsyncSession = Depends(get_db)):
    """Mark subscription as manually or externally recovered."""
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    sub.status = "active"
    sub.next_charge_at = datetime.utcnow() + timedelta(days=30)

    case_r = await db.execute(
        select(RecoveryCase).where(RecoveryCase.source_id == sub.id).limit(1)
    )
    case = case_r.scalar_one_or_none()
    if case:
        case.status = "RECOVERED"
        case.amount_recovered = sub.amount
        audit = AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            timestamp=datetime.utcnow(),
            event_type="CASE_RECOVERED",
            actor="OPS_USER",
            action=f"Manually marked recovered — ₹{sub.amount:,.0f}",
            reason="Confirmed payment receipt on external rail",
        )
        db.add(audit)

    await db.commit()
    return {
        "status": "RECOVERED",
        "amount_recovered": sub.amount,
        "message": f"Subscription successfully marked recovered! ₹{sub.amount:,.0f} added to recovered metrics.",
    }
