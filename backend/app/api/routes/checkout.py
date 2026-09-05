"""
Checkout Recovery API Routes
Supports abandoned checkout session tracking, funnel analytics,
smart Razorpay payment link generation, Policy Governor verification,
and autonomous recovery simulation.
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.checkout_session import CheckoutSession
from app.models.customer import Customer
from app.models.recovery_case import RecoveryCase
from app.models.policy_decision import PolicyDecision
from app.models.ai_recommendation import AIRecommendation
from app.models.intervention import Intervention
from app.models.audit_event import AuditEvent
from app.policy.governor import evaluate_action
from app.simulator.simulator import simulate_recovery

router = APIRouter(prefix="/api/checkout", tags=["checkout"])

DEMO_PRODUCTS = [
    ("Apple iPhone 16 Pro Max (256GB, Desert Titanium)", 144900, "otp_auth", "3DS_TIMEOUT", "card"),
    ("Sony WH-1000XM5 Noise Cancelling Headphones", 29990, "bank_redirect", "UPI_APP_SWITCH_FAILED", "upi"),
    ("MacBook Air 13\" M3 (16GB RAM, 512GB SSD)", 134900, "otp_auth", "OTP_NOT_ENTERED", "netbanking"),
    ("Samsung Galaxy S25 Ultra 5G (Titanium Gray)", 129999, "payment_method", "PAYMENT_REJECTED", "emi"),
    ("Dyson V12 Detect Slim Total Clean Vacuum", 55900, "details", "SHIPPING_ADDRESS_DROPOFF", "card"),
    ("Tanishq 22K Yellow Gold Diamond Solitaire Ring", 88500, "otp_auth", "OTP_NOT_ENTERED", "card"),
    ("BoAt Airdopes 141 ANC + Wave Pro Smartwatch Combo", 3999, "bank_redirect", "UPI_APP_SWITCH_FAILED", "upi"),
    ("Titan Edge Ceramic Slim Monochrome Watch", 24995, "payment_method", "CART_ABANDONED", "upi"),
    ("Nike Air Jordan 1 Retro High OG Chicago", 18995, "bank_redirect", "UPI_APP_SWITCH_FAILED", "upi"),
    ("Marshall Stanmore III Bluetooth Home Speaker", 34999, "otp_auth", "3DS_TIMEOUT", "card"),
    ("Cultpass ELITE 12-Month All-Access Gym Pass", 17500, "payment_method", "CART_ABANDONED", "upi"),
    ("Curefoods Gourmet 30-Day Healthy Subscription", 9499, "cart", "CART_ABANDONED", "upi"),
    ("Bose QuietComfort Ultra Wireless Earbuds", 25900, "otp_auth", "OTP_NOT_ENTERED", "card"),
    ("Asus ROG Zephyrus G16 Gaming Laptop", 189990, "details", "PAYMENT_REJECTED", "netbanking"),
    ("OnePlus 13 (16GB, 512GB Emerald Green)", 69999, "bank_redirect", "UPI_APP_SWITCH_FAILED", "upi"),
]


def _build_timeline(session: CheckoutSession, case: Optional[RecoveryCase], interventions: list[Intervention]) -> list[dict]:
    timeline = []
    created_time = session.created_at.isoformat() if session.created_at else datetime.utcnow().isoformat()

    # 1. Cart Drop-off Event
    step_label = session.dropoff_step.replace("_", " ").title()
    timeline.append({
        "stage": f"Drop-off at {step_label}",
        "status": "COMPLETED",
        "timestamp": created_time,
        "detail": f"Customer stalled at '{step_label}' step. Reason: {session.dropoff_reason.replace('_', ' ').title()}",
    })

    # 2. AI Drop-off Diagnosis
    timeline.append({
        "stage": "AI Friction Classification",
        "status": "COMPLETED",
        "timestamp": created_time,
        "detail": f"Cart Value: ₹{session.cart_value:,.0f} | Preferred Method: {session.payment_method.upper()} | Autonomous strategy: Smart Payment Link with 1-click UPI fallback.",
    })

    # 3. Interventions / Nudges
    for i, iv in enumerate(interventions, 1):
        timeline.append({
            "stage": f"Recovery Nudge #{i} ({iv.channel.upper()})",
            "status": "COMPLETED" if iv.result == "SUCCESS" else "FAILED",
            "timestamp": iv.executed_at.isoformat() if iv.executed_at else created_time,
            "detail": f"{iv.notes or 'Payment link dispatched.'} Result: {iv.result}",
        })

    # 4. Current / Terminal State
    if session.status == "recovered":
        timeline.append({
            "stage": "Checkout Recovered",
            "status": "COMPLETED",
            "timestamp": session.recovered_at.isoformat() if session.recovered_at else datetime.utcnow().isoformat(),
            "detail": f"Successfully recovered ₹{session.recovered_amount:,.0f} in {session.recovery_duration_minutes} minutes.",
        })
    elif session.status == "escalated":
        timeline.append({
            "stage": "Escalated to High-Value Concierge",
            "status": "ACTION_REQUIRED",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": "Cart value exceeds policy auto-recovery ceiling or repeat dropoffs detected. Human sales concierge assigned.",
        })
    elif session.status == "link_sent":
        timeline.append({
            "stage": "Payment Link Active",
            "status": "SCHEDULED",
            "timestamp": (session.created_at + timedelta(minutes=15)).isoformat() if session.created_at else datetime.utcnow().isoformat(),
            "detail": f"Smart link sent via WhatsApp & SMS. Awaiting customer payment.",
        })
    else:
        timeline.append({
            "stage": "Recovery Link Ready",
            "status": "PENDING",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": "Ready for automated Razorpay smart payment link dispatch.",
        })

    return timeline


@router.get("")
async def list_checkout_sessions(
    search: str = Query(default=""),
    status: str = Query(default=""),
    dropoff_step: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CheckoutSession)

    if status and status.lower() != "all":
        stmt = stmt.where(CheckoutSession.status == status.lower())
    if dropoff_step and dropoff_step.lower() != "all":
        stmt = stmt.where(CheckoutSession.dropoff_step == dropoff_step.lower())

    stmt = stmt.order_by(CheckoutSession.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    sessions = result.scalars().all()

    # If database has zero checkout sessions, automatically seed demo data
    if not sessions and not search and not status and not dropoff_step:
        await seed_checkout_sessions(db=db)
        result = await db.execute(stmt)
        sessions = result.scalars().all()

    items = []
    for s in sessions:
        # Load customer
        cust_res = await db.execute(select(Customer).where(Customer.id == s.customer_id))
        cust = cust_res.scalar_one_or_none()

        # Load linked recovery case
        case = None
        if s.case_id:
            case_res = await db.execute(select(RecoveryCase).where(RecoveryCase.id == s.case_id))
            case = case_res.scalar_one_or_none()
        elif cust:
            case_res = await db.execute(
                select(RecoveryCase).where(
                    RecoveryCase.customer_id == cust.id,
                    RecoveryCase.scenario_type == "CHECKOUT_DROPOFF"
                ).order_by(RecoveryCase.created_at.desc())
            )
            case = case_res.scalars().first()

        # Load interventions for this case
        interventions = []
        if case:
            iv_res = await db.execute(
                select(Intervention).where(Intervention.case_id == case.id).order_by(Intervention.requested_at)
            )
            interventions = iv_res.scalars().all()

        timeline = _build_timeline(s, case, interventions)

        # Apply search filter if customer loaded
        if search:
            q = search.lower()
            match_cust = cust and (q in cust.name.lower() or q in cust.email.lower() or (cust.phone and q in cust.phone))
            match_item = s.items_summary and q in s.items_summary.lower()
            match_id = q in s.id.lower()
            if not (match_cust or match_item or match_id):
                continue

        # Check policy status for automated nudge
        policy_info = {
            "eligible": s.reminder_count < 3 and s.status != "recovered",
            "decision": "ALLOW" if s.reminder_count < 3 else "BLOCK",
            "reason": "Ready for multi-channel recovery link" if s.reminder_count < 3 else "Maximum 3 recovery nudges reached (RBI/TRAI compliance limit)",
        }

        items.append({
            "id": s.id,
            "customer_id": s.customer_id,
            "customer_name": cust.name if cust else "Unknown Shopper",
            "customer_email": cust.email if cust else "shopper@example.in",
            "customer_phone": cust.phone if cust else "+91 98765 43210",
            "risk_segment": cust.risk_segment if cust else "MEDIUM",
            "cart_value": s.cart_value,
            "currency": s.currency,
            "items_summary": s.items_summary,
            "dropoff_step": s.dropoff_step,
            "payment_method": s.payment_method,
            "dropoff_reason": s.dropoff_reason,
            "status": s.status,
            "payment_link_url": s.payment_link_url or f"https://rzp.io/l/aira_{s.id[:8]}",
            "reminder_count": s.reminder_count,
            "retry_count": s.retry_count,
            "recovered_amount": s.recovered_amount,
            "recovery_duration_minutes": s.recovery_duration_minutes,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "recovered_at": s.recovered_at.isoformat() if s.recovered_at else None,
            "case_id": case.id if case else None,
            "timeline": timeline,
            "policy_info": policy_info,
        })

    # Aggregate global KPI metrics
    all_res = await db.execute(select(CheckoutSession))
    all_sessions = all_res.scalars().all()

    total_sessions = len(all_sessions)
    total_abandoned_gmv = sum(s.cart_value for s in all_sessions)
    recovered_sessions = [s for s in all_sessions if s.status == "recovered"]
    recovered_gmv = sum(s.recovered_amount or s.cart_value for s in recovered_sessions)
    recovered_count = len(recovered_sessions)
    active_links = len([s for s in all_sessions if s.status == "link_sent"])
    recovery_rate_pct = round((recovered_count / total_sessions * 100), 1) if total_sessions > 0 else 0.0

    durations = [s.recovery_duration_minutes for s in recovered_sessions if s.recovery_duration_minutes > 0]
    avg_duration_mins = round(sum(durations) / len(durations)) if durations else 18

    # Funnel breakdown by dropoff_step
    funnel_steps = ["cart", "details", "payment_method", "otp_auth", "bank_redirect"]
    funnel_breakdown = []
    for step in funnel_steps:
        step_sessions = [s for s in all_sessions if s.dropoff_step == step]
        step_count = len(step_sessions)
        step_gmv = sum(s.cart_value for s in step_sessions)
        step_recovered = len([s for s in step_sessions if s.status == "recovered"])
        funnel_breakdown.append({
            "step": step,
            "label": step.replace("_", " ").title(),
            "count": step_count,
            "gmv": step_gmv,
            "recovered_count": step_recovered,
            "dropoff_share_pct": round((step_count / total_sessions * 100), 1) if total_sessions > 0 else 0.0,
        })

    # Top dropoff reasons breakdown
    reason_map: dict[str, dict] = {}
    for s in all_sessions:
        r = s.dropoff_reason or "UNKNOWN"
        if r not in reason_map:
            reason_map[r] = {"reason": r, "count": 0, "gmv": 0.0}
        reason_map[r]["count"] += 1
        reason_map[r]["gmv"] += s.cart_value

    top_reasons = sorted(reason_map.values(), key=lambda x: x["count"], reverse=True)[:5]

    top_dropoff = max(funnel_breakdown, key=lambda x: x["count"])["label"] if funnel_breakdown else "OTP Auth"

    metrics = {
        "total_abandoned_gmv": total_abandoned_gmv,
        "cart_gmv_at_risk": total_abandoned_gmv,
        "recovered_gmv": recovered_gmv,
        "recovery_rate_pct": recovery_rate_pct,
        "recovery_rate": recovery_rate_pct,
        "total_sessions": total_sessions,
        "total_dropoffs": total_sessions,
        "recovered_count": recovered_count,
        "active_links_count": active_links,
        "avg_recovery_duration_mins": avg_duration_mins,
        "top_dropoff_step": top_dropoff,
        "funnel_breakdown": funnel_breakdown,
        "top_reasons": top_reasons,
    }

    funnel = [
        {
            "stage": f["label"],
            "visitors": f["count"] * 2 + 15,
            "dropoffs": f["count"],
            "dropoff_pct": f["dropoff_share_pct"],
            "recovered": f["recovered_count"],
        }
        for f in funnel_breakdown
    ]

    return {
        "items": items,
        "metrics": metrics,
        "funnel": funnel,
        "page": page,
        "page_size": page_size,
        "total": len(items),
    }


@router.post("/{session_id}/send-link")
async def send_checkout_payment_link(
    session_id: str,
    channel: str = Query(default="whatsapp"),  # whatsapp, sms, email
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and dispatch a smart Razorpay payment link with 1-click UPI fallback.
    Evaluates Policy Governor guardrails (contact frequency, cooling-off window).
    """
    result = await db.execute(select(CheckoutSession).where(CheckoutSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Checkout session not found")

    # Load customer
    cust_res = await db.execute(select(Customer).where(Customer.id == session.customer_id))
    customer = cust_res.scalar_one_or_none()

    # Load or create recovery case
    case = None
    if session.case_id:
        c_res = await db.execute(select(RecoveryCase).where(RecoveryCase.id == session.case_id))
        case = c_res.scalar_one_or_none()
    if not case:
        case = RecoveryCase(
            id=str(uuid.uuid4()),
            customer_id=customer.id if customer else session.customer_id,
            source_type="checkout",
            source_id=session.id,
            scenario_type="CHECKOUT_DROPOFF",
            amount_at_risk=session.cart_value,
            amount_recovered=0.0,
            root_cause=session.dropoff_reason or "CUSTOMER_ABANDONED",
            status="OPEN",
            priority="HIGH" if session.cart_value >= 50000 else "MEDIUM",
            data_source="SYNTHETIC",
            notes=f"Autonomous checkout recovery link dispatched via {channel.upper()}",
        )
        db.add(case)
        session.case_id = case.id
        await db.flush()

    # Evaluate Policy Governor
    gov_decision = await evaluate_action(
        case=case,
        recommended_action="SEND_PAYMENT_LINK",
        payment_method=session.payment_method,
        amount=session.cart_value,
        mandate_status=None,
        attempt_count=session.reminder_count,
        last_attempt_at=session.created_at,
        mandate_type=None,
        db=db,
    )


    if gov_decision.decision == "BLOCK":
        return {
            "status": "BLOCKED",
            "message": f"Action blocked by Policy Governor: {gov_decision.reason}",
            "decision": gov_decision.decision,
            "rules_checked": [{"rule": r.rule_name, "passed": r.passed, "reason": r.reason} for r in gov_decision.rules_checked],
        }

    # Generate payment link
    link_url = f"https://rzp.io/l/aira_{session.id[:8]}"
    session.payment_link_url = link_url
    session.reminder_count += 1
    session.status = "link_sent"

    # Log Intervention
    iv = Intervention(
        id=str(uuid.uuid4()),
        case_id=case.id,
        action="SEND_PAYMENT_LINK",
        channel=channel,
        result="SUCCESS",
        executed_at=datetime.utcnow(),
        notes=f"Smart recovery link generated: {link_url} via {channel.upper()}",
    )
    db.add(iv)


    # Log Audit Event
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=case.id,
        timestamp=datetime.utcnow(),
        event_type="INTERVENTION_EXECUTED",
        actor="AIRA_AUTONOMOUS_ENGINE",
        action=f"Payment link dispatched to {customer.name if customer else 'Customer'} via {channel.upper()}",
        reason=f"Drop-off at {session.dropoff_step} ({session.dropoff_reason}). Cart: ₹{session.cart_value:,.0f}",
        metadata_=json.dumps({
            "session_id": session.id,
            "channel": channel,
            "link_url": link_url,
            "cart_value": session.cart_value,
            "reminder_count": session.reminder_count,
        }),
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "SENT",
        "message": f"Smart recovery link successfully dispatched via {channel.upper()}!",
        "payment_link_url": link_url,
        "reminder_count": session.reminder_count,
        "case_id": case.id,
        "policy_decision": gov_decision.decision,
    }


@router.post("/{session_id}/recover")
async def simulate_checkout_recovery(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Simulates customer opening the smart recovery link and completing authorization.
    Runs through recovery engine to record GMV recovered and close the loop.
    """
    result = await db.execute(select(CheckoutSession).where(CheckoutSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Checkout session not found")

    # Load customer & case
    cust_res = await db.execute(select(Customer).where(Customer.id == session.customer_id))
    customer = cust_res.scalar_one_or_none()

    case = None
    if session.case_id:
        c_res = await db.execute(select(RecoveryCase).where(RecoveryCase.id == session.case_id))
        case = c_res.scalar_one_or_none()

    # Simulate recovery outcome
    _ = simulate_recovery(
        root_cause="CUSTOMER_ABANDONED",
        action="SEND_PAYMENT_LINK",
        amount=float(session.cart_value),
        seed=42,
    )

    now = datetime.utcnow()
    duration_mins = max(5, int((now - session.created_at).total_seconds() // 60)) if session.created_at else 14

    # Successfully recover
    session.status = "recovered"
    session.recovered_amount = session.cart_value
    session.recovered_at = now
    session.recovery_duration_minutes = duration_mins

    if case:
        case.status = "RECOVERED"
        case.amount_recovered = session.cart_value
        case.updated_at = now

    # Log Intervention
    iv = Intervention(
        id=str(uuid.uuid4()),
        case_id=case.id if case else str(uuid.uuid4()),
        action="PAYMENT_CAPTURED",
        channel="web_checkout",
        result="SUCCESS",
        amount_recovered=float(session.cart_value),
        executed_at=now,
        notes=f"Customer clicked recovery payment link and completed payment of ₹{session.cart_value:,.0f} via 1-click UPI.",
    )
    db.add(iv)

    # Log Audit Event
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=case.id if case else str(uuid.uuid4()),
        timestamp=now,
        event_type="PAYMENT_RECOVERED",
        actor="AIRA_RECOVERY_ENGINE",
        action=f"Checkout GMV recovered: ₹{session.cart_value:,.0f}",
        reason=f"Customer completed transaction via smart link. Turnaround: {duration_mins} mins.",
        metadata_=json.dumps({
            "session_id": session.id,
            "recovered_amount": session.cart_value,
            "duration_mins": duration_mins,
            "items": session.items_summary,
        }),
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "RECOVERED",
        "message": f"Successfully recovered ₹{session.cart_value:,.0f}! Cart conversion finalized.",
        "amount_recovered": session.cart_value,
        "recovery_duration_minutes": duration_mins,
        "case_id": case.id if case else None,
    }


@router.post("/{session_id}/escalate")
async def escalate_checkout_session(
    session_id: str,
    reason: str = Query(default="High-value cart friction — concierge assistance requested"),
    db: AsyncSession = Depends(get_db),
):
    """
    Escalate high-value or stalled checkout to human concierge sales ops.
    """
    result = await db.execute(select(CheckoutSession).where(CheckoutSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Checkout session not found")

    session.status = "escalated"

    case = None
    if session.case_id:
        c_res = await db.execute(select(RecoveryCase).where(RecoveryCase.id == session.case_id))
        case = c_res.scalar_one_or_none()

    if case:
        case.status = "ESCALATED"
        case.priority = "CRITICAL"
        case.notes = f"{case.notes or ''} | Escalated: {reason}"

    # Log Audit Event
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=case.id if case else str(uuid.uuid4()),
        timestamp=datetime.utcnow(),
        event_type="CASE_ESCALATED",
        actor="OPERATOR",
        action="Checkout session escalated to concierge ops",
        reason=reason,
        metadata_=json.dumps({
            "session_id": session.id,
            "cart_value": session.cart_value,
            "items": session.items_summary,
        }),
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "ESCALATED",
        "message": "Checkout session escalated to concierge team.",
        "case_id": case.id if case else None,
    }


@router.post("/seed")
async def seed_checkout_sessions(
    count: int = Query(default=25, ge=5, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Seed realistic Indian e-commerce / D2C abandoned checkouts with authentic products and drop-off reasons.
    """
    import random
    from faker import Faker
    fake = Faker("en_IN")

    created = 0
    for i in range(count):
        prod_idx = i % len(DEMO_PRODUCTS)
        item_title, price, step, reason, method = DEMO_PRODUCTS[prod_idx]
        
        # Add slight price variance
        price_adj = round(price * random.uniform(0.95, 1.05) / 10) * 10

        # Create or pick customer
        cust = Customer(
            id=str(uuid.uuid4()),
            name=fake.name(),
            email=fake.email(),
            phone=f"+91 9{random.randint(100000000, 999999999)}",
            language_preference=random.choice(["en", "hi", "hinglish"]),
            risk_segment=random.choices(["LOW", "MEDIUM", "HIGH"], weights=[0.5, 0.35, 0.15])[0],
            data_source="SYNTHETIC",
            created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 96)),
        )
        db.add(cust)
        await db.flush()

        # Session status distribution: mostly abandoned or link_sent, some recovered
        status_choice = random.choices(["abandoned", "link_sent", "recovered", "escalated"], weights=[0.45, 0.3, 0.2, 0.05])[0]
        created_time = datetime.utcnow() - timedelta(hours=random.randint(1, 48))
        recovered_time = None
        duration = 0
        recovered_amt = 0.0

        if status_choice == "recovered":
            duration = random.randint(8, 45)
            recovered_time = created_time + timedelta(minutes=duration)
            recovered_amt = price_adj

        session = CheckoutSession(
            id=str(uuid.uuid4()),
            customer_id=cust.id,
            cart_value=price_adj,
            currency="INR",
            items_summary=item_title,
            dropoff_step=step,
            payment_method=method,
            dropoff_reason=reason,
            status=status_choice,
            payment_link_url=f"https://rzp.io/l/aira_{uuid.uuid4().hex[:8]}",
            reminder_count=1 if status_choice in ["link_sent", "recovered"] else 0,
            retry_count=1 if status_choice == "recovered" else 0,
            recovered_amount=recovered_amt,
            recovery_duration_minutes=duration,
            created_at=created_time,
            recovered_at=recovered_time,
        )
        db.add(session)
        await db.flush()

        # Create linked recovery case
        case = RecoveryCase(
            id=str(uuid.uuid4()),
            customer_id=cust.id,
            source_type="checkout",
            source_id=session.id,
            scenario_type="CHECKOUT_DROPOFF",
            amount_at_risk=price_adj,
            amount_recovered=recovered_amt,
            root_cause=reason,
            status="RECOVERED" if status_choice == "recovered" else ("ESCALATED" if status_choice == "escalated" else "OPEN"),
            priority="CRITICAL" if price_adj >= 100000 else ("HIGH" if price_adj >= 40000 else "MEDIUM"),
            data_source="SYNTHETIC",
            notes=f"Cart abandonment at {step} step ({reason}). Items: {item_title}",
            created_at=created_time,
            updated_at=recovered_time or created_time,
        )
        db.add(case)
        session.case_id = case.id
        await db.flush()

        # Initial Audit Event
        audit = AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            timestamp=created_time,
            event_type="CASE_CREATED",
            actor="SYSTEM",
            action=f"Checkout drop-off detected: ₹{price_adj:,.0f} at {step}",
            reason=f"Drop-off reason: {reason}. Product: {item_title}",
            metadata_=json.dumps({
                "session_id": session.id,
                "cart_value": price_adj,
                "dropoff_step": step,
                "payment_method": method,
            }),
        )
        db.add(audit)
        created += 1

    await db.commit()
    return {"message": f"Successfully seeded {created} checkout drop-off sessions with realistic Indian cart items.", "count": created}
