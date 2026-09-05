"""
Recovery cases CRUD + run endpoint.
"""
import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.recovery_case import RecoveryCase
from app.models.customer import Customer
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.ai_recommendation import AIRecommendation
from app.models.policy_decision import PolicyDecision
from app.models.intervention import Intervention
from app.models.audit_event import AuditEvent
from app.models.promise_to_pay import PromiseToPay

router = APIRouter(prefix="/api/cases", tags=["cases"])


def _compute_next_action(status: str, ai_rec: str | None) -> str:
    if status == "RECOVERED":
        return "Resolved & Verified"
    if status == "ESCALATED":
        return "Manual Ops Review Pending"
    if status in ("BLOCKED", "STOPPED"):
        return "Blocked by Policy Governor"
    if status == "UNRECOVERABLE":
        return "Exhausted / Closed"
    if not ai_rec:
        return "Run Aira Autonomous Engine"
    if "RETRY" in ai_rec:
        return "Execute Smart Retry"
    if "PAYMENT_LINK" in ai_rec or "LINK" in ai_rec:
        return "Dispatch Payment Link"
    if "VOICE" in ai_rec:
        return "Trigger Voice AI Recovery"
    if "REMINDER" in ai_rec:
        return "Send Dunning Reminder"
    return f"Execute {ai_rec.replace('_', ' ').title()}"


def _serialize_case(
    c: RecoveryCase,
    customer: Customer | None = None,
    last_ai: AIRecommendation | None = None,
    last_policy: PolicyDecision | None = None,
    last_audit: AuditEvent | None = None,
    payment_method: str | None = None,
) -> dict:
    next_action = _compute_next_action(c.status, last_ai.recommendation if last_ai else None)
    return {
        "id": c.id,
        "customer_id": c.customer_id,
        "customer_name": customer.name if customer else None,
        "customer_email": customer.email if customer else None,
        "customer_phone": customer.phone if customer else None,
        "scenario_type": c.scenario_type,
        "source_type": c.source_type,
        "source_id": c.source_id,
        "amount_at_risk": c.amount_at_risk,
        "amount_recovered": c.amount_recovered or 0.0,
        "root_cause": c.root_cause,
        "status": c.status,
        "priority": c.priority,
        "data_source": c.data_source,
        "notes": c.notes,
        "payment_method": payment_method or "card",
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
        "latest_ai_recommendation": last_ai.recommendation if last_ai else None,
        "latest_policy_decision": last_policy.decision if last_policy else None,
        "next_action": next_action,
        "last_activity": {
            "action": last_audit.action,
            "timestamp": last_audit.timestamp.isoformat(),
            "actor": last_audit.actor,
        } if last_audit else None,
    }


def _serialize_audit(e: AuditEvent) -> dict:
    meta = None
    if e.metadata_:
        try:
            meta = json.loads(e.metadata_)
        except Exception:
            meta = e.metadata_
    return {
        "id": e.id,
        "case_id": e.case_id,
        "timestamp": e.timestamp.isoformat(),
        "event_type": e.event_type,
        "actor": e.actor,
        "action": e.action,
        "reason": e.reason,
        "metadata_": meta,
    }


def _serialize_ai(ai: AIRecommendation) -> dict:
    signals = []
    if ai.signals:
        try:
            signals = json.loads(ai.signals)
        except Exception:
            signals = [ai.signals]
    return {
        "id": ai.id,
        "case_id": ai.case_id,
        "root_cause": ai.root_cause,
        "confidence": ai.confidence or 0.0,
        "recommendation": ai.recommendation,
        "reason": ai.reason,
        "signals": signals,
        "model_used": ai.model_used,
        "is_fallback": ai.is_fallback,
        "created_at": ai.created_at.isoformat(),
    }


def _serialize_policy(pd: PolicyDecision) -> dict:
    rules = []
    if pd.rules_checked:
        try:
            rules = json.loads(pd.rules_checked)
        except Exception:
            rules = []
    return {
        "id": pd.id,
        "case_id": pd.case_id,
        "recommendation_id": pd.recommendation_id,
        "decision": pd.decision,
        "reason": pd.reason,
        "rules_checked": rules,
        "policy_version": pd.policy_version,
        "timestamp": pd.timestamp.isoformat(),
    }


def _serialize_intervention(iv: Intervention) -> dict:
    return {
        "id": iv.id,
        "case_id": iv.case_id,
        "action": iv.action,
        "channel": iv.channel,
        "requested_at": iv.requested_at.isoformat(),
        "executed_at": iv.executed_at.isoformat() if iv.executed_at else None,
        "result": iv.result,
        "amount_recovered": iv.amount_recovered or 0.0,
        "notes": iv.notes,
    }


@router.get("")
async def list_cases(
    search: str = Query(default=""),
    status: str = Query(default=""),
    scenario_type: str = Query(default=""),
    priority: str = Query(default=""),
    payment_method: str = Query(default=""),
    sort_by: str = Query(default="created_at"),
    sort_dir: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(RecoveryCase)

    if status:
        stmt = stmt.where(RecoveryCase.status == status)
    if scenario_type:
        stmt = stmt.where(RecoveryCase.scenario_type == scenario_type)
    if priority:
        stmt = stmt.where(RecoveryCase.priority == priority)

    # Count total matching initial filters
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt) or 0

    # Sort
    col = getattr(RecoveryCase, sort_by, RecoveryCase.created_at)
    if sort_dir == "asc":
        stmt = stmt.order_by(col.asc())
    else:
        stmt = stmt.order_by(col.desc())

    # Paginate
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    cases = result.scalars().all()

    # Load customers + latest AI/policy/audit + payment method for each case
    items = []
    for c in cases:
        customer = None
        if c.customer_id:
            customer = await db.get(Customer, c.customer_id)

        last_ai_r = await db.execute(
            select(AIRecommendation).where(AIRecommendation.case_id == c.id)
            .order_by(AIRecommendation.created_at.desc()).limit(1)
        )
        last_ai = last_ai_r.scalar_one_or_none()

        last_pd_r = await db.execute(
            select(PolicyDecision).where(PolicyDecision.case_id == c.id)
            .order_by(PolicyDecision.timestamp.desc()).limit(1)
        )
        last_pd = last_pd_r.scalar_one_or_none()

        last_ae_r = await db.execute(
            select(AuditEvent).where(AuditEvent.case_id == c.id)
            .order_by(AuditEvent.timestamp.desc()).limit(1)
        )
        last_ae = last_ae_r.scalar_one_or_none()

        pm = "card"
        if c.source_type == "payment":
            pay = await db.get(Payment, c.source_id)
            if pay and pay.method:
                pm = pay.method
        elif c.source_type == "subscription":
            sub = await db.get(Subscription, c.source_id)
            if sub and sub.mandate_type:
                pm = sub.mandate_type
        elif c.source_type == "invoice":
            pm = "netbanking"

        # Apply payment_method filter if specified
        if payment_method and pm.lower() != payment_method.lower():
            continue

        items.append(_serialize_case(c, customer, last_ai, last_pd, last_ae, pm))

    # Search filter (post-fetch across customer, ID, root_cause, scenario, notes)
    if search:
        search_lower = search.lower()
        items = [
            i for i in items
            if search_lower in (i.get("customer_name") or "").lower()
            or search_lower in (i.get("customer_email") or "").lower()
            or search_lower in i["id"].lower()
            or search_lower in (i.get("root_cause") or "").lower()
            or search_lower in i["scenario_type"].lower()
            or search_lower in (i.get("notes") or "").lower()
            or search_lower in (i.get("payment_method") or "").lower()
        ]

    return {
        "items": items,
        "total": len(items) if (payment_method or search) else total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{case_id}")
async def get_case(case_id: str, db: AsyncSession = Depends(get_db)):
    case = await db.get(RecoveryCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    customer = await db.get(Customer, case.customer_id)

    ai_r = await db.execute(
        select(AIRecommendation).where(AIRecommendation.case_id == case_id)
        .order_by(AIRecommendation.created_at.asc())
    )
    ais = ai_r.scalars().all()

    pd_r = await db.execute(
        select(PolicyDecision).where(PolicyDecision.case_id == case_id)
        .order_by(PolicyDecision.timestamp.asc())
    )
    pds = pd_r.scalars().all()

    iv_r = await db.execute(
        select(Intervention).where(Intervention.case_id == case_id)
        .order_by(Intervention.requested_at.asc())
    )
    ivs = iv_r.scalars().all()

    ae_r = await db.execute(
        select(AuditEvent).where(AuditEvent.case_id == case_id)
        .order_by(AuditEvent.timestamp.asc())
    )
    aes = ae_r.scalars().all()

    last_ai = ais[-1] if ais else None
    last_pd = pds[-1] if pds else None
    last_ae = aes[-1] if aes else None

    pm = "card"
    if case.source_type == "payment":
        pay = await db.get(Payment, case.source_id)
        if pay and pay.method:
            pm = pay.method
    elif case.source_type == "subscription":
        sub = await db.get(Subscription, case.source_id)
        if sub and sub.mandate_type:
            pm = sub.mandate_type
    elif case.source_type == "invoice":
        pm = "netbanking"

    return {
        **_serialize_case(case, customer, last_ai, last_pd, last_ae, pm),
        "customer": {
            "id": customer.id, "name": customer.name, "email": customer.email,
            "phone": customer.phone, "language_preference": customer.language_preference,
            "risk_segment": customer.risk_segment, "data_source": customer.data_source,
        } if customer else None,
        "ai_recommendations": [_serialize_ai(a) for a in ais],
        "policy_decisions": [_serialize_policy(p) for p in pds],
        "interventions": [_serialize_intervention(iv) for iv in ivs],
        "audit_events": [_serialize_audit(e) for e in aes],
        "promises": [],
    }


@router.post("/{case_id}/run")
async def run_case(case_id: str, db: AsyncSession = Depends(get_db)):
    """Run the full recovery engine pipeline on a case."""
    from app.recovery.engine import run_recovery_engine
    case = await db.get(RecoveryCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    result = await run_recovery_engine(case_id, db)
    await db.commit()
    return result


@router.post("/{case_id}/escalate")
async def escalate_case(case_id: str, body: dict = None, db: AsyncSession = Depends(get_db)):
    """Escalate a case to human ops."""
    import uuid
    from datetime import datetime
    case = await db.get(RecoveryCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    reason = (body or {}).get("reason", "Manual escalation from Aira Recovery Queue")
    case.status = "ESCALATED"
    case.updated_at = datetime.utcnow()

    # Create intervention
    iv = Intervention(
        id=str(uuid.uuid4()),
        case_id=case_id,
        action="ESCALATE_TO_HUMAN",
        channel="manual",
        requested_at=datetime.utcnow(),
        executed_at=datetime.utcnow(),
        result="CUSTOMER_ACTION_REQUIRED",
        amount_recovered=0.0,
        notes=reason,
    )
    db.add(iv)

    # Create audit event
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=case_id,
        timestamp=datetime.utcnow(),
        event_type="CASE_ESCALATED",
        actor="OPS_USER",
        action="Escalated to human review",
        reason=reason,
    )
    db.add(audit)
    await db.commit()
    return {"status": "ESCALATED", "case_id": case_id, "reason": reason}


@router.post("/bulk-action")
async def bulk_case_action(body: dict, db: AsyncSession = Depends(get_db)):
    """Execute bulk action on selected cases."""
    from app.recovery.engine import run_recovery_engine
    case_ids = body.get("case_ids", [])
    action = body.get("action", "RUN_RECOVERY")

    if not case_ids:
        raise HTTPException(status_code=400, detail="No case_ids provided")

    processed = 0
    succeeded = 0
    total_recovered = 0.0
    results = []

    for cid in case_ids:
        case = await db.get(RecoveryCase, cid)
        if not case:
            continue
        processed += 1

        if action == "RUN_RECOVERY":
            res = await run_recovery_engine(cid, db)
            recovered = res.get("amount_recovered", 0.0)
            if res.get("status") == "RECOVERED":
                succeeded += 1
                total_recovered += recovered
            results.append({"case_id": cid, "status": res.get("status"), "recovered": recovered})

        elif action == "ESCALATE":
            import uuid
            from datetime import datetime
            case.status = "ESCALATED"
            case.updated_at = datetime.utcnow()
            audit = AuditEvent(
                id=str(uuid.uuid4()),
                case_id=cid,
                timestamp=datetime.utcnow(),
                event_type="CASE_ESCALATED",
                actor="OPS_USER",
                action="Bulk escalated to human review",
                reason="Bulk queue intervention",
            )
            db.add(audit)
            succeeded += 1
            results.append({"case_id": cid, "status": "ESCALATED"})

        elif action == "STOP":
            import uuid
            from datetime import datetime
            case.status = "STOPPED"
            case.updated_at = datetime.utcnow()
            audit = AuditEvent(
                id=str(uuid.uuid4()),
                case_id=cid,
                timestamp=datetime.utcnow(),
                event_type="CASE_STOPPED",
                actor="OPS_USER",
                action="Bulk stopped by operator",
                reason="Bulk queue intervention",
            )
            db.add(audit)
            succeeded += 1
            results.append({"case_id": cid, "status": "STOPPED"})

    await db.commit()
    return {
        "processed": processed,
        "succeeded": succeeded,
        "total_recovered": total_recovered,
        "results": results,
    }


@router.post("/{case_id}/intervene")
async def intervene(case_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Manually trigger an intervention on a case."""
    from app.recovery.engine import execute_intervention
    case = await db.get(RecoveryCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    result = await execute_intervention(case_id, body.get("action"), body.get("channel"), db)
    await db.commit()
    return result


@router.get("/{case_id}/audit")
async def get_audit(case_id: str, db: AsyncSession = Depends(get_db)):
    ae_r = await db.execute(
        select(AuditEvent).where(AuditEvent.case_id == case_id)
        .order_by(AuditEvent.timestamp.asc())
    )
    return [_serialize_audit(e) for e in ae_r.scalars().all()]
