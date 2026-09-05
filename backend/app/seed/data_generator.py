"""
Synthetic Data Generator
Generates 120+ realistic recovery cases across all 7 scenarios.
All records tagged data_source=SYNTHETIC.
NEVER represents synthetic recovery as real Razorpay recovery.
"""
import uuid
import random
import json
from datetime import datetime, timedelta
from faker import Faker

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.recovery_case import RecoveryCase
from app.models.audit_event import AuditEvent
from app.models.checkout_session import CheckoutSession
from app.models.promise_to_pay import PromiseToPay
from app.models.intervention import Intervention


fake = Faker("en_IN")

SCENARIOS = [
    "FAILED_SUBSCRIPTION",
    "CHECKOUT_DROPOFF",
    "B2B_RECEIVABLE",
    "MANDATE_RETRY",
    "PAYMENT_DEGRADATION",
    "VOICE_RECOVERY",
    "PROMISE_TRACKER",
]

PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet", "emi"]

FAILURE_CODES = [
    "BAD_REQUEST_ERROR",
    "CARD_EXPIRED",
    "CARD_DECLINED",
    "GATEWAY_ERROR",
    "NETWORK_ERROR",
    "INVALID_MANDATE",
    "PAYMENT_CANCELLED",
    "AUTHENTICATION_FAILED",
    "INSUFFICIENT_FUNDS",
    "PAYMENT_TIMEOUT",
]

FAILURE_REASONS = {
    "BAD_REQUEST_ERROR": "Insufficient funds in account",
    "CARD_EXPIRED": "Card has expired",
    "CARD_DECLINED": "Card declined by issuing bank",
    "GATEWAY_ERROR": "Payment gateway error",
    "NETWORK_ERROR": "Network timeout during processing",
    "INVALID_MANDATE": "Mandate is not valid or has been cancelled",
    "PAYMENT_CANCELLED": "Customer cancelled the payment",
    "AUTHENTICATION_FAILED": "Authentication failed — OTP not verified",
    "INSUFFICIENT_FUNDS": "Account balance insufficient",
    "PAYMENT_TIMEOUT": "Payment timed out",
}

ROOT_CAUSES = [
    "INSUFFICIENT_FUNDS", "CARD_EXPIRED", "CARD_DECLINED",
    "TECHNICAL_ERROR", "BANK_DEGRADATION", "MANDATE_INVALID",
    "CUSTOMER_ABANDONED", "PROMISE_BROKEN", "AUTHENTICATION_FAILED",
    "NETWORK_TIMEOUT", "UNKNOWN",
]

RISK_SEGMENTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
MANDATE_TYPES = ["e_mandate", "upi_autopay"]
MANDATE_STATUSES = ["active", "paused", "pending", "revoked"]
SUBSCRIPTION_STATUSES = ["halted", "active", "paused"]

LANGUAGES = ["en", "hi", "hinglish"]

COMPANY_NAMES = [
    "Infosys BPM Global", "Zomato Logistics Ltd", "Swiggy Cloud Solutions",
    "Tata Consultancy Services", "Reliance Retail B2B", "Flipkart Commerce Hub",
    "Delhivery Freight Ops", "Razorpay Tech Partners", "Urban Company Pro",
    "Freshworks SaaS India", "Lenskart Optical Works", "Groww Fintech Tech",
    "Zepto Instant Commerce", "Paytm Merchant Services", "Nykaa Brands Private Ltd",
]


def _rand_amount(rng: random.Random) -> float:
    """Generate realistic Indian payment amounts."""
    tiers = [
        (499, 4999, 0.3),
        (5000, 49999, 0.4),
        (50000, 499999, 0.2),
        (500000, 2000000, 0.1),
    ]
    chosen = rng.choices(range(4), weights=[t[2] for t in tiers], k=1)[0]
    lo, hi, _ = tiers[chosen]
    amount = rng.randint(lo, hi)
    return float(round(amount / 100) * 100)


async def generate_synthetic_data(count: int, db: AsyncSession) -> dict:
    """
    Generate `count` synthetic recovery cases with associated data.
    Returns a summary of what was created.
    """
    rng = random.Random(42)  # Always start from same seed for reproducibility

    created_customers = 0
    created_cases = 0
    created_payments = 0
    created_subscriptions = 0
    created_invoices = 0
    created_promises = 0

    # Create a pool of customers
    num_customers = max(25, count // 4)
    customers = []
    for idx in range(num_customers):
        name = COMPANY_NAMES[idx % len(COMPANY_NAMES)] if idx % 3 == 0 else fake.name()
        email = f"contact@{name.lower().replace(' ', '')[:12]}.com" if idx % 3 == 0 else fake.email()
        cust = Customer(
            id=str(uuid.uuid4()),
            name=name,
            email=email,
            phone=f"+91{rng.randint(7000000000, 9999999999)}",
            language_preference=rng.choice(LANGUAGES),
            risk_segment=rng.choices(RISK_SEGMENTS, weights=[0.3, 0.4, 0.2, 0.1], k=1)[0],
            data_source="SYNTHETIC",
            created_at=datetime.utcnow() - timedelta(days=rng.randint(30, 365)),
        )
        db.add(cust)
        customers.append(cust)
        created_customers += 1

    await db.flush()

    # Distribute cases across scenarios
    scenario_weights = [0.20, 0.15, 0.20, 0.15, 0.10, 0.10, 0.10]
    scenario_counts = {s: 0 for s in SCENARIOS}

    for i in range(count):
        scenario = rng.choices(SCENARIOS, weights=scenario_weights, k=1)[0]
        scenario_counts[scenario] += 1
        customer = rng.choice(customers)
        amount = _rand_amount(rng)
        priority = rng.choices(PRIORITIES, weights=[0.15, 0.40, 0.30, 0.15], k=1)[0]
        root_cause = rng.choice(ROOT_CAUSES)
        method = rng.choice(PAYMENT_METHODS)

        source_id = str(uuid.uuid4())
        source_type = "payment"

        failure_code = rng.choice(FAILURE_CODES)
        failure_reason = FAILURE_REASONS.get(failure_code, "Unknown failure")

        if scenario == "FAILED_SUBSCRIPTION":
            mandate_type = rng.choice(MANDATE_TYPES)
            sub = Subscription(
                id=source_id,
                customer_id=customer.id,
                plan=rng.choice(["Enterprise Cloud", "Growth Suite", "Starter Tier", "Scale Pro"]),
                amount=amount,
                frequency=rng.choice(["monthly", "quarterly", "yearly"]),
                status=rng.choices(SUBSCRIPTION_STATUSES, weights=[0.6, 0.2, 0.2], k=1)[0],
                mandate_id=str(uuid.uuid4()),
                mandate_status=rng.choices(MANDATE_STATUSES, weights=[0.5, 0.2, 0.2, 0.1], k=1)[0],
                mandate_type=mandate_type,
                retry_count=str(rng.randint(0, 3)),
                last_charge_at=datetime.utcnow() - timedelta(hours=rng.randint(1, 72)),
                next_charge_at=datetime.utcnow() + timedelta(days=rng.randint(1, 30)),
                data_source="SYNTHETIC",
            )
            db.add(sub)
            source_type = "subscription"
            created_subscriptions += 1

        elif scenario == "CHECKOUT_DROPOFF":
            items_list = [
                "Apple iPhone 16 Pro Max 256GB Desert Titanium",
                "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
                "MacBook Air 13 M3 16GB RAM 512GB SSD",
                "Samsung Galaxy S25 Ultra 5G Titanium Gray",
                "Dyson V12 Detect Slim Total Clean Vacuum",
                "Tanishq 22K Gold Diamond Studded Pendant",
                "BoAt Airdopes 141 ANC + Wave Smartwatch Combo",
                "Titan Edge Ceramic Slim Monochrome Watch",
                "Nike Air Jordan 1 Retro High OG Chicago",
                "Marshall Stanmore III Bluetooth Home Speaker",
            ]
            dropoff_step = rng.choice(["cart", "details", "payment_method", "otp_auth", "bank_redirect"])
            dropoff_reason = failure_code if failure_code in ["OTP_NOT_ENTERED", "3DS_TIMEOUT"] else rng.choice(["OTP_NOT_ENTERED", "3DS_TIMEOUT", "UPI_APP_SWITCH_FAILED", "CART_ABANDONED", "PAYMENT_REJECTED"])
            
            chk = CheckoutSession(
                id=source_id,
                customer_id=customer.id,
                cart_value=amount,
                currency="INR",
                items_summary=rng.choice(items_list),
                dropoff_step=dropoff_step,
                payment_method=method,
                dropoff_reason=dropoff_reason,
                status=rng.choices(["abandoned", "link_sent", "recovered"], weights=[0.6, 0.25, 0.15])[0],
                payment_link_url=f"https://rzp.io/l/aira_{source_id[:8]}",
                reminder_count=rng.randint(0, 2),
                retry_count=0,
                recovered_amount=amount if rng.random() < 0.15 else 0.0,
                recovery_duration_minutes=rng.randint(8, 35) if rng.random() < 0.15 else 0,
                created_at=datetime.utcnow() - timedelta(hours=rng.randint(1, 48)),
            )
            db.add(chk)
            source_type = "checkout"

        elif scenario == "B2B_RECEIVABLE":
            days_back = rng.randint(5, 95)
            due_date = datetime.utcnow() - timedelta(days=days_back)
            inv = Invoice(
                id=source_id,
                customer_id=customer.id,
                invoice_number=f"INV-2026-{rng.randint(1000, 9999)}",
                amount=amount,
                due_date=due_date,
                status="overdue",
                days_overdue=days_back,
                description=f"Q{rng.randint(1,4)} Platform Infrastructure & Enterprise SLA Maintenance",
                reminder_count=rng.randint(1, 4),
                last_reminder_at=datetime.utcnow() - timedelta(days=rng.randint(1, 6)),
                data_source="SYNTHETIC",
            )
            db.add(inv)
            source_type = "invoice"
            created_invoices += 1

            # Also create associated promise for some B2B cases
            if rng.random() < 0.45:
                p_date = datetime.utcnow() + timedelta(days=rng.randint(-2, 5))
                p = PromiseToPay(
                    id=str(uuid.uuid4()),
                    customer_id=customer.id,
                    invoice_id=inv.id,
                    amount=amount,
                    currency="INR",
                    promise_date=p_date,
                    status="PROMISED" if p_date > datetime.utcnow() else "DUE_TODAY",
                    promise_source=rng.choice(["voice", "whatsapp", "email", "manual"]),
                    notes="Client CFO committed to payment release on scheduled date.",
                )
                db.add(p)
                created_promises += 1

        elif scenario == "MANDATE_RETRY":
            sub = Subscription(
                id=source_id,
                customer_id=customer.id,
                plan="Recurring SaaS Mandate",
                amount=amount,
                frequency="monthly",
                status="halted",
                mandate_id=f"UMRN-{rng.randint(100000, 999999)}",
                mandate_status="pending",
                mandate_type=rng.choice(MANDATE_TYPES),
                retry_count=str(rng.randint(1, 3)),
                last_charge_at=datetime.utcnow() - timedelta(hours=rng.randint(2, 96)),
                data_source="SYNTHETIC",
            )
            db.add(sub)
            source_type = "subscription"
            created_subscriptions += 1

        elif scenario == "PAYMENT_DEGRADATION":
            method = "upi"
            failure_code = rng.choice(["GATEWAY_TIMEOUT", "PSP_DEGRADATION", "NPCI_SWITCH_ERROR"])
            failure_reason = "UPI switch latency > 8500ms / 504 Gateway Timeout on HDFC/ICICI handle"
            root_cause = "PSP_DOWNTIME"
            pay = Payment(
                id=source_id,
                customer_id=customer.id,
                amount=amount,
                method=method,
                status="failed",
                failure_code=failure_code,
                failure_reason=failure_reason,
                data_source="SYNTHETIC",
                created_at=datetime.utcnow() - timedelta(hours=rng.randint(1, 12)),
            )
            db.add(pay)
            source_type = "payment"
            created_payments += 1

        elif scenario == "PROMISE_TRACKER":
            pay = Payment(
                id=source_id,
                customer_id=customer.id,
                amount=amount,
                method=method,
                status="failed",
                failure_code="INSUFFICIENT_FUNDS",
                failure_reason="Customer requested delayed settlement window",
                data_source="SYNTHETIC",
                created_at=datetime.utcnow() - timedelta(days=rng.randint(1, 10)),
            )
            db.add(pay)
            source_type = "payment"
            created_payments += 1

            p_date = datetime.utcnow() + timedelta(days=rng.randint(-3, 4))
            p_status = "PAID" if rng.random() < 0.3 else ("OVERDUE" if p_date < datetime.utcnow() else "PROMISED")
            p = PromiseToPay(
                id=str(uuid.uuid4()),
                customer_id=customer.id,
                amount=amount,
                currency="INR",
                promise_date=p_date,
                status=p_status,
                promise_source=rng.choice(["voice", "whatsapp", "manual"]),
                notes="Customer confirmed settlement date via conversational outreach.",
            )
            db.add(p)
            created_promises += 1

        else:
            # VOICE_RECOVERY
            pay = Payment(
                id=source_id,
                customer_id=customer.id,
                amount=amount,
                method=method,
                status="failed",
                failure_code="CARD_EXPIRED",
                failure_reason="Card expired. Voice outreach scheduled.",
                data_source="SYNTHETIC",
                created_at=datetime.utcnow() - timedelta(hours=rng.randint(1, 48)),
            )
            db.add(pay)
            source_type = "payment"
            created_payments += 1

        await db.flush()

        # Assign realistic status distribution across cases
        status_choice = rng.choices(
            ["OPEN", "IN_PROGRESS", "ESCALATED", "RECOVERED"],
            weights=[0.35, 0.20, 0.25, 0.20]
        )[0]
        amount_rec = amount if status_choice == "RECOVERED" else 0.0

        if status_choice == "RECOVERED":
            if scenario == "B2B_RECEIVABLE":
                inv.status = "paid"
                inv.paid_at = datetime.utcnow()
            elif scenario == "FAILED_SUBSCRIPTION":
                sub.status = "active"
                sub.last_charge_at = datetime.utcnow()

        # Create recovery case
        notes = "UPI route degradation detected across HDFC/ICICI PSP handle. Response latency >8500ms." if scenario == "PAYMENT_DEGRADATION" else None
        case = RecoveryCase(
            id=str(uuid.uuid4()),
            customer_id=customer.id,
            source_type=source_type,
            source_id=source_id,
            scenario_type=scenario,
            amount_at_risk=amount,
            amount_recovered=amount_rec,
            root_cause=root_cause,
            status=status_choice,
            priority="HIGH" if scenario == "PAYMENT_DEGRADATION" else priority,
            data_source="SYNTHETIC",
            notes=notes,
            created_at=datetime.utcnow() - timedelta(hours=rng.randint(0, 12 if scenario == "PAYMENT_DEGRADATION" else 168)),
            updated_at=datetime.utcnow(),
        )
        db.add(case)
        if scenario == "CHECKOUT_DROPOFF":
            chk.case_id = case.id
        await db.flush()

        if status_choice == "RECOVERED":
            intervention = Intervention(
                id=str(uuid.uuid4()),
                case_id=case.id,
                action="AUTONOMOUS_RECOVERY_SUCCESS",
                channel="system",
                requested_at=case.created_at,
                executed_at=case.created_at,
                result="SUCCESS",
                amount_recovered=amount,
                notes=f"Autonomous recovery completed for {scenario}",
            )
            db.add(intervention)

        # Create initial audit event
        audit = AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            timestamp=case.created_at,
            event_type="CASE_CREATED",
            actor="SYSTEM",
            action=f"Recovery case created for {scenario.replace('_',' ')}",
            reason=f"Source: {source_type} {source_id[:8]}... | Amount at risk: INR {amount:,.0f}",
            metadata_=json.dumps({
                "scenario": scenario,
                "root_cause": root_cause,
                "data_source": "SYNTHETIC",
            }),
        )
        db.add(audit)
        created_cases += 1

    await db.commit()

    return {
        "message": f"Generated {created_cases} synthetic recovery cases",
        "data_source": "SYNTHETIC",
        "created": {
            "customers": created_customers,
            "cases": created_cases,
            "payments": created_payments,
            "subscriptions": created_subscriptions,
            "invoices": created_invoices,
            "promises": created_promises,
        },
        "by_scenario": scenario_counts,
    }
