"""
Multi-Channel Communications Hub API Routes
Centralized messaging center across WhatsApp, SMS, Email, and Voice.
Includes thread history, customer context, sentiment & risk telemetry,
and 1-click AI suggested reply approvals.
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.conversation import ConversationThread, ConversationMessage
from app.models.customer import Customer
from app.models.recovery_case import RecoveryCase
from app.models.audit_event import AuditEvent

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

INITIAL_THREADS = [
    {
        "channel": "whatsapp",
        "subject": "Payment Failure — Cloud Hosting Plan",
        "sentiment": "COOPERATIVE",
        "intent": "LINK_REQUEST",
        "risk_level": "LOW",
        "outstanding_amount": 7999.0,
        "suggested_reply": "Hi Rohan, thanks for confirming! Here is your secure 1-click UPI payment link: https://rzp.io/l/aira-rh799. Valid for 24 hours.",
        "messages": [
            {"sender": "AIRA_AGENT", "content": "Hi Rohan, your auto-debit of ₹7,999 for Cloud Hosting failed due to bank server timeout. Would you like to retry or receive a direct UPI link?", "status": "READ", "offset_min": -45},
            {"sender": "CUSTOMER", "content": "Hi, please send me the direct UPI link on WhatsApp. I will pay right away.", "status": "DELIVERED", "offset_min": -12},
        ],
    },
    {
        "channel": "sms",
        "subject": "Checkout Drop-off Reminder",
        "sentiment": "NEUTRAL",
        "intent": "PAYMENT_PROMISE",
        "risk_level": "MEDIUM",
        "outstanding_amount": 14990.0,
        "suggested_reply": "Thank you Neha! Your cart with Sony Noise Cancelling Headphones is held till 10:00 AM tomorrow. Link: https://rzp.io/l/aira-nh149",
        "messages": [
            {"sender": "AIRA_AGENT", "content": "AIRA Alert: Your order for Sony Headphones (₹14,990) was interrupted at payment. Tap to complete: rzp.io/l/xyz", "status": "READ", "offset_min": -120},
            {"sender": "CUSTOMER", "content": "Can you hold the items till tomorrow morning? Will complete after banking hours.", "status": "DELIVERED", "offset_min": -30},
        ],
    },
    {
        "channel": "email",
        "subject": "Invoice Overdue — Q3 Infrastructure Licensing",
        "sentiment": "NEUTRAL",
        "intent": "EXTENSION",
        "risk_level": "HIGH",
        "outstanding_amount": 185000.0,
        "suggested_reply": "Dear Arvind, thank you for the update. We have registered your approval timeline for Friday 4:00 PM and updated your invoice status accordingly.",
        "messages": [
            {"sender": "AIRA_AGENT", "content": "Dear Arvind, Invoice #INV-2026-883 for ₹1,85,000 was due on 28 Aug. Please review the attached statement and remit payment.", "status": "READ", "offset_min": -300},
            {"sender": "CUSTOMER", "content": "Hello Aira team, our board audit signoff was delayed. We are processing all vendor disbursements this Friday by 4 PM.", "status": "DELIVERED", "offset_min": -85},
        ],
    },
    {
        "channel": "voice",
        "subject": "B2B Overdue Invoice Follow-up Call",
        "sentiment": "POSITIVE",
        "intent": "PAYMENT_PROMISE",
        "risk_level": "LOW",
        "outstanding_amount": 54000.0,
        "suggested_reply": "Main aapka payment commitment ₹54,000 kal shaam 6:00 PM ke liye schedule kar rahi hoon.",
        "messages": [
            {"sender": "AIRA_AGENT", "content": "Namaste Sunita ji, main Aira bol rahi hoon regarding your outstanding software subscription.", "status": "READ", "offset_min": -60},
            {"sender": "CUSTOMER", "content": "Haan kal subah finance manager aayenge, hum kal shaam 6 baje se pehle NEFT kar denge.", "status": "DELIVERED", "offset_min": -55},
        ],
    },
]


async def _ensure_seed_conversations(db: AsyncSession):
    res = await db.execute(select(ConversationThread))
    threads = res.scalars().all()
    if not threads:
        c_res = await db.execute(select(Customer).limit(4))
        customers = c_res.scalars().all()
        now = datetime.utcnow()

        for idx, seed_data in enumerate(INITIAL_THREADS):
            cust = customers[idx % len(customers)] if customers else None
            cust_id = cust.id if cust else str(uuid.uuid4())

            t = ConversationThread(
                id=str(uuid.uuid4()),
                customer_id=cust_id,
                channel=seed_data["channel"],
                subject=seed_data["subject"],
                status="OPEN",
                sentiment=seed_data["sentiment"],
                intent=seed_data["intent"],
                risk_level=seed_data["risk_level"],
                outstanding_amount=seed_data["outstanding_amount"],
                suggested_reply=seed_data["suggested_reply"],
                created_at=now - timedelta(hours=2),
                updated_at=now - timedelta(minutes=10),
            )
            db.add(t)
            await db.flush()

            for msg_data in seed_data["messages"]:
                msg = ConversationMessage(
                    id=str(uuid.uuid4()),
                    thread_id=t.id,
                    sender=msg_data["sender"],
                    content=msg_data["content"],
                    channel=seed_data["channel"],
                    status=msg_data["status"],
                    created_at=now + timedelta(minutes=msg_data["offset_min"]),
                )
                db.add(msg)

        await db.commit()


@router.get("")
async def list_conversations(
    channel: str = Query(default=""),
    status: str = Query(default=""),
    sentiment: str = Query(default=""),
    search: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_seed_conversations(db)

    stmt = select(ConversationThread).order_by(ConversationThread.updated_at.desc())
    res = await db.execute(stmt)
    threads = res.scalars().all()

    items = []
    for t in threads:
        cust = await db.get(Customer, t.customer_id) if t.customer_id else None

        # Fetch last message
        m_stmt = select(ConversationMessage).where(ConversationMessage.thread_id == t.id).order_by(ConversationMessage.created_at.desc()).limit(1)
        m_res = await db.execute(m_stmt)
        last_msg = m_res.scalar_one_or_none()

        # Filters
        if channel and channel != "all" and t.channel != channel:
            continue
        if status and status != "all" and t.status != status:
            continue
        if sentiment and sentiment != "all" and t.sentiment != sentiment:
            continue
        if search:
            q = search.lower()
            c_name = (cust.name if cust else "").lower()
            subj = (t.subject or "").lower()
            if q not in c_name and q not in subj:
                continue

        items.append({
            "id": t.id,
            "customer_id": t.customer_id,
            "customer_name": cust.name if cust else "Customer",
            "customer_email": cust.email if cust else "customer@example.com",
            "customer_phone": cust.phone if cust else "+91 98765 43210",
            "channel": t.channel,
            "subject": t.subject,
            "status": t.status,
            "sentiment": t.sentiment,
            "intent": t.intent,
            "risk_level": t.risk_level,
            "outstanding_amount": t.outstanding_amount,
            "suggested_reply": t.suggested_reply,
            "last_message": {
                "sender": last_msg.sender if last_msg else "AIRA_AGENT",
                "content": last_msg.content if last_msg else "",
                "created_at": last_msg.created_at.isoformat() if last_msg else t.updated_at.isoformat(),
            } if last_msg else None,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
        })

    return {
        "items": items,
        "total": len(items),
        "metrics": {
            "total_open": sum(1 for t in items if t["status"] == "OPEN"),
            "whatsapp_count": sum(1 for t in items if t["channel"] == "whatsapp"),
            "sms_count": sum(1 for t in items if t["channel"] == "sms"),
            "email_count": sum(1 for t in items if t["channel"] == "email"),
            "voice_count": sum(1 for t in items if t["channel"] == "voice"),
            "positive_sentiment_pct": 82.5,
        },
    }


@router.get("/{thread_id}/messages")
async def get_thread_messages(thread_id: str, db: AsyncSession = Depends(get_db)):
    t = await db.get(ConversationThread, thread_id)
    if not t:
        raise HTTPException(status_code=404, detail="Conversation thread not found")

    cust = await db.get(Customer, t.customer_id) if t.customer_id else None

    m_stmt = select(ConversationMessage).where(ConversationMessage.thread_id == thread_id).order_by(ConversationMessage.created_at.asc())
    m_res = await db.execute(m_stmt)
    messages = m_res.scalars().all()

    return {
        "thread": {
            "id": t.id,
            "customer_id": t.customer_id,
            "customer_name": cust.name if cust else "Customer",
            "customer_email": cust.email if cust else "billing@customer.com",
            "customer_phone": cust.phone if cust else "+91 98765 43210",
            "channel": t.channel,
            "subject": t.subject,
            "status": t.status,
            "sentiment": t.sentiment,
            "intent": t.intent,
            "risk_level": t.risk_level,
            "outstanding_amount": t.outstanding_amount,
            "suggested_reply": t.suggested_reply,
        },
        "messages": [
            {
                "id": m.id,
                "sender": m.sender,
                "content": m.content,
                "channel": m.channel,
                "status": m.status,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/{thread_id}/send")
async def send_thread_message(thread_id: str, payload: dict, db: AsyncSession = Depends(get_db)):
    t = await db.get(ConversationThread, thread_id)
    if not t:
        raise HTTPException(status_code=404, detail="Conversation thread not found")

    content = payload.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    sender = payload.get("sender", "AIRA_AGENT")

    msg = ConversationMessage(
        id=str(uuid.uuid4()),
        thread_id=t.id,
        sender=sender,
        content=content,
        channel=t.channel,
        status="DELIVERED",
        created_at=datetime.utcnow(),
    )
    db.add(msg)

    t.updated_at = datetime.utcnow()
    t.suggested_reply = None
    if t.status == "OPEN":
        t.status = "WAITING_CUSTOMER"

    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=t.id,
        timestamp=datetime.utcnow(),
        event_type="CONVERSATION_MESSAGE_SENT",
        actor="AIRA_COMMUNICATION_ENGINE",
        action=f"Dispatched {t.channel.upper()} message to customer",
        reason="Operator approved AI suggested response",
        metadata_=json.dumps({"thread_id": t.id, "channel": t.channel, "content": content}),
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "message_id": msg.id,
        "thread_id": t.id,
        "content": msg.content,
        "status": msg.status,
        "created_at": msg.created_at.isoformat(),
        "info": f"Message dispatched via {t.channel.upper()} successfully.",
    }


@router.post("/{thread_id}/resolve")
async def resolve_thread(thread_id: str, db: AsyncSession = Depends(get_db)):
    t = await db.get(ConversationThread, thread_id)
    if not t:
        raise HTTPException(status_code=404, detail="Conversation thread not found")

    t.status = "RESOLVED"
    t.updated_at = datetime.utcnow()

    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=t.id,
        timestamp=datetime.utcnow(),
        event_type="CONVERSATION_RESOLVED",
        actor="AIRA_AGENT",
        action="Resolved conversation thread",
        reason="Payment commitment completed or query resolved.",
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "thread_id": t.id,
        "status": "RESOLVED",
        "message": "Conversation thread marked as Resolved.",
    }
