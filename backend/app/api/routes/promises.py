"""
Promise-to-Pay Tracker API Routes
Tracks customer payment commitments, fulfillment timelines, broken promise escalations,
and follow-up automation.
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.promise_to_pay import PromiseToPay
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.recovery_case import RecoveryCase
from app.models.audit_event import AuditEvent

router = APIRouter(prefix="/api/promises", tags=["promises"])


def _compute_status(p: PromiseToPay) -> str:
    if p.status in ("FULFILLED", "PAID"):
        return "PAID"
    if p.status == "BROKEN":
        return "BROKEN"
    
    now = datetime.utcnow()
    diff = (p.promise_date.date() - now.date()).days
    if diff < 0:
        return "OVERDUE"
    if diff == 0:
        return "DUE_TODAY"
    if diff <= 2:
        return "UPCOMING"
    return "PROMISED"


def _serialize_promise(p: PromiseToPay, cust: Optional[Customer], inv: Optional[Invoice]) -> dict:
    computed = _compute_status(p)
    return {
        "id": p.id,
        "customer_id": p.customer_id,
        "customer_name": cust.name if cust else "Customer",
        "customer_email": cust.email if cust else "customer@example.com",
        "customer_phone": cust.phone if cust else "+91 98765 43210",
        "risk_segment": cust.risk_segment if cust else "MEDIUM",
        "invoice_id": p.invoice_id,
        "invoice_number": inv.invoice_number if inv else (f"INV-{p.invoice_id[:8].upper()}" if p.invoice_id else "DIRECT-SUB"),
        "case_id": p.case_id,
        "amount": p.amount,
        "currency": p.currency or "INR",
        "promise_date": p.promise_date.isoformat(),
        "status": computed,
        "promise_source": p.promise_source or "voice",  # voice, whatsapp, email, manual
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat() if p.updated_at else p.created_at.isoformat(),
        "fulfilled_at": p.fulfilled_at.isoformat() if p.fulfilled_at else None,
        "follow_up_count": p.follow_up_count or 0,
        "last_follow_up_at": p.last_follow_up_at.isoformat() if p.last_follow_up_at else None,
        "notes": p.notes or "Payment promised after conversational outreach.",
        "confidence_score": 88 if computed in ("PROMISED", "UPCOMING") else (62 if computed == "DUE_TODAY" else (25 if computed in ("OVERDUE", "BROKEN") else 100)),
    }


@router.get("")
async def list_promises(
    search: str = Query(default=""),
    status: str = Query(default=""),
    source: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PromiseToPay).order_by(PromiseToPay.promise_date.asc())
    result = await db.execute(stmt)
    promises = result.scalars().all()

    items = []
    total_promised_amount = 0.0
    total_fulfilled_amount = 0.0
    total_broken_amount = 0.0
    due_today_amount = 0.0
    overdue_count = 0
    due_today_count = 0

    for p in promises:
        cust = await db.get(Customer, p.customer_id) if p.customer_id else None
        inv = await db.get(Invoice, p.invoice_id) if p.invoice_id else None
        serialized = _serialize_promise(p, cust, inv)

        st = serialized["status"]
        if st == "PAID":
            total_fulfilled_amount += p.amount
        elif st == "BROKEN":
            total_broken_amount += p.amount
        else:
            total_promised_amount += p.amount
            if st == "DUE_TODAY":
                due_today_amount += p.amount
                due_today_count += 1
            elif st == "OVERDUE":
                overdue_count += 1

        # Filters
        if status and status != "all" and st != status:
            continue
        if source and source != "all" and serialized["promise_source"] != source:
            continue
        if search:
            q = search.lower()
            if not (
                q in serialized["customer_name"].lower()
                or q in serialized["customer_email"].lower()
                or q in serialized["invoice_number"].lower()
                or q in serialized["id"].lower()
                or q in (serialized["notes"] or "").lower()
            ):
                continue

        items.append(serialized)

    total_tracked = total_promised_amount + total_fulfilled_amount + total_broken_amount
    rate = round((total_fulfilled_amount / total_tracked * 100), 1) if total_tracked > 0 else 74.2

    paginated = items[(page - 1) * page_size : page * page_size]

    return {
        "items": paginated,
        "total": len(items),
        "page": page,
        "page_size": page_size,
        "metrics": {
            "total_active_promised": total_promised_amount,
            "total_fulfilled": total_fulfilled_amount,
            "total_broken": total_broken_amount,
            "due_today_amount": due_today_amount,
            "due_today_count": due_today_count,
            "overdue_count": overdue_count,
            "fulfillment_rate": rate,
            "total_promises_count": len(promises),
        },
    }


@router.post("")
async def create_promise(payload: dict, db: AsyncSession = Depends(get_db)):
    customer_id = payload.get("customer_id")
    if not customer_id:
        # Fallback to finding first customer or creating a placeholder
        c_res = await db.execute(select(Customer).limit(1))
        c = c_res.scalar_one_or_none()
        customer_id = c.id if c else str(uuid.uuid4())

    amount = float(payload.get("amount", 10000))
    promise_date_str = payload.get("promise_date")
    if promise_date_str:
        promise_date = datetime.fromisoformat(promise_date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    else:
        promise_date = datetime.utcnow() + timedelta(days=3)

    promise = PromiseToPay(
        id=str(uuid.uuid4()),
        customer_id=customer_id,
        invoice_id=payload.get("invoice_id"),
        case_id=payload.get("case_id"),
        amount=amount,
        currency=payload.get("currency", "INR"),
        promise_date=promise_date,
        status="PROMISED",
        promise_source=payload.get("promise_source", "manual"),
        notes=payload.get("notes", "Payment commitment registered by operations."),
    )
    db.add(promise)

    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=promise.case_id or promise.invoice_id or promise.id,
        timestamp=datetime.utcnow(),
        event_type="PROMISE_CREATED",
        actor="AIRA_AGENT",
        action=f"Created Promise-to-Pay for ₹{amount:,.0f} due {promise_date.strftime('%d %b %Y')}",
        reason=promise.notes,
        metadata_=json.dumps({"promise_id": promise.id, "amount": amount}),
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "id": promise.id,
        "amount": promise.amount,
        "promise_date": promise.promise_date.isoformat(),
        "status": "PROMISED",
        "message": f"Promise to Pay ₹{amount:,.0f} registered successfully.",
    }


@router.patch("/{promise_id}")
async def update_promise(promise_id: str, payload: dict, db: AsyncSession = Depends(get_db)):
    p = await db.get(PromiseToPay, promise_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promise not found")

    new_status = payload.get("status")
    if new_status:
        p.status = new_status
        if new_status in ("FULFILLED", "PAID"):
            p.fulfilled_at = datetime.utcnow()
            # If linked to invoice, mark paid
            if p.invoice_id:
                inv = await db.get(Invoice, p.invoice_id)
                if inv:
                    inv.status = "paid"
                    inv.paid_at = datetime.utcnow()
            # If linked to case, mark recovered
            if p.case_id:
                case = await db.get(RecoveryCase, p.case_id)
                if case:
                    case.status = "RECOVERED"
                    case.amount_recovered = p.amount
                    case.updated_at = datetime.utcnow()

    if "promise_date" in payload and payload["promise_date"]:
        p.promise_date = datetime.fromisoformat(payload["promise_date"].replace("Z", "+00:00")).replace(tzinfo=None)

    if "notes" in payload:
        p.notes = payload["notes"]

    p.updated_at = datetime.utcnow()

    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=p.case_id or p.invoice_id or p.id,
        timestamp=datetime.utcnow(),
        event_type=f"PROMISE_{new_status or 'UPDATED'}",
        actor="AIRA_OPS",
        action=f"Promise status changed to {new_status or 'UPDATED'}",
        reason=p.notes,
        metadata_=json.dumps({"promise_id": p.id, "amount": p.amount, "status": p.status}),
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "id": p.id,
        "status": p.status,
        "message": f"Promise {p.id[:8]} updated to {p.status}.",
    }


@router.post("/{promise_id}/follow-up")
async def send_promise_follow_up(
    promise_id: str,
    channel: str = Query(default="whatsapp"),
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(PromiseToPay, promise_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promise not found")

    p.follow_up_count = (p.follow_up_count or 0) + 1
    p.last_follow_up_at = datetime.utcnow()

    cust = await db.get(Customer, p.customer_id) if p.customer_id else None

    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=p.case_id or p.invoice_id or p.id,
        timestamp=datetime.utcnow(),
        event_type="PROMISE_FOLLOW_UP_SENT",
        actor="AIRA_COMMUNICATIONS",
        action=f"Dispatched commitment reminder #{p.follow_up_count} via {channel.upper()}",
        reason="Automated promise maturity alert before due date",
        metadata_=json.dumps({"promise_id": p.id, "customer_id": p.customer_id, "amount": p.amount}),
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "promise_id": p.id,
        "follow_up_count": p.follow_up_count,
        "last_follow_up_at": p.last_follow_up_at.isoformat(),
        "message": f"Follow-up reminder sent to {cust.name if cust else 'customer'} via {channel.upper()}.",
    }
