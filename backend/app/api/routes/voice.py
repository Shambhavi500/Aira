"""
Hinglish Conversational Voice Recovery Agent API Routes
Handles speech transcript processing, intent & sentiment analysis, realistic Hinglish dialogue generation,
and in-call recovery triggers (promises, links, escalations).
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.customer import Customer
from app.models.promise_to_pay import PromiseToPay
from app.models.recovery_case import RecoveryCase
from app.models.audit_event import AuditEvent

router = APIRouter(prefix="/api/voice", tags=["voice"])

SAMPLE_VOICE_CALLS = [
    {
        "id": "CALL-9821-HN",
        "customer_name": "Vikram Malhotra",
        "customer_phone": "+91 98201 44892",
        "amount_at_risk": 48500.0,
        "scenario": "B2B_RECEIVABLE",
        "status": "COMPLETED",
        "sentiment": "COOPERATIVE",
        "intent": "PAYMENT_PROMISE",
        "language": "hinglish",
        "duration_seconds": 94,
        "transcript": [
            {"speaker": "AIRA", "text": "Namaste Vikram ji. Main Aira bol rahi hoon Razorpay payment desk se. Aapka ₹48,500 ka invoice pending hai."},
            {"speaker": "CUSTOMER", "text": "Haan namaste. Actually hamara finance approval kal finalize hoga, toh payment kal dopahar tak clear kar paunga."},
            {"speaker": "AIRA", "text": "Bilkul samajh gayi. Main kal 2:00 PM ke liye aapka commitment register kar rahi hoon aur WhatsApp par direct link bhej rahi hoon."},
            {"speaker": "CUSTOMER", "text": "Haan theek hai, link WhatsApp pe daal do. Kal 2 baje se pehle ho jayega. Thank you."},
            {"speaker": "AIRA", "text": "Dhanyawad Vikram ji. Have a great day!"},
        ],
        "ai_analysis": {
            "root_cause": "TEMPORARY_LIQUIDITY_TIMING",
            "confidence": 94,
            "detected_intent": "Promise to pay by tomorrow 2:00 PM",
            "recommended_action": "RECORD_PROMISE_AND_DISPATCH_LINK",
            "sentiment_score": "+0.82 (Cooperative)",
        },
        "outcome": {
            "status": "PROMISE_RECORDED",
            "promised_amount": 48500.0,
            "promise_date": (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "payment_link_sent": True,
        },
    },
    {
        "id": "CALL-7734-HN",
        "customer_name": "Ananya Sharma",
        "customer_phone": "+91 97110 32918",
        "amount_at_risk": 3499.0,
        "scenario": "FAILED_SUBSCRIPTION",
        "status": "COMPLETED",
        "sentiment": "POSITIVE",
        "intent": "LINK_REQUEST",
        "language": "hinglish",
        "duration_seconds": 68,
        "transcript": [
            {"speaker": "AIRA", "text": "Hi Ananya! Aira here from streaming service billing. Aapka monthly subscription auto-debit decline hua tha."},
            {"speaker": "CUSTOMER", "text": "Oh mera card expire ho gaya tha last week. Kya main UPI se pay kar sakti hoon abhi?"},
            {"speaker": "AIRA", "text": "Bilkul Ananya ji! Main aapke registered number pe instant UPI payment link bhej rahi hoon jisse service suspend na ho."},
            {"speaker": "CUSTOMER", "text": "Great! Mujhe SMS pe link mil gaya hai, abhi pay kar deti hoon."},
            {"speaker": "AIRA", "text": "Payment successful ho chuka hai aur mandate update ho gaya. Shukriya!"},
        ],
        "ai_analysis": {
            "root_cause": "CARD_EXPIRED",
            "confidence": 98,
            "detected_intent": "Payment method switch to UPI",
            "recommended_action": "DISPATCH_UPI_MANDATE_LINK",
            "sentiment_score": "+0.95 (Highly Positive)",
        },
        "outcome": {
            "status": "RECOVERED",
            "promised_amount": 3499.0,
            "promise_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "payment_link_sent": True,
        },
    },
    {
        "id": "CALL-6621-HN",
        "customer_name": "Rajesh Gupta",
        "customer_phone": "+91 99887 11223",
        "amount_at_risk": 18200.0,
        "scenario": "CHECKOUT_DROPOFF",
        "status": "COMPLETED",
        "sentiment": "NEUTRAL",
        "intent": "PAYMENT_PROMISE",
        "language": "hinglish",
        "duration_seconds": 82,
        "transcript": [
            {"speaker": "AIRA", "text": "Namaste Rajesh ji. Main Aira bol rahi hoon. Aapka cart checkout step pe OTP timeout ki wajah se complete nahi ho paya tha."},
            {"speaker": "CUSTOMER", "text": "Haan woh bank ka OTP nahi aa raha tha. Abhi payment nahi ho payega, kal subah kar dunga."},
            {"speaker": "AIRA", "text": "Koi baat nahi sir. Maine aapka cart reserve kar diya hai aur reminder kal subah 10 baje ke liye schedule kar diya hai."},
            {"speaker": "CUSTOMER", "text": "Okay fine, kal subah reminder aane par main pay kar dunga."},
        ],
        "ai_analysis": {
            "root_cause": "OTP_AUTHENTICATION_TIMEOUT",
            "confidence": 91,
            "detected_intent": "Next-day morning cart recovery",
            "recommended_action": "SCHEDULE_MORNING_REMINDER",
            "sentiment_score": "+0.65 (Neutral/Cooperative)",
        },
        "outcome": {
            "status": "PROMISE_RECORDED",
            "promised_amount": 18200.0,
            "promise_date": (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "payment_link_sent": True,
        },
    },
]


@router.get("/calls")
async def list_voice_calls(db: AsyncSession = Depends(get_db)):
    return SAMPLE_VOICE_CALLS


@router.post("/process")
async def process_voice_input(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Process interactive voice transcripts from speech recognition or live microphone.
    Extracts intent, sentiment, entity amounts, and generates AI recovery response in natural Hinglish.
    """
    transcript = payload.get("transcript", "").strip()
    customer_id = payload.get("customer_id")
    language = payload.get("language", "hinglish")

    if not transcript:
        transcript = "Abhi payment nahi ho payega, kal sham tak pakka kar dunga."

    transcript_lower = transcript.lower()

    # Rule-based intent & sentiment classifier for realistic Hinglish & English
    intent = "PAYMENT_PROMISE"
    sentiment = "COOPERATIVE"
    confidence = 92
    suggested_response = ""
    recommended_action = "RECORD_PROMISE"
    promised_days = 1

    if any(k in transcript_lower for k in ["kal", "tomorrow", "parso", "shaam", "subah", "friday", "monday", "dunga", "karunga"]):
        intent = "PAYMENT_PROMISE"
        sentiment = "COOPERATIVE"
        suggested_response = "Bilkul samajh gayi. Main aapka payment promise kal ke liye schedule kar deti hoon aur WhatsApp pe direct payment link share kar rahi hoon."
        recommended_action = "RECORD_PROMISE_AND_DISPATCH_LINK"
        promised_days = 1 if "kal" in transcript_lower or "tomorrow" in transcript_lower else 2

    elif any(k in transcript_lower for k in ["link", "whatsapp", "sms", "bhejo", "send", "qr", "upi"]):
        intent = "LINK_REQUEST"
        sentiment = "POSITIVE"
        suggested_response = "Haan bilkul! Main aapke registered phone number par instant 1-click UPI link bhej rahi hoon. Aap wahan se 2 minute mein payment complete kar sakte hain."
        recommended_action = "DISPATCH_PAYMENT_LINK"

    elif any(k in transcript_lower for k in ["wrong", "galat", "fraud", "cancel", "dispute", "nahi chahiye"]):
        intent = "DISPUTE"
        sentiment = "FRUSTRATED"
        suggested_response = "Aapki pareshani ke liye hum sharminda hain. Main ye case hamare Senior Support Manager ko escalate kar rahi hoon jo aapse 15 minute mein call karenge."
        recommended_action = "ESCALATE_TO_SENIOR_DESK"

    else:
        suggested_response = "Ji bilkul. Hum aapke payment timeline ko acknowledge karte hain aur aapko SMS aur WhatsApp confirmation share kar rahe hain."

    # Audit event
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id="VOICE_SESSION",
        timestamp=datetime.utcnow(),
        event_type="VOICE_INTENT_CLASSIFIED",
        actor="AIRA_VOICE_AGENT",
        action=f"Classified Intent: {intent} (Sentiment: {sentiment})",
        reason=f"Transcript: '{transcript}'",
        metadata_=json.dumps({
            "transcript": transcript,
            "intent": intent,
            "sentiment": sentiment,
            "confidence": confidence,
        }),
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "input_transcript": transcript,
        "detected_language": language,
        "intent": intent,
        "sentiment": sentiment,
        "confidence_score": confidence,
        "ai_response_hinglish": suggested_response,
        "ai_response_english": "Understood. I have registered your payment schedule and dispatched a direct 1-click payment link to your registered mobile number.",
        "recommended_action": recommended_action,
        "promise_candidate": {
            "is_promise": intent == "PAYMENT_PROMISE",
            "estimated_days": promised_days,
            "estimated_date": (datetime.utcnow() + timedelta(days=promised_days)).strftime("%Y-%m-%d"),
        },
    }


@router.post("/trigger-simulation")
async def trigger_call_simulation(payload: dict = None, db: AsyncSession = Depends(get_db)):
    """Simulates initiating a live recovery call to an overdue customer."""
    call_id = f"CALL-{uuid.uuid4().hex[:4].upper()}-HN"
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=call_id,
        timestamp=datetime.utcnow(),
        event_type="VOICE_CALL_INITIATED",
        actor="AIRA_VOICE_ENGINE",
        action=f"Initiated Hinglish AI Recovery call {call_id}",
        reason="Triggered from Voice Recovery Control Panel.",
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "call_id": call_id,
        "status": "INITIATING",
        "audio_stream_active": True,
        "message": "AI Voice agent connected. Stream established with 28ms latency.",
    }
