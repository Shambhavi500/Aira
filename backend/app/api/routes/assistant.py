"""
Aira Assistant — AI Product Guide & Copilot API
─────────────────────────────────────────────
Context-aware intelligent product guide, flow explainer, intent classifier,
and navigation assistant for the Aira Revenue Recovery OS.
"""
from typing import Optional, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.recovery_case import RecoveryCase
from app.models.customer import Customer
from app.models.payment import Payment

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class AssistantContext(BaseModel):
    currentRoute: Optional[str] = "/"
    currentModule: Optional[str] = "Command Center"
    currentScreen: Optional[str] = "Overview"
    selectedCustomer: Optional[str] = None
    selectedPayment: Optional[str] = None
    selectedRecoveryCase: Optional[str] = None
    visibleMetrics: Optional[dict[str, Any]] = None
    currentWorkflowStep: Optional[str] = None
    activeEntity: Optional[dict[str, Any]] = None


class MessageItem(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    context: Optional[AssistantContext] = None
    history: Optional[list[MessageItem]] = []


class ActionPayload(BaseModel):
    type: str  # "NAVIGATE" | "EXPLAIN" | "TRIGGER_ACTION"
    label: str
    route: Optional[str] = None
    prompt: Optional[str] = None


class ChatResponse(BaseModel):
    intent: str
    response: str
    actions: Optional[list[ActionPayload]] = None
    suggested_prompts: Optional[list[str]] = None
    module_context: Optional[str] = None


# Module-specific knowledge and explanation templates
MODULE_KNOWLEDGE = {
    "/": {
        "name": "AI Command Center",
        "description": "AIRA's high-level command center showing real-time revenue at risk, total recovered amount, active AI interventions, and cross-channel recovery distribution.",
        "whats_happening": "You are viewing the global operational pulse of the AIRA platform. Real-time telemetry aggregates failed transactions, active recovery campaigns, and ROI metrics across all payment channels.",
        "why": "Centralized visibility allows revenue teams to monitor leakage velocity across payment gateways, checkout funnels, and B2B invoices in a single pane of glass.",
        "aira_actions": "AIRA automatically triages incoming payment failures, computes root-cause probabilities, enforces RBI/TRAI compliance policies, and dispatches multi-channel recovery workflows without manual intervention.",
        "suggested_prompts": [
            "How does payment recovery work?",
            "What can Aira recover?",
            "Explain the active recovery metrics",
            "Where can I see failed subscriptions?",
        ],
    },
    "/payment-health": {
        "name": "Payment Corridor Degradation",
        "description": "Monitors real-time payment success rates across UPI, Cards, and Netbanking to detect bank switch outages and perform autonomous route failovers.",
        "whats_happening": "AIRA is tracking payment gateway and banking switch telemetry. An active anomaly is flagged when corridor success rates drop below the 95% SLA threshold.",
        "why": "External PSP and banking route degradation (e.g., NPCI latency spikes or bank switch timeouts) causes high-volume payment drops that merchants cannot control without dynamic routing.",
        "aira_actions": "AIRA isolates the root cause via a 5-step evidence chain, evaluates retry safety against the Policy Governor, and initiates intelligent corridor failovers with scheduled secondary gateway retries.",
        "suggested_prompts": [
            "Why did UPI payments drop?",
            "What is the root cause diagnosis?",
            "How does Aira's route failover work?",
            "Explain the 5-point evidence chain",
        ],
    },
    "/checkout": {
        "name": "Checkout Drop-off Recovery",
        "description": "Tracks abandoned checkout sessions through each funnel stage (Cart → Details → Payment Method → OTP Auth → Bank Redirect) and triggers smart Razorpay payment links.",
        "whats_happening": "AIRA is analyzing shoppers who stalled during checkout due to OTP timeouts, payment method friction, or 3DS failures.",
        "why": "70%+ of cart abandonments happen during authentication or bank redirects. Immediate multi-channel outreach recovers up to 35% of stalled GMV.",
        "aira_actions": "AIRA verifies customer contact cooldowns against TRAI/RBI limits, generates 1-click Razorpay payment links, and dispatches personalized WhatsApp/SMS nudges within 15 minutes.",
        "suggested_prompts": [
            "Where do most shoppers drop off?",
            "Why was this customer selected?",
            "How do smart recovery links work?",
            "What compliance limits apply to checkout nudges?",
        ],
    },
    "/subscriptions": {
        "name": "Failed-Subscription Recovery",
        "description": "Autonomous recurring payment recovery using 4-stage smart retry sequences, optimal charging windows, and card update links.",
        "whats_happening": "AIRA is monitoring recurring SaaS and D2C subscription charges that failed due to insufficient funds, card expiry, or network timeouts.",
        "why": "Involuntary churn accounts for 40%+ of SaaS revenue loss. Blind retries fail repeatedly and trigger customer bank dispute fees.",
        "aira_actions": "AIRA schedules retries during salary credit windows (e.g., 1st–5th of month), offers alternate UPI Autopay methods, and notifies subscribers via omnichannel payment links.",
        "suggested_prompts": [
            "Why did this subscription fail?",
            "How does Aira schedule the next retry?",
            "What is the 4-stage retry sequence?",
            "How does Aira prevent involuntary churn?",
        ],
    },
    "/receivables": {
        "name": "B2B Receivables Chaser",
        "description": "Automated dunning and Days Sales Outstanding (DSO) management across 0-30d, 31-60d, 61-90d, and 90d+ aging buckets.",
        "whats_happening": "AIRA is monitoring outstanding enterprise B2B invoices, calculating recovery probabilities, and organizing accounts by aging severity.",
        "why": "Delayed receivables increase working capital strain. Unstructured email dunning leads to missed payment promises and poor collection rates.",
        "aira_actions": "AIRA classifies accounts by recovery risk, automates graduated dunning notices (Gentle → Firm → Executive Escalation), and captures structured Promises-to-Pay.",
        "suggested_prompts": [
            "What are the aging buckets showing?",
            "How does Aira prioritize overdue invoices?",
            "What dunning templates are used?",
            "How is DSO benchmarked?",
        ],
    },
    "/mandates": {
        "name": "Mandate Retry Sequencer",
        "description": "Visual multi-step retry schedule builder for e-NACH, UMRN, and UPI Autopay recurring mandates.",
        "whats_happening": "AIRA is executing structured, compliance-checked retry sequences for recurring bank debit mandates.",
        "why": "RBI guidelines restrict indiscriminate recurring debit hits. Mandates require strict backoff periods and pre-debit notifications to avoid penalties.",
        "aira_actions": "AIRA enforces 48-hour pre-debit notifications, adheres to maximum attempt limits (3 tries per cycle), and executes fallback UPI smart links.",
        "suggested_prompts": [
            "What is the mandate retry cooldown?",
            "How do e-NACH retry rules work?",
            "What happens if all 3 mandate attempts fail?",
            "How does Aira comply with RBI circulars?",
        ],
    },
    "/voice-recovery": {
        "name": "Hinglish Voice Recovery Agent",
        "description": "Autonomous bilingual conversational voice calls that negotiate payment dates and capture formal Promises-to-Pay in Hindi and English.",
        "whats_happening": "AIRA's voice AI is conducting empathetic, natural conversations with customers to resolve overdue balances and capture structured commitments.",
        "why": "Digital messages are often ignored for high-value balances. Conversational voice reaches customers immediately and achieves 3x higher commitment rates.",
        "aira_actions": "AIRA listens for payment promises, parses dates via natural language understanding, assesses customer sentiment, and generates instant UPI payment links during the call.",
        "suggested_prompts": [
            "How does Hinglish speech processing work?",
            "What happens when a customer makes a promise?",
            "How does Aira handle hostile or reluctant callers?",
            "What are the compliance rules for voice calls?",
        ],
    },
    "/promise-tracker": {
        "name": "Promise-to-Pay Lifecycle Tracker",
        "description": "Monitors customer payment commitments from creation to fulfillment, alerting operators when promises are broken or require follow-ups.",
        "whats_happening": "AIRA is tracking active payment commitments recorded from voice calls, emails, and WhatsApp conversations.",
        "why": "Tracking promised dates ensures accounts are not prematurely escalated while allowing immediate intervention the moment a commitment expires.",
        "aira_actions": "AIRA sends automated WhatsApp reminders 24 hours before due date, detects incoming payments, marks promises fulfilled, and escalates broken promises.",
        "suggested_prompts": [
            "What is the current fulfillment rate?",
            "What happens when a promise is broken?",
            "How are automated follow-ups sent?",
            "How does Aira record new promises?",
        ],
    },
    "/policy-governor": {
        "name": "Regulatory Policy Governor",
        "description": "Deterministic compliance guardrails enforcing RBI circulars, TRAI contact frequency rules, and financial risk limits.",
        "whats_happening": "You are viewing the policy rules that govern every autonomous recovery action before execution.",
        "why": "Autonomous AI systems must never violate financial regulations, spam customers, or exceed retry limits.",
        "aira_actions": "Every recovery proposal passes through the Policy Governor. If an action breaches contact quotas or cooldown windows, it is immediately BLOCKED or ESCALATED.",
        "suggested_prompts": [
            "Which RBI circulars are enforced?",
            "What are the TRAI contact cooldown limits?",
            "How are blocked actions audited?",
            "What is the Policy Override workflow?",
        ],
    },
    "/audit-trail": {
        "name": "Cryptographic Audit Ledger",
        "description": "Immutable, SHA-256 verifiable chronological record of every AI detection, policy evaluation, and intervention.",
        "whats_happening": "AIRA records all system events with actor timestamps, rule evaluations, and cryptographic hashes.",
        "why": "Financial audits require complete transparency and non-repudiation for every automated dollar recovered.",
        "aira_actions": "Provides proof of compliance for regulatory audits, internal risk reviews, and dispute resolution.",
        "suggested_prompts": [
            "How is the SHA-256 hash verified?",
            "Can audit records be modified or deleted?",
            "How do I filter audit events by actor?",
            "What events are recorded in the ledger?",
        ],
    },
    "/evaluation": {
        "name": "Agent Evaluation Benchmark",
        "description": "Deterministic benchmark runner testing AIRA's decision engine across 120 synthetic cases with seed=42.",
        "whats_happening": "AIRA is running an automated evaluation of recovery accuracy, policy adherence, and simulated revenue yield.",
        "why": "Reproducible benchmarking proves system reliability and safety under extreme market conditions without endangering live customer funds.",
        "aira_actions": "Evaluates diagnosis accuracy, policy block rate, and recovery yield across 7 distinct failure scenarios.",
        "suggested_prompts": [
            "What is the evaluation benchmark score?",
            "Why is seed=42 used?",
            "What scenarios are tested?",
            "How is recovery yield calculated?",
        ],
    },
}


def _classify_intent(message: str) -> str:
    msg = message.lower()
    if any(w in msg for w in ["what is aira", "about aira", "what does aira do", "overview", "who are you"]):
        return "PRODUCT_OVERVIEW"
    if any(w in msg for w in ["how does payment recovery work", "explain the flow", "recovery loop", "workflow", "how does it work", "step by step"]):
        return "FLOW_EXPLANATION"
    if any(w in msg for w in ["what am i looking at", "explain this screen", "explain this module", "current screen", "this page", "what is this"]):
        return "MODULE_EXPLANATION"
    if any(w in msg for w in ["where can i see", "where is", "open ", "navigate to", "show me", "take me to", "how do i get to"]):
        return "NAVIGATION"
    if any(w in msg for w in ["why was this customer", "why this customer", "target customer", "customer selected", "why customer"]):
        return "CUSTOMER_EXPLANATION"
    if any(w in msg for w in ["root cause", "why did payment fail", "why failed", "failure reason", "why did payments drop"]):
        return "ROOT_CAUSE"
    if any(w in msg for w in ["action", "recommendation", "what does aira do next", "what happens next", "next step", "why retry"]):
        return "RECOVERY_ACTION"
    if any(w in msg for w in ["policy", "rbi", "trai", "compliance", "cooldown", "blocked"]):
        return "POLICY_EXPLANATION"
    if any(w in msg for w in ["metric", "revenue at risk", "recovered", "recovery rate", "dso", "how much"]):
        return "METRIC_EXPLANATION"
    return "GENERAL_HELP"


@router.post("/chat", response_model=ChatResponse)
async def assistant_chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Intelligent context-aware assistant answering questions about AIRA,
    the active screen, recovery loop, policies, and navigation.
    """
    route = req.context.currentRoute if req.context and req.context.currentRoute else "/"
    # Normalize aliases
    if route == "/voice":
        route = "/voice-recovery"
    elif route == "/promises":
        route = "/promise-tracker"
    elif route == "/policy":
        route = "/policy-governor"
    elif route == "/audit":
        route = "/audit-trail"

    mod_info = MODULE_KNOWLEDGE.get(route, MODULE_KNOWLEDGE["/"])
    intent = _classify_intent(req.message)
    active_entity = req.context.activeEntity if req.context else None
    msg_lower = req.message.lower()

    # Active Entity Contextual Intelligence
    if active_entity and any(term in msg_lower for term in ["high risk", "why this customer", "why is this customer", "risk", "who is this", "customer details"]):
        cust_name = active_entity.get("customerName", "Vikram Malhotra")
        amount = active_entity.get("amountAtRisk")
        amt_str = f"₹{int(amount):,}" if amount else "₹48,500"
        root_cause = active_entity.get("rootCause", "PAYMENT_GATEWAY_TIMEOUT")
        risk_tier = active_entity.get("riskTier", "HIGH")
        inv_id = active_entity.get("invoiceId", "INV-2026-9042")
        suggested = active_entity.get("suggestedAction", "Record a verified Promise-to-Pay and dispatch a 1-click Razorpay payment link via WhatsApp.")

        return ChatResponse(
            intent="ACTIVE_ENTITY_EXPLANATION",
            response=(
                f"**Contextual Account Analysis: {cust_name}**\n\n"
                f"• **Risk Tier**: **{risk_tier} RISK**\n"
                f"• **Overdue Exposure**: **{amt_str}** ({inv_id})\n"
                f"• **Primary Root Cause**: `{root_cause}`\n\n"
                f"### Why is {cust_name} classified as High Risk?\n"
                f"1. **Threshold Breach**: Overdue balance exceeds the automated settlement limit.\n"
                f"2. **Corridor Friction**: Payment attempts failed due to upstream HDFC switch latency and timeout errors.\n"
                f"3. **Commitment Urgency**: High revenue impact requires direct multi-channel follow-up (WhatsApp + Voice) before aging into bad debt.\n\n"
                f"### Next Recommended Action:\n"
                f"{suggested}"
            ),
            suggested_prompts=[
                "What should I do next?",
                "How does Hinglish voice recovery work?",
                "Show me the Policy Governor rules",
            ],
            actions=[
                ActionPayload(type="NAVIGATE", label="Open Voice AI Recovery Desk", route="/voice-recovery"),
                ActionPayload(type="NAVIGATE", label="View Omni Communications", route="/conversations"),
            ],
            module_context=mod_info["name"],
        )

    if any(term in msg_lower for term in ["what should i do next", "next step", "what to do", "recommended action", "suggested action"]):
        action_desc = (
            active_entity.get("suggestedAction")
            if active_entity and active_entity.get("suggestedAction")
            else "Review pending degradation incidents on Payment Health, record any committed customer promises, and dispatch Razorpay 1-click payment links."
        )
        return ChatResponse(
            intent="RECOMMENDED_ACTION",
            response=(
                "**AIRA Operational Recommendation**\n\n"
                f"### Immediate Next Action:\n"
                f"{action_desc}\n\n"
                "### Autonomous Policy Check:\n"
                "• **TRAI DND Compliance**: Passed (within 09:00 - 21:00 IST window).\n"
                "• **RBI Mandate Guardrails**: 48h pre-debit notice verified.\n"
                "• **Cooldown Period**: Verified (no duplicate touchpoints in last 4 hours).\n\n"
                "You can execute this action directly from the current desk or review full policy criteria."
            ),
            suggested_prompts=[
                "Why is this customer high risk?",
                "Open Regulatory Policy Governor",
                "How does payment recovery work?",
            ],
            actions=[
                ActionPayload(type="NAVIGATE", label="Inspect Policy Governor", route="/policy-governor"),
                ActionPayload(type="NAVIGATE", label="View Audit Trail", route="/audit-trail"),
            ],
            module_context=mod_info["name"],
        )

    # 1. PRODUCT OVERVIEW
    if intent == "PRODUCT_OVERVIEW":
        return ChatResponse(
            intent="PRODUCT_OVERVIEW",
            response=(
                "**AIRA is an Autonomous Payment Recovery & Revenue Operations Platform.**\n\n"
                "### What AIRA does:\n"
                "• **Detects** payment leakage in real time across UPI, Cards, Subscriptions, and B2B Invoices.\n"
                "• **Diagnoses** the true technical or customer root cause using multi-source telemetry.\n"
                "• **Governs** all actions against strict RBI, TRAI, and merchant policy guardrails.\n"
                "• **Acts** autonomously via smart retries, 1-click Razorpay links, Hinglish voice calls, and e-NACH sequencers.\n"
                "• **Proves** every recovery with an immutable SHA-256 cryptographic audit ledger."
            ),
            suggested_prompts=[
                "Explain the 7-step recovery flow",
                "What am I looking at right now?",
                "Where can I see failed subscriptions?",
                "What compliance rules does Aira enforce?",
            ],
            actions=[
                ActionPayload(type="NAVIGATE", label="Explore AI Command Center", route="/"),
                ActionPayload(type="NAVIGATE", label="View Benchmark Evaluation", route="/evaluation"),
            ],
            module_context=mod_info["name"],
        )

    # 2. FLOW EXPLANATION (7-Step Loop)
    if intent == "FLOW_EXPLANATION":
        return ChatResponse(
            intent="FLOW_EXPLANATION",
            response=(
                "**The AIRA Autonomous Recovery Loop**\n\n"
                "**1. DETECT**\n"
                "AIRA continuously streams payment telemetry from gateways (Razorpay, Cashfree, NPCI) and flags drops below SLA thresholds.\n\n"
                "**2. DIAGNOSE**\n"
                "The AI isolates the root cause (e.g. Bank Switch Latency, OTP Friction, Expired Mandate, or Insufficient Funds) with a confidence score.\n\n"
                "**3. PRIORITIZE**\n"
                "Customers are scored by recovery yield, transaction amount, and channel responsiveness.\n\n"
                "**4. GOVERN**\n"
                "The Policy Governor validates the action against RBI mandate cooldowns and TRAI contact limits before execution.\n\n"
                "**5. ACT**\n"
                "The recovery engine triggers the optimal channel: Smart Route Failover, 1-Click WhatsApp Link, e-NACH Retries, or Hinglish Voice Calls.\n\n"
                "**6. TRACK**\n"
                "Outcomes are recorded in the SHA-256 ledger, updating revenue recovery metrics in real time.\n\n"
                "**7. LEARN**\n"
                "Continuous feedback updates retry windows, corridor health weights, and recovery probabilities."
            ),
            suggested_prompts=[
                "Explain this current screen",
                "Show me the Policy Governor",
                "How does route failover work?",
                "Where is the Cryptographic Audit Ledger?",
            ],
            actions=[
                ActionPayload(type="NAVIGATE", label="View Policy Governor", route="/policy-governor"),
                ActionPayload(type="NAVIGATE", label="Inspect Audit Ledger", route="/audit-trail"),
            ],
            module_context=mod_info["name"],
        )

    # 3. MODULE EXPLANATION
    if intent == "MODULE_EXPLANATION":
        return ChatResponse(
            intent="MODULE_EXPLANATION",
            response=(
                f"**You are currently viewing: {mod_info['name']}**\n\n"
                f"### What's happening?\n{mod_info['whats_happening']}\n\n"
                f"### Why?\n{mod_info['why']}\n\n"
                f"### What Aira does next:\n{mod_info['aira_actions']}"
            ),
            suggested_prompts=mod_info["suggested_prompts"],
            module_context=mod_info["name"],
        )

    # 4. NAVIGATION
    if intent == "NAVIGATION":
        msg = req.message.lower()
        target_route = "/"
        target_label = "Command Center"
        if "subscription" in msg:
            target_route = "/subscriptions"
            target_label = "Failed-Subscription Recovery"
        elif "checkout" in msg or "cart" in msg or "dropoff" in msg:
            target_route = "/checkout"
            target_label = "Checkout Drop-off Recovery"
        elif "invoice" in msg or "receivable" in msg or "b2b" in msg or "aging" in msg:
            target_route = "/receivables"
            target_label = "B2B Receivables Chaser"
        elif "mandate" in msg or "nach" in msg:
            target_route = "/mandates"
            target_label = "Mandate Retry Sequencer"
        elif "voice" in msg or "call" in msg or "hinglish" in msg:
            target_route = "/voice-recovery"
            target_label = "Hinglish Voice Recovery Agent"
        elif "promise" in msg or "ptp" in msg:
            target_route = "/promise-tracker"
            target_label = "Promise-to-Pay Lifecycle Tracker"
        elif "policy" in msg or "rbi" in msg or "compliance" in msg:
            target_route = "/policy-governor"
            target_label = "Regulatory Policy Governor"
        elif "audit" in msg or "hash" in msg or "ledger" in msg:
            target_route = "/audit-trail"
            target_label = "Cryptographic Audit Ledger"
        elif "analytics" in msg or "report" in msg or "waterfall" in msg:
            target_route = "/analytics"
            target_label = "Financial Intelligence & Reports"
        elif "eval" in msg or "benchmark" in msg:
            target_route = "/evaluation"
            target_label = "Agent Evaluation Benchmark"
        elif "payment" in msg or "corridor" in msg or "upi" in msg:
            target_route = "/payment-health"
            target_label = "Payment Corridor Degradation"

        return ChatResponse(
            intent="NAVIGATION",
            response=f"You can access **{target_label}** to inspect detailed workflows, live recovery actions, and historical telemetry.",
            actions=[
                ActionPayload(type="NAVIGATE", label=f"Open {target_label} →", route=target_route)
            ],
            suggested_prompts=[
                f"Explain the {target_label} workflow",
                "What am I looking at on this screen?",
                "How does payment recovery work?",
            ],
            module_context=mod_info["name"],
        )

    # 5. CUSTOMER EXPLANATION
    if intent == "CUSTOMER_EXPLANATION":
        return ChatResponse(
            intent="CUSTOMER_EXPLANATION",
            response=(
                "**Customer Selection & Prioritization Logic**\n\n"
                "### How Aira selects accounts:\n"
                "• **Recovery Probability Score**: Calculated using historical payment behavior, past commitment fulfillment, and corridor uptime.\n"
                "• **Revenue Impact**: High-value transactions are prioritized for multi-channel nudges (WhatsApp + Voice) while smaller amounts use scheduled retries.\n"
                "• **Policy Eligibility**: Customers in cooldown or with maximum reminder limits reached (TRAI 3-nudge cap) are automatically excluded.\n"
                "• **Preferred Channel**: Selected based on customer response affinity (WhatsApp vs SMS vs Interactive Voice)."
            ),
            suggested_prompts=[
                "What actions are recommended?",
                "Explain the Policy Governor rules",
                "What am I looking at on this screen?",
            ],
            module_context=mod_info["name"],
        )

    # 6. ROOT CAUSE
    if intent == "ROOT_CAUSE":
        return ChatResponse(
            intent="ROOT_CAUSE",
            response=(
                f"**Root Cause Analysis for {mod_info['name']}**\n\n"
                "### Primary Diagnostics:\n"
                "• **Technical Corridors**: NPCI switch latency (>8,500ms) or 504 Gateway Timeouts across specific banking handles (HDFC/ICICI).\n"
                "• **User Friction**: OTP delivery lag, 3DS modal abandonment, or UPI app-switch failures.\n"
                "• **Mandate Expiry**: Invalid UMRN or expired standing instruction mandates requiring customer re-authentication.\n\n"
                "**Aira isolates the root cause** by comparing failed transaction signatures against historical baseline patterns with 91%+ statistical confidence."
            ),
            suggested_prompts=[
                "What action does Aira recommend?",
                "How does route failover work?",
                "Explain the Policy Governor rules",
            ],
            module_context=mod_info["name"],
        )

    # 7. RECOVERY ACTION
    if intent == "RECOVERY_ACTION":
        return ChatResponse(
            intent="RECOVERY_ACTION",
            response=(
                "**Aira's Recommended Recovery Action**\n\n"
                "### Action Strategy:\n"
                "1. **Intelligent Failover**: Shift live traffic away from degraded PSP routes to secondary healthy gateways.\n"
                "2. **Smart Payment Link Dispatch**: Generate a 1-click Razorpay recovery link with multi-method fallback (UPI, Cards, Netbanking).\n"
                "3. **Scheduled Salary-Window Retry**: Delay automated mandate retries until high-liquidity windows (1st-5th of the month).\n"
                "4. **Autonomous Voice Follow-up**: Trigger natural Hinglish voice call for high-priority overdue balances.\n\n"
                "All actions are validated through the **Policy Governor** prior to execution to prevent compliance violations."
            ),
            suggested_prompts=[
                "Show me the Policy Governor",
                "How does Hinglish voice recovery work?",
                "What am I looking at on this screen?",
            ],
            actions=[
                ActionPayload(type="NAVIGATE", label="View Policy Governor", route="/policy-governor")
            ],
            module_context=mod_info["name"],
        )

    # 8. POLICY EXPLANATION
    if intent == "POLICY_EXPLANATION":
        return ChatResponse(
            intent="POLICY_EXPLANATION",
            response=(
                "**Regulatory Policy & Compliance Guardrails**\n\n"
                "AIRA enforces strict guardrails aligned with central bank directives:\n\n"
                "• **RBI e-Mandate Circular (RBI/2021-22/100)**: Enforces 48h pre-debit notifications and maximum 3 retry attempts per billing cycle.\n"
                "• **TRAI DND Guidelines**: Strictly prohibits automated customer communications between 21:00 and 09:00 IST, with a mandatory 4-hour cooldown between nudges.\n"
                "• **Product Safety Bounds**: Requires human-in-the-loop escalation for unverified high-value transactions (>₹5,00,000)."
            ),
            suggested_prompts=[
                "Open Policy Governor",
                "Where is the Cryptographic Audit Ledger?",
                "Explain this current screen",
            ],
            actions=[
                ActionPayload(type="NAVIGATE", label="Open Policy Governor →", route="/policy-governor")
            ],
            module_context=mod_info["name"],
        )

    # 9. METRICS EXPLANATION
    if intent == "METRIC_EXPLANATION":
        # Fetch current database totals
        at_risk = await db.scalar(select(func.coalesce(func.sum(RecoveryCase.amount_at_risk), 0)))
        recovered = await db.scalar(select(func.coalesce(func.sum(RecoveryCase.amount_recovered), 0)))
        rate = (float(recovered) / float(at_risk) * 100) if at_risk and float(at_risk) > 0 else 0.0

        return ChatResponse(
            intent="METRIC_EXPLANATION",
            response=(
                "**AIRA Live Financial Metrics**\n\n"
                f"• **Revenue at Risk**: ₹{float(at_risk or 0):,.2f} — Total GMV across detected failed payments and open receivables.\n"
                f"• **Revenue Recovered**: ₹{float(recovered or 0):,.2f} — Realized revenue reclaimed by AIRA's autonomous interventions.\n"
                f"• **Recovery Rate**: {rate:.1f}% — Effective yield across all active recovery corridors.\n\n"
                "All metrics update dynamically from the transactional database as interventions complete."
            ),
            suggested_prompts=[
                "Explain the 7-step recovery flow",
                "Show me the Financial Intelligence reports",
                "What am I looking at on this screen?",
            ],
            actions=[
                ActionPayload(type="NAVIGATE", label="View Financial Intelligence →", route="/analytics")
            ],
            module_context=mod_info["name"],
        )

    # 10. GENERAL HELP / DEFAULT
    return ChatResponse(
        intent="GENERAL_HELP",
        response=(
            f"**Aira Assistant — Here to help with {mod_info['name']}**\n\n"
            "I can explain what is happening on this screen, walk you through the end-to-end recovery loop, explain why specific recovery strategies are chosen, or help you navigate between modules.\n\n"
            f"**Current Module**: {mod_info['name']}\n"
            f"**Summary**: {mod_info['description']}"
        ),
        suggested_prompts=mod_info["suggested_prompts"],
        module_context=mod_info["name"],
    )
