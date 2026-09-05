import asyncio
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.recovery_case import RecoveryCase
from app.models.invoice import Invoice
from app.models.subscription import Subscription
from app.models.intervention import Intervention

async def enrich():
    async with AsyncSessionLocal() as session:
        # 1. B2B_RECEIVABLE
        res = await session.execute(
            select(RecoveryCase).where(RecoveryCase.scenario_type == "B2B_RECEIVABLE").order_by(RecoveryCase.created_at)
        )
        b2b_cases = res.scalars().all()
        print(f"Enriching {len(b2b_cases)} B2B Receivable cases...")
        
        for i, case in enumerate(b2b_cases):
            if i < 18:
                # RECOVERED
                case.status = "RECOVERED"
                case.amount_recovered = case.amount_at_risk
                case.notes = "Client CFO cleared overdue invoice via 1-click Razorpay link after WhatsApp reminder."
                inv = await session.get(Invoice, case.source_id)
                if inv:
                    inv.status = "paid"
                    inv.paid_at = datetime.utcnow()
                intervention = Intervention(
                    id=str(uuid.uuid4()),
                    case_id=case.id,
                    action="SEND_PAYMENT_LINK",
                    channel="whatsapp",
                    requested_at=datetime.utcnow() - timedelta(days=2),
                    executed_at=datetime.utcnow() - timedelta(days=2),
                    result="SUCCESS",
                    amount_recovered=case.amount_at_risk,
                    notes="Automated dunning with 1-click payment link settled by customer.",
                )
                session.add(intervention)
            elif i < 33:
                # OPEN
                case.status = "OPEN"
                case.amount_recovered = 0.0
                case.notes = "Autonomous dunning active. 2nd reminder scheduled via WhatsApp."
            elif i < 43:
                # IN_PROGRESS
                case.status = "IN_PROGRESS"
                case.amount_recovered = 0.0
                case.notes = "Customer promised payment by end of week. Tracking inward settlement."
            elif i < 61:
                # ESCALATED
                case.status = "ESCALATED"
                case.amount_recovered = 0.0

        # 2. FAILED_SUBSCRIPTION
        res = await session.execute(
            select(RecoveryCase).where(RecoveryCase.scenario_type == "FAILED_SUBSCRIPTION").order_by(RecoveryCase.created_at)
        )
        sub_cases = res.scalars().all()
        print(f"Enriching {len(sub_cases)} Failed Subscription cases...")
        for i, case in enumerate(sub_cases):
            if i < 15:
                # RECOVERED
                case.status = "RECOVERED"
                case.amount_recovered = case.amount_at_risk
                case.notes = "Smart retry succeeded during optimal salary balance window."
                sub = await session.get(Subscription, case.source_id)
                if sub:
                    sub.status = "active"
                    sub.last_charge_at = datetime.utcnow()
                intervention = Intervention(
                    id=str(uuid.uuid4()),
                    case_id=case.id,
                    action="SMART_RETRY_ALTERNATE_ROUTE",
                    channel="system",
                    requested_at=datetime.utcnow() - timedelta(days=1),
                    executed_at=datetime.utcnow() - timedelta(days=1),
                    result="SUCCESS",
                    amount_recovered=case.amount_at_risk,
                    notes="Autopay retry charged successfully via secondary bank rail.",
                )
                session.add(intervention)
            elif i < 30:
                # OPEN
                case.status = "OPEN"
                case.amount_recovered = 0.0
                case.notes = "Initial debit failed (insufficient balance). Smart retry scheduled."
            elif i < 40:
                # IN_PROGRESS
                case.status = "IN_PROGRESS"
                case.amount_recovered = 0.0
                case.notes = "Aira analyzing customer transaction history for next optimal charge window."
            elif i < 46:
                # ESCALATED
                case.status = "ESCALATED"
                case.amount_recovered = 0.0

        # 3. MANDATE_RETRY
        res = await session.execute(
            select(RecoveryCase).where(RecoveryCase.scenario_type == "MANDATE_RETRY").order_by(RecoveryCase.created_at)
        )
        mandate_cases = res.scalars().all()
        print(f"Enriching {len(mandate_cases)} Mandate Retry cases...")
        for i, case in enumerate(mandate_cases):
            if i < 16:
                case.status = "RECOVERED"
                case.amount_recovered = case.amount_at_risk
                case.notes = "e-NACH mandate representment executed successfully via secondary rail."
                intervention = Intervention(
                    id=str(uuid.uuid4()),
                    case_id=case.id,
                    action="SMART_MANDATE_REPRESENTMENT",
                    channel="system",
                    requested_at=datetime.utcnow() - timedelta(hours=18),
                    executed_at=datetime.utcnow() - timedelta(hours=18),
                    result="SUCCESS",
                    amount_recovered=case.amount_at_risk,
                    notes="NACH representment cleared with destination bank.",
                )
                session.add(intervention)
            elif i < 31:
                case.status = "OPEN"
                case.amount_recovered = 0.0
                case.notes = "Mandate retry queued for Step 2: Optimal timing window."
            elif i < 41:
                case.status = "IN_PROGRESS"
                case.amount_recovered = 0.0
                case.notes = "Representment in transit via NPCI clearing house."
            elif i < 54:
                case.status = "ESCALATED"
                case.amount_recovered = 0.0

        # 4. CHECKOUT_DROPOFF
        res = await session.execute(
            select(RecoveryCase).where(RecoveryCase.scenario_type == "CHECKOUT_DROPOFF", RecoveryCase.status == "ESCALATED")
        )
        chk_cases = res.scalars().all()
        print(f"Rebalancing {len(chk_cases)} Checkout Dropoff escalated cases...")
        for i, case in enumerate(chk_cases):
            if i < 20:
                case.status = "OPEN"
                case.notes = "Abandoned checkout session detected. 1-click cart recovery link dispatched."
            elif i < 32:
                case.status = "IN_PROGRESS"
                case.notes = "Customer opened recovery link on WhatsApp. Awaiting payment authorization."

        # 5. VOICE_RECOVERY
        res = await session.execute(
            select(RecoveryCase).where(RecoveryCase.scenario_type == "VOICE_RECOVERY", RecoveryCase.status == "ESCALATED")
        )
        voice_cases = res.scalars().all()
        print(f"Rebalancing {len(voice_cases)} Voice Recovery escalated cases...")
        for i, case in enumerate(voice_cases):
            if i < 15:
                case.status = "OPEN"
                case.notes = "High-touch voice recovery call queued for Hinglish AI conversational agent."
            elif i < 25:
                case.status = "IN_PROGRESS"
                case.notes = "Voice call completed. Customer confirmed intent to pay via UPI."

        await session.commit()
        print("Database enrichment complete!")

if __name__ == "__main__":
    asyncio.run(enrich())
