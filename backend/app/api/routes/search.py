"""
Global Search & Command Palette API Routes
Enables instant unified indexing across customers, recovery cases, invoices,
subscriptions, checkout sessions, and quick operational actions.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.customer import Customer
from app.models.recovery_case import RecoveryCase
from app.models.invoice import Invoice
from app.models.subscription import Subscription
from app.models.checkout_session import CheckoutSession
from app.models.promise_to_pay import PromiseToPay

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def global_search(
    q: str = Query(default="", min_length=1),
    db: AsyncSession = Depends(get_db),
):
    query = q.lower().strip()
    if not query:
        return {"results": []}

    results = []

    # 1. Customers
    c_res = await db.execute(select(Customer).limit(100))
    customers = c_res.scalars().all()
    for c in customers:
        if query in c.name.lower() or query in c.email.lower() or (c.phone and query in c.phone):
            results.append({
                "type": "customer",
                "id": c.id,
                "title": c.name,
                "subtitle": f"{c.email} · {c.risk_segment} Risk",
                "route": f"/recovery?search={c.name}",
                "badge": "CUSTOMER",
            })

    # 2. Recovery Cases
    cases_res = await db.execute(select(RecoveryCase).limit(100))
    cases = cases_res.scalars().all()
    for cs in cases:
        if query in cs.id.lower() or query in cs.scenario_type.lower() or (cs.root_cause and query in cs.root_cause.lower()):
            results.append({
                "type": "case",
                "id": cs.id,
                "title": f"Case {cs.id[:8]} — {cs.scenario_type.replace('_', ' ')}",
                "subtitle": f"₹{cs.amount_at_risk:,.0f} at risk · Status: {cs.status}",
                "route": f"/recovery/{cs.id}",
                "badge": cs.status,
            })

    # 3. Invoices
    inv_res = await db.execute(select(Invoice).limit(100))
    invoices = inv_res.scalars().all()
    for inv in invoices:
        num = inv.invoice_number or inv.id
        if query in num.lower() or (inv.description and query in inv.description.lower()):
            results.append({
                "type": "invoice",
                "id": inv.id,
                "title": f"Invoice {num}",
                "subtitle": f"₹{inv.amount:,.0f} · Status: {inv.status.upper()}",
                "route": f"/receivables?search={num}",
                "badge": inv.status.upper(),
            })

    # 4. Checkout Sessions
    chk_res = await db.execute(select(CheckoutSession).limit(100))
    sessions = chk_res.scalars().all()
    for s in sessions:
        cust = await db.get(Customer, s.customer_id) if s.customer_id else None
        c_name = cust.name if cust else "Checkout Customer"
        if query in s.id.lower() or query in c_name.lower() or (s.items_summary and query in s.items_summary.lower()):
            results.append({
                "type": "checkout",
                "id": s.id,
                "title": f"Checkout: {c_name}",
                "subtitle": f"INR {s.cart_value:,.0f} · {s.dropoff_step.replace('_', ' ').title() if s.dropoff_step else 'Cart'}",
                "route": f"/checkout",
                "badge": s.status.upper() if s.status else "ABANDONED",
            })

    # Quick Action suggestions
    actions = [
        {"type": "action", "id": "act-1", "title": "Command Center", "subtitle": "Open AI Revenue Recovery Control Room", "route": "/", "badge": "NAV"},
        {"type": "action", "id": "act-2", "title": "Payment Health", "subtitle": "Inspect Corridor Degradations & Route Recovery", "route": "/payment-health", "badge": "NAV"},
        {"type": "action", "id": "act-3", "title": "Checkout Recovery", "subtitle": "Recover Abandoned Cart & Checkout Drops", "route": "/checkout", "badge": "NAV"},
        {"type": "action", "id": "act-4", "title": "Subscription Recovery", "subtitle": "Run 4-Stage Smart Retries & Mandate Fixes", "route": "/subscriptions", "badge": "NAV"},
        {"type": "action", "id": "act-5", "title": "B2B Receivables", "subtitle": "Track Aging Buckets & Trigger Dunning", "route": "/receivables", "badge": "NAV"},
        {"type": "action", "id": "act-6", "title": "Mandate Sequencer", "subtitle": "Orchestrate UPI AutoPay & e-NACH Sequences", "route": "/mandates", "badge": "NAV"},
        {"type": "action", "id": "act-7", "title": "Hinglish Voice Recovery", "subtitle": "Launch Conversational Voice AI Agent", "route": "/voice", "badge": "NAV"},
        {"type": "action", "id": "act-8", "title": "Promise-to-Pay Tracker", "subtitle": "Review Payment Commitments & Due Dates", "route": "/promises", "badge": "NAV"},
        {"type": "action", "id": "act-9", "title": "Multi-Channel Conversations", "subtitle": "Review WhatsApp, SMS, Email Inbox", "route": "/conversations", "badge": "NAV"},
        {"type": "action", "id": "act-10", "title": "Financial Analytics", "subtitle": "Inspect Revenue Flows & Cohort Curves", "route": "/analytics", "badge": "NAV"},
    ]

    for a in actions:
        if query in a["title"].lower() or query in a["subtitle"].lower():
            results.append(a)

    return {"results": results[:15]}
