"""
Aira Payment Health & Autonomous Recovery API Routes
────────────────────────────────────────────────────
Core autonomous recovery loop:
DETECT → DIAGNOSE → DECIDE → ACT → RECOVER → ESCALATE
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.recovery_case import RecoveryCase
from app.models.payment import Payment
from app.models.audit_event import AuditEvent
from app.models.intervention import Intervention
from app.models.customer import Customer

router = APIRouter(prefix="/api/payments", tags=["payments"])

# In-memory incident state to track dynamic recovery execution across requests
_INCIDENT_STATE = {
    "status": "ACTIVE",  # ACTIVE | RECOVERED
    "recovered_at": None,
    "recovery_timeline": [
        {"time": "19:42", "event": "DETECT", "title": "Payment degradation detected", "detail": "UPI success rate dropped 14.1% below 95% SLA baseline", "status": "completed"},
        {"time": "19:42", "event": "DIAGNOSE", "title": "Aira analyzed payment signals", "detail": "Isolated failure spike to HDFC/ICICI UPI switch (504 Gateway Timeouts)", "status": "completed"},
        {"time": "19:42", "event": "DIAGNOSE", "title": "Root cause identified", "detail": "Bank/PSP degradation (91% confidence). Cards and Netbanking stable.", "status": "completed"},
        {"time": "19:43", "event": "DECIDE", "title": "Policy evaluated", "detail": "Aira Policy Check: APPROVED (Retry within quota 1/3, contact allowed)", "status": "completed"},
        {"time": "19:43", "event": "DECIDE", "title": "Recovery strategy selected", "detail": "Intelligent route failover & scheduled secondary gateway retry", "status": "completed"},
        {"time": "—", "event": "ACT", "title": "Recovery action pending", "detail": "Waiting for operator or autonomous trigger", "status": "pending"},
        {"time": "—", "event": "RECOVER", "title": "Revenue recovery pending", "detail": "Projected ₹4.2L recoverable across 3,842 transactions", "status": "pending"},
    ]
}


@router.get("/health")
async def get_payment_health(
    window: str = Query(default="24h"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns full payment health metrics, method breakdowns, time series data,
    active anomaly detection, Aira diagnosis evidence chain, and recovery recommendation.
    """
    # Fetch existing PAYMENT_DEGRADATION cases from DB to tie real cases to the incident
    result = await db.execute(
        select(RecoveryCase).where(RecoveryCase.scenario_type == "PAYMENT_DEGRADATION")
    )
    cases = result.scalars().all()
    case_ids = [c.id for c in cases]
    total_degradation_risk = sum(c.amount_at_risk for c in cases) or 1240000.0
    total_degradation_recovered = sum(c.amount_recovered for c in cases)

    is_recovered = _INCIDENT_STATE["status"] == "RECOVERED"

    # Adjust metrics based on whether recovery has been executed
    current_upi_success = 94.2 if is_recovered else 84.1
    current_overall_success = 95.8 if is_recovered else 89.4
    revenue_recovered = 420000.0 if is_recovered else float(total_degradation_recovered)
    revenue_at_risk = float(total_degradation_risk)
    active_incidents_count = 0 if is_recovered else 1

    # Hourly 24h time-series chart data points
    now = datetime.utcnow()
    timeseries = []
    for h in range(23, -1, -1):
        dt = now - timedelta(hours=h)
        time_label = dt.strftime("%H:00")

        # Simulate historical baseline drop starting 6 hours ago
        if h > 6:
            overall = round(97.2 + (h % 3) * 0.3 - 0.2, 1)
            upi = round(98.1 + (h % 2) * 0.2 - 0.1, 1)
            cards = round(96.2 + (h % 2) * 0.2, 1)
            nb = round(97.0 + (h % 3) * 0.1, 1)
        elif h > 1:
            # Degraded period
            drop_factor = (6 - h) / 5.0
            upi = round(98.1 - 14.0 * drop_factor + (h % 2) * 0.2, 1)
            overall = round(97.2 - 7.8 * drop_factor + (h % 2) * 0.1, 1)
            cards = round(95.8 + (h % 2) * 0.1, 1)
            nb = round(96.9 + (h % 2) * 0.1, 1)
        else:
            # Latest hour (either recovered or remains degraded)
            if is_recovered:
                upi = 94.2
                overall = 95.8
            else:
                upi = 84.1
                overall = 89.4
            cards = 95.8
            nb = 96.9

        timeseries.append({
            "timestamp": time_label,
            "overall": overall,
            "upi": upi,
            "cards": cards,
            "netbanking": nb,
            "sla_threshold": 95.0,
        })

    # Method Breakdown
    methods = [
        {
            "method": "UPI",
            "name": "Unified Payments Interface (UPI)",
            "current_rate": current_upi_success,
            "previous_rate": 98.2,
            "drop": round(98.2 - current_upi_success, 1),
            "status": "RECOVERED" if is_recovered else "DEGRADED",
            "volume_processed": 24500,
            "volume_failed": 980 if is_recovered else 3842,
            "revenue_at_risk": revenue_at_risk,
            "revenue_recovered": revenue_recovered,
            "primary_degraded": not is_recovered,
            "failure_rate": round(100.0 - current_upi_success, 1),
            "badge": "NORMAL" if is_recovered else "CRITICAL DROP",
        },
        {
            "method": "Cards",
            "name": "Debit & Credit Cards",
            "current_rate": 95.8,
            "previous_rate": 96.4,
            "drop": 0.6,
            "status": "HEALTHY",
            "volume_processed": 11200,
            "volume_failed": 420,
            "revenue_at_risk": 210000.0,
            "revenue_recovered": 35000.0,
            "primary_degraded": False,
            "failure_rate": 4.2,
            "badge": "STABLE",
        },
        {
            "method": "Netbanking",
            "name": "Internet Banking (Direct Debit)",
            "current_rate": 96.9,
            "previous_rate": 97.1,
            "drop": 0.2,
            "status": "HEALTHY",
            "volume_processed": 7150,
            "volume_failed": 280,
            "revenue_at_risk": 150000.0,
            "revenue_recovered": 28000.0,
            "primary_degraded": False,
            "failure_rate": 3.1,
            "badge": "STABLE",
        },
    ]

    # Active Anomaly Details
    anomaly = {
        "id": "inc_upi_route_01",
        "title": "UPI Bank/PSP Route Degradation",
        "payment_method": "UPI",
        "affected_volume": 3842,
        "success_rate_current": current_upi_success,
        "success_rate_previous": 98.2,
        "success_rate_drop": round(98.2 - current_upi_success, 1),
        "timestamp": "2026-09-04T19:42:00Z",
        "severity": "LOW" if is_recovered else "HIGH",
        "revenue_at_risk": revenue_at_risk,
        "revenue_recovered": revenue_recovered,
        "corridor": "HDFC UPI Autopay / Retail Switch",
        "failover_corridor": "ICICI Instant UPI Rail",
        "reason": "UPI switch latency > 8500ms (504 Gateway Timeout on HDFC/ICICI handle)",
        "error_rate": round(100.0 - current_upi_success, 1),
        "threshold": 8.0,
        "started_at": "2026-09-04T19:42:00Z",
        "detected_at": "2026-09-04T19:42:00Z",
        "suspected_cause": "Bank/PSP degradation (intermittent NPCI switch latency)",
        "confidence_score": 0.91,
        "status": "RECOVERED" if is_recovered else "ACTIVE",
        "affected_cases_count": len(cases),
        "affected_case_ids": case_ids,
        "evidence_chain": [
            {
                "step": "Signal",
                "finding": "UPI success rate decreased sharply (-14.1% from 98.2% baseline)",
                "detail": "Sudden failure spike observed across UPI gateway endpoints starting at 14:00 UTC",
                "severity": "CRITICAL",
            },
            {
                "step": "Pattern",
                "finding": "Failures concentrated around primary banking switches (HDFC & ICICI handles)",
                "detail": "82% of errors returning HTTP 504 Gateway Timeout or NPCI latency exceeding 8,500ms",
                "severity": "HIGH",
            },
            {
                "step": "Comparison",
                "finding": "Cards (95.8%) and Netbanking (96.9%) remain stable",
                "detail": "Non-UPI payment corridors continue operating within normal SLA thresholds, ruling out application-level bugs",
                "severity": "NORMAL",
            },
            {
                "step": "Inference",
                "finding": "Likely external UPI/PSP degradation at bank route switch level",
                "detail": "Aira isolates root cause to external banking infrastructure rather than merchant checkout failure",
                "severity": "DIAGNOSED",
            },
            {
                "step": "Confidence",
                "finding": "91% Confidence Score",
                "detail": "Cross-referenced against multi-PSP telemetry, error codes (U30, 504), and historical switch patterns",
                "severity": "HIGH_CONFIDENCE",
            },
        ],
        "impact": {
            "transactions_affected": 3842,
            "customers_affected": 3120,
            "revenue_at_risk": revenue_at_risk,
            "estimated_recoverable": 420000.0,
            "affected_cases_count": len(cases),
            "affected_case_ids": case_ids,
        },
        "recommendation": {
            "root_cause": "UPI route degradation",
            "strategy_name": "Intelligent UPI Route Failover & Scheduled Window Retry",
            "steps": [
                "Avoid immediate repeated retry during switch degradation spike",
                "Wait for recovery window (intermittent NPCI switch stabilization ~15-20m)",
                "Offer alternate payment method (Cards / Netbanking) where customer is reachable",
                "Retry eligible transactions via secondary PSP gateway route",
                "Escalate high-value unresolved transactions to VIP merchant desk",
            ],
            "expected_recovery_amount": 420000.0,
            "expected_recovery_rate": 34.0,
            "policy_status": "ALLOWED",
            "confidence": 89.0,
        },
        "policy_check": {
            "retry_allowed": True,
            "retry_attempts_used": "1/3",
            "customer_contact_allowed": True,
            "alternate_payment_allowed": True,
            "escalation_required": False,
            "result": "APPROVED",
            "rules": [
                {"name": "Max Auto Retries (UPI)", "passed": True, "detail": "Attempt count within policy cap of 3 per transaction"},
                {"name": "PSP Cooldown Interval", "passed": True, "detail": "20m backoff hold satisfied since initial switch spike"},
                {"name": "Customer Contact Cooldown", "passed": True, "detail": "No duplicate WhatsApp/SMS sent in past 4h"},
                {"name": "Stopping Rules", "passed": True, "detail": "Cases eligible and not in UNRECOVERABLE status"},
            ],
        },
        "recovery_timeline": _INCIDENT_STATE["recovery_timeline"],
    }

    corridors = [
        {
            "id": "corr-upi-hdfc",
            "name": "UPI - HDFC Bank Switch",
            "provider": "Razorpay / NPCI",
            "method": "UPI",
            "status": "HEALTHY" if is_recovered else "DEGRADED",
            "success_rate": 98.4 if is_recovered else current_upi_success,
            "sla_baseline": 98.5,
            "latency_p95": 420 if is_recovered else 8920,
            "volume_24h": 18450000,
            "recommendation": "Operating within nominal SLA" if is_recovered else "Smart Failover Diverted to ICICI Switch",
        },
        {
            "id": "corr-upi-icici",
            "name": "UPI - ICICI Bank Switch",
            "provider": "Razorpay / NPCI",
            "method": "UPI",
            "status": "HEALTHY",
            "success_rate": 98.6,
            "sla_baseline": 98.5,
            "latency_p95": 380,
            "volume_24h": 14200000,
            "recommendation": "Absorbing redirected UPI traffic with 0 drop",
        },
        {
            "id": "corr-upi-axis",
            "name": "UPI - Axis Bank Switch",
            "provider": "Razorpay / NPCI",
            "method": "UPI",
            "status": "HEALTHY",
            "success_rate": 97.9,
            "sla_baseline": 98.0,
            "latency_p95": 440,
            "volume_24h": 9800000,
            "recommendation": "Standby secondary failover corridor",
        },
        {
            "id": "corr-cards-visa",
            "name": "Cards - Visa Direct Engine",
            "provider": "Razorpay / Visa",
            "method": "CARD",
            "status": "HEALTHY",
            "success_rate": 96.4,
            "sla_baseline": 96.0,
            "latency_p95": 1240,
            "volume_24h": 12500000,
            "recommendation": "Nominal throughput",
        },
        {
            "id": "corr-cards-mastercard",
            "name": "Cards - Mastercard Gateway",
            "provider": "Razorpay / Mastercard",
            "method": "CARD",
            "status": "HEALTHY",
            "success_rate": 95.8,
            "sla_baseline": 95.5,
            "latency_p95": 1310,
            "volume_24h": 8900000,
            "recommendation": "Nominal throughput",
        },
        {
            "id": "corr-nb-sbi",
            "name": "Netbanking - SBI Core Switch",
            "provider": "Razorpay / SBI",
            "method": "NETBANKING",
            "status": "HEALTHY",
            "success_rate": 94.2,
            "sla_baseline": 94.0,
            "latency_p95": 2100,
            "volume_24h": 5200000,
            "recommendation": "Batch settlement stable",
        },
    ]

    return {
        "overall_success_rate": current_overall_success,
        "previous_success_rate": 97.8,
        "success_rate_drop": round(97.8 - current_overall_success, 1),
        "transactions_processed": 42850,
        "failed_transactions": 4542 if not is_recovered else 1680,
        "revenue_at_risk": revenue_at_risk,
        "revenue_recovered": revenue_recovered,
        "recovery_rate": round((revenue_recovered / revenue_at_risk * 100) if revenue_at_risk > 0 else 0.0, 1),
        "active_incidents": 1 if not is_recovered else 0,
        "incidents": [anomaly],
        "status": "DEGRADED" if not is_recovered else "HEALTHY",
        "methods": methods,
        "corridors": corridors,
        "timeseries": timeseries,
        "incident": anomaly,
    }


@router.post("/incidents/{incident_id}/recover")
@router.post("/incidents/recover")
async def execute_incident_recovery(
    incident_id: str = "inc_upi_route_01",
    db: AsyncSession = Depends(get_db)
):
    """
    Execute Aira's autonomous recovery loop for the payment degradation incident:
    ACT → RECOVER → ESCALATE.
    
    Mutates real RecoveryCase records in SQLite, creates AuditEvent logs,
    creates Intervention entries, and updates the incident state.
    """
    now_str = datetime.utcnow().strftime("%H:%M")

    # Fetch PAYMENT_DEGRADATION cases
    result = await db.execute(
        select(RecoveryCase).where(RecoveryCase.scenario_type == "PAYMENT_DEGRADATION")
    )
    cases = result.scalars().all()

    recovered_count = 0
    escalated_count = 0
    total_recovered_amount = 0.0

    for i, case in enumerate(cases):
        # Escalate high-value cases or every 4th case for realistic variety
        if case.amount_at_risk > 100000.0 or i % 4 == 0:
            case.status = "ESCALATED"
            case.notes = (case.notes or "") + " [Aira: High-value transaction escalated to VIP recovery desk after PSP route failover]"
            escalated_count += 1
            
            # Write audit event
            audit = AuditEvent(
                id=str(uuid.uuid4()),
                case_id=case.id,
                timestamp=datetime.utcnow(),
                event_type="CASE_ESCALATED",
                actor="AIRA_AUTONOMOUS_ENGINE",
                action="Escalated to VIP Desk",
                reason=f"High-value payment (₹{case.amount_at_risk:,.2f}) flagged during UPI degradation recovery.",
                metadata_=json.dumps({"incident_id": incident_id, "amount": case.amount_at_risk})
            )
            db.add(audit)
        else:
            # Recover case
            recovered_amount = round(case.amount_at_risk * 1.0, 2)
            case.status = "RECOVERED"
            case.amount_recovered = recovered_amount
            case.notes = (case.notes or "") + " [Aira: Successfully recovered via secondary PSP gateway failover & smart retry]"
            recovered_count += 1
            total_recovered_amount += recovered_amount

            # Add Intervention record
            intervention = Intervention(
                id=str(uuid.uuid4()),
                case_id=case.id,
                action="SMART_RETRY_ALTERNATE_ROUTE",
                channel="system",
                requested_at=datetime.utcnow(),
                executed_at=datetime.utcnow(),
                result="SUCCESS",
                amount_recovered=recovered_amount,
                notes="Secondary PSP gateway failover executed under Aira Policy APPROVED.",
            )
            db.add(intervention)

            # Write audit event
            audit = AuditEvent(
                id=str(uuid.uuid4()),
                case_id=case.id,
                timestamp=datetime.utcnow(),
                event_type="CASE_RECOVERED",
                actor="AIRA_AUTONOMOUS_ENGINE",
                action=f"Recovered ₹{recovered_amount:,.2f}",
                reason="Secondary PSP gateway failover & smart retry succeeded.",
                metadata_=json.dumps({"incident_id": incident_id, "amount_recovered": recovered_amount})
            )
            db.add(audit)

    await db.commit()

    # Update in-memory incident state and timeline
    _INCIDENT_STATE["status"] = "RECOVERED"
    _INCIDENT_STATE["recovered_at"] = datetime.utcnow().isoformat()
    _INCIDENT_STATE["recovery_timeline"] = [
        {"time": "19:42", "event": "DETECT", "title": "Payment degradation detected", "detail": "UPI success rate dropped 14.1% below 95% SLA baseline", "status": "completed"},
        {"time": "19:42", "event": "DIAGNOSE", "title": "Aira analyzed payment signals", "detail": "Isolated failure spike to HDFC/ICICI UPI switch (504 Gateway Timeouts)", "status": "completed"},
        {"time": "19:42", "event": "DIAGNOSE", "title": "Root cause identified", "detail": "Bank/PSP degradation (91% confidence). Cards and Netbanking stable.", "status": "completed"},
        {"time": "19:43", "event": "DECIDE", "title": "Policy evaluated", "detail": "Aira Policy Check: APPROVED (Retry within quota 1/3, contact allowed)", "status": "completed"},
        {"time": "19:43", "event": "DECIDE", "title": "Recovery strategy selected", "detail": "Intelligent route failover & scheduled secondary gateway retry", "status": "completed"},
        {"time": now_str, "event": "ACT", "title": "Recovery action executed", "detail": f"Route failover executed across {len(cases)} affected cases via secondary PSP gateway", "status": "completed"},
        {"time": now_str, "event": "RECOVER", "title": "Revenue recovered", "detail": f"₹{total_recovered_amount:,.2f} recovered ({recovered_count} recovered, {escalated_count} escalated to VIP desk)", "status": "completed"},
    ]

    return {
        "success": True,
        "incident_id": incident_id,
        "status": "RECOVERED",
        "cases_processed": len(cases),
        "cases_recovered": recovered_count,
        "cases_escalated": escalated_count,
        "amount_recovered": total_recovered_amount,
        "message": f"Aira autonomous recovery executed successfully: {recovered_count} cases recovered, {escalated_count} escalated.",
        "timeline": _INCIDENT_STATE["recovery_timeline"],
    }


@router.post("/incidents/{incident_id}/simulate")
@router.post("/incidents/simulate")
async def simulate_incident_degradation(incident_id: str = "inc_upi_route_01"):
    """Trigger payment corridor degradation anomaly."""
    _INCIDENT_STATE["status"] = "ACTIVE"
    _INCIDENT_STATE["recovered_at"] = None
    _INCIDENT_STATE["recovery_timeline"] = [
        {"time": "19:42", "event": "DETECT", "title": "Payment degradation detected", "detail": "UPI success rate dropped 14.1% below 95% SLA baseline", "status": "completed"},
        {"time": "19:42", "event": "DIAGNOSE", "title": "Aira analyzed payment signals", "detail": "Isolated failure spike to HDFC/ICICI UPI switch (504 Gateway Timeouts)", "status": "completed"},
        {"time": "19:42", "event": "DIAGNOSE", "title": "Root cause identified", "detail": "Bank/PSP degradation (91% confidence). Cards and Netbanking stable.", "status": "completed"},
        {"time": "19:43", "event": "DECIDE", "title": "Policy evaluated", "detail": "Aira Policy Check: APPROVED (Retry within quota 1/3, contact allowed)", "status": "completed"},
        {"time": "19:43", "event": "DECIDE", "title": "Recovery strategy selected", "detail": "Intelligent route failover & scheduled secondary gateway retry", "status": "completed"},
        {"time": "—", "event": "ACT", "title": "Recovery action pending", "detail": "Waiting for operator or autonomous trigger", "status": "pending"},
        {"time": "—", "event": "RECOVER", "title": "Revenue recovery pending", "detail": "Projected ₹4.2L recoverable across 3,842 transactions", "status": "pending"},
    ]
    return {"success": True, "status": "ACTIVE", "message": "Corridor degradation simulated on HDFC UPI rail."}


@router.post("/incidents/{incident_id}/reset")
@router.post("/incidents/reset")
async def reset_incident_state(incident_id: str = "inc_upi_route_01"):
    """Restore all payment corridors to baseline SLA."""
    _INCIDENT_STATE["status"] = "RECOVERED"
    _INCIDENT_STATE["recovered_at"] = datetime.utcnow().isoformat()
    return {"success": True, "status": "HEALTHY", "message": "All payment corridors restored to baseline SLA."}

