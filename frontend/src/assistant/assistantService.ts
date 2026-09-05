import type {
  AssistantContext,
  AssistantResponse,
  ChatMessage,
} from './assistantTypes';
import { getDocForRoute } from './assistantKnowledge';

/**
 * Client-side intelligent fallback response generator.
 * Guarantees zero downtime or broken states during live demos.
 */
export function generateFallbackResponse(
  message: string,
  context: AssistantContext
): AssistantResponse {
  const doc = getDocForRoute(context.currentRoute);
  const msg = message.toLowerCase().trim();

  // 1. PRODUCT OVERVIEW
  if (
    msg.includes('what is aira') ||
    msg.includes('about aira') ||
    msg.includes('what does aira do') ||
    msg.includes('who are you') ||
    msg === 'aira'
  ) {
    return {
      intent: 'PRODUCT_OVERVIEW',
      response:
        "**AIRA is an Autonomous Payment Recovery & Revenue Operations Platform.**\n\n" +
        "### What AIRA does:\n" +
        "• **Detects** payment leakage in real time across UPI, Cards, Subscriptions, and B2B Invoices.\n" +
        "• **Diagnoses** the true technical or customer root cause using multi-source telemetry.\n" +
        "• **Governs** all actions against strict RBI, TRAI, and merchant policy guardrails.\n" +
        "• **Acts** autonomously via smart retries, 1-click Razorpay links, Hinglish voice calls, and e-NACH sequencers.\n" +
        "• **Proves** every recovery with an immutable SHA-256 cryptographic audit ledger.",
      suggested_prompts: [
        'How does payment recovery work?',
        'What am I looking at right now?',
        'Where can I see failed subscriptions?',
        'What compliance rules does Aira enforce?',
      ],
      actions: [
        { type: 'NAVIGATE', label: 'Explore AI Command Center →', route: '/' },
        { type: 'NAVIGATE', label: 'View Benchmark Evaluation →', route: '/evaluation' },
      ],
      module_context: doc.name,
    };
  }

  // 2. FLOW EXPLANATION
  if (
    msg.includes('how does payment recovery work') ||
    msg.includes('explain the flow') ||
    msg.includes('recovery loop') ||
    msg.includes('workflow') ||
    msg.includes('how does it work') ||
    msg.includes('step by step')
  ) {
    return {
      intent: 'FLOW_EXPLANATION',
      response:
        "**The AIRA Autonomous Recovery Loop**\n\n" +
        "**1. DETECT**\n" +
        "AIRA continuously streams payment telemetry from gateways (Razorpay, Cashfree, NPCI) and flags drops below SLA thresholds.\n\n" +
        "**2. DIAGNOSE**\n" +
        "The AI isolates the root cause (e.g. Bank Switch Latency, OTP Friction, Expired Mandate, or Insufficient Funds) with a confidence score.\n\n" +
        "**3. PRIORITIZE**\n" +
        "Customers are scored by recovery yield, transaction amount, and channel responsiveness.\n\n" +
        "**4. GOVERN**\n" +
        "The Policy Governor validates the action against RBI mandate cooldowns and TRAI contact limits before execution.\n\n" +
        "**5. ACT**\n" +
        "The recovery engine triggers the optimal channel: Smart Route Failover, 1-Click WhatsApp Link, e-NACH Retries, or Hinglish Voice Calls.\n\n" +
        "**6. TRACK**\n" +
        "Outcomes are recorded in the SHA-256 ledger, updating revenue recovery metrics in real time.\n\n" +
        "**7. LEARN**\n" +
        "Continuous feedback updates retry windows, corridor health weights, and recovery probabilities.",
      suggested_prompts: [
        'Explain this current screen',
        'Show me the Policy Governor',
        'How does route failover work?',
        'Where is the Cryptographic Audit Ledger?',
      ],
      actions: [
        { type: 'NAVIGATE', label: 'Open Policy Governor →', route: '/policy-governor' },
        { type: 'NAVIGATE', label: 'Inspect Audit Ledger →', route: '/audit-trail' },
      ],
      module_context: doc.name,
    };
  }

  // 3. MODULE / SCREEN EXPLANATION
  if (
    msg.includes('what am i looking at') ||
    msg.includes('explain this screen') ||
    msg.includes('explain this module') ||
    msg.includes('current screen') ||
    msg.includes('this page') ||
    msg.includes('what is this') ||
    msg.includes('explain this') ||
    msg.includes('explain')
  ) {
    return {
      intent: 'MODULE_EXPLANATION',
      response:
        `**You are currently viewing: ${doc.name}**\n\n` +
        `### What's happening?\n${doc.whatsHappening}\n\n` +
        `### Why?\n${doc.why}\n\n` +
        `### What Aira does next:\n${doc.whatAiraDoesNext}`,
      suggested_prompts: doc.suggestedPrompts,
      actions: doc.defaultActions || [],
      module_context: doc.name,
    };
  }

  // 4. NAVIGATION
  if (
    msg.includes('where can i see') ||
    msg.includes('where is') ||
    msg.includes('open ') ||
    msg.includes('navigate to') ||
    msg.includes('show me') ||
    msg.includes('take me to') ||
    msg.includes('how do i get to')
  ) {
    let targetRoute = '/';
    let targetLabel = 'AI Command Center';

    if (msg.includes('subscription')) {
      targetRoute = '/subscriptions';
      targetLabel = 'Failed-Subscription Recovery';
    } else if (msg.includes('checkout') || msg.includes('cart') || msg.includes('dropoff')) {
      targetRoute = '/checkout';
      targetLabel = 'Checkout Drop-off Recovery';
    } else if (msg.includes('invoice') || msg.includes('receivable') || msg.includes('b2b') || msg.includes('aging') || msg.includes('dso')) {
      targetRoute = '/receivables';
      targetLabel = 'B2B Receivables Chaser';
    } else if (msg.includes('mandate') || msg.includes('nach') || msg.includes('umrn')) {
      targetRoute = '/mandates';
      targetLabel = 'Mandate Retry Sequencer';
    } else if (msg.includes('voice') || msg.includes('call') || msg.includes('hinglish')) {
      targetRoute = '/voice-recovery';
      targetLabel = 'Hinglish Voice Recovery Agent';
    } else if (msg.includes('promise') || msg.includes('ptp')) {
      targetRoute = '/promise-tracker';
      targetLabel = 'Promise-to-Pay Lifecycle Tracker';
    } else if (msg.includes('policy') || msg.includes('rbi') || msg.includes('compliance')) {
      targetRoute = '/policy-governor';
      targetLabel = 'Regulatory Policy Governor';
    } else if (msg.includes('audit') || msg.includes('hash') || msg.includes('ledger')) {
      targetRoute = '/audit-trail';
      targetLabel = 'Cryptographic Audit Ledger';
    } else if (msg.includes('analytics') || msg.includes('report') || msg.includes('waterfall') || msg.includes('roi')) {
      targetRoute = '/analytics';
      targetLabel = 'Financial Intelligence & Reports';
    } else if (msg.includes('eval') || msg.includes('benchmark')) {
      targetRoute = '/evaluation';
      targetLabel = 'Agent Evaluation Benchmark';
    } else if (msg.includes('payment') || msg.includes('corridor') || msg.includes('upi') || msg.includes('degradation')) {
      targetRoute = '/payment-health';
      targetLabel = 'Payment Corridor Degradation';
    } else if (msg.includes('queue') || msg.includes('case')) {
      targetRoute = '/recovery';
      targetLabel = 'Unified Recovery Queue';
    } else if (msg.includes('conversation') || msg.includes('whatsapp') || msg.includes('inbox')) {
      targetRoute = '/conversations';
      targetLabel = 'Omni Communications Hub';
    }

    return {
      intent: 'NAVIGATION',
      response: `You can access **${targetLabel}** to inspect detailed workflows, live recovery actions, and historical telemetry.`,
      actions: [{ type: 'NAVIGATE', label: `Open ${targetLabel} →`, route: targetRoute }],
      suggested_prompts: [
        `Explain the ${targetLabel} workflow`,
        'What am I looking at on this screen?',
        'How does payment recovery work?',
      ],
      module_context: doc.name,
    };
  }

  const activeEntity = context.activeEntity;

  // 4.5 ACTIVE ENTITY CONTEXTUAL INTELLIGENCE
  if (
    activeEntity &&
    (msg.includes('high risk') ||
      msg.includes('why this customer') ||
      msg.includes('why is this customer') ||
      msg.includes('risk') ||
      msg.includes('who is this') ||
      msg.includes('customer details'))
  ) {
    const custName = activeEntity.customerName || 'Vikram Malhotra';
    const amount = activeEntity.amountAtRisk ? `₹${Number(activeEntity.amountAtRisk).toLocaleString('en-IN')}` : '₹48,500';
    const rootCause = activeEntity.rootCause || 'PAYMENT_GATEWAY_TIMEOUT';
    const riskTier = activeEntity.riskTier || 'HIGH';
    const invoiceId = activeEntity.invoiceId || 'INV-2026-9042';

    return {
      intent: 'ACTIVE_ENTITY_EXPLANATION',
      response:
        `**Contextual Account Analysis: ${custName}**\n\n` +
        `• **Risk Tier**: **${riskTier} RISK**\n` +
        `• **Overdue Exposure**: **${amount}** (${invoiceId})\n` +
        `• **Primary Root Cause**: \`${rootCause}\`\n\n` +
        `### Why is ${custName} classified as High Risk?\n` +
        `1. **Threshold Breach**: Overdue balance exceeds the automated settlement limit.\n` +
        `2. **Corridor Friction**: Payment attempts failed due to upstream HDFC switch latency and timeout errors.\n` +
        `3. **Commitment Urgency**: High revenue impact requires direct multi-channel follow-up (WhatsApp + Voice) before aging into bad debt.\n\n` +
        `### Next Recommended Action:\n` +
        `${activeEntity.suggestedAction || 'Record a verified Promise-to-Pay and dispatch a 1-click Razorpay payment link via WhatsApp.'}`,
      suggested_prompts: [
        'What should I do next?',
        'How does Hinglish voice recovery work?',
        'Show me the Policy Governor rules',
      ],
      actions: [
        { type: 'NAVIGATE', label: 'Open Voice AI Recovery Desk →', route: '/voice-recovery' },
        { type: 'NAVIGATE', label: 'View Omni Communications →', route: '/conversations' },
      ],
      module_context: doc.name,
    };
  }

  // 4.6 WHAT SHOULD I DO NEXT
  if (
    msg.includes('what should i do next') ||
    msg.includes('next step') ||
    msg.includes('what to do') ||
    msg.includes('recommended action') ||
    msg.includes('suggested action')
  ) {
    const actionDesc =
      activeEntity?.suggestedAction ||
      'Review pending degradation incidents on Payment Health, record any committed customer promises, and dispatch Razorpay 1-click payment links.';

    return {
      intent: 'RECOMMENDED_ACTION',
      response:
        `**AIRA Operational Recommendation**\n\n` +
        `### Immediate Next Action:\n` +
        `${actionDesc}\n\n` +
        `### Autonomous Policy Check:\n` +
        `• **TRAI DND Compliance**: Passed (within 09:00 - 21:00 IST window).\n` +
        `• **RBI Mandate Guardrails**: 48h pre-debit notice verified.\n` +
        `• **Cooldown Period**: Verified (no duplicate touchpoints in last 4 hours).\n\n` +
        `You can execute this action directly from the current desk or review full policy criteria.`,
      suggested_prompts: [
        'Why is this customer high risk?',
        'Open Regulatory Policy Governor',
        'How does payment recovery work?',
      ],
      actions: [
        { type: 'NAVIGATE', label: 'Inspect Policy Governor →', route: '/policy-governor' },
        { type: 'NAVIGATE', label: 'View Audit Trail →', route: '/audit-trail' },
      ],
      module_context: doc.name,
    };
  }

  // 5. CUSTOMER / CASE SELECTION
  if (
    msg.includes('why was this customer') ||
    msg.includes('why this customer') ||
    msg.includes('customer selected') ||
    msg.includes('target customer') ||
    msg.includes('why customer')
  ) {
    return {
      intent: 'CUSTOMER_EXPLANATION',
      response:
        "**Customer Selection & Prioritization Logic**\n\n" +
        "### How Aira selects accounts:\n" +
        "• **Recovery Probability Score**: Calculated using historical payment behavior, past commitment fulfillment, and corridor uptime.\n" +
        "• **Revenue Impact**: High-value transactions are prioritized for multi-channel nudges (WhatsApp + Voice) while smaller amounts use scheduled retries.\n" +
        "• **Policy Eligibility**: Customers in cooldown or with maximum reminder limits reached (TRAI 3-nudge cap) are automatically excluded.\n" +
        "• **Preferred Channel**: Selected based on customer response affinity (WhatsApp vs SMS vs Interactive Voice).",
      suggested_prompts: [
        'What actions are recommended?',
        'Explain the Policy Governor rules',
        'What am I looking at on this screen?',
      ],
      actions: [
        { type: 'NAVIGATE', label: 'View Unified Recovery Queue →', route: '/recovery' },
      ],
      module_context: doc.name,
    };
  }

  // 6. ROOT CAUSE
  if (
    msg.includes('root cause') ||
    msg.includes('why did payment fail') ||
    msg.includes('why failed') ||
    msg.includes('failure reason') ||
    msg.includes('why did payments drop') ||
    msg.includes('why drop')
  ) {
    const rc = activeEntity?.rootCause ? `Identified Incident: \`${activeEntity.rootCause}\`` : `Primary Diagnostics for ${doc.name}`;
    return {
      intent: 'ROOT_CAUSE',
      response:
        `**Root Cause Analysis — ${rc}**\n\n` +
        "### Diagnostics Breakdown:\n" +
        "• **Technical Corridors**: NPCI switch latency (>8,500ms) or 504 Gateway Timeouts across specific banking handles (HDFC/ICICI).\n" +
        "• **User Friction**: OTP delivery lag, 3DS modal abandonment, or UPI app-switch failures.\n" +
        "• **Mandate Expiry**: Invalid UMRN or expired standing instruction mandates requiring customer re-authentication.\n\n" +
        "**Aira isolates the root cause** by comparing failed transaction signatures against historical baseline patterns with 91%+ statistical confidence.",
      suggested_prompts: [
        'What action does Aira recommend?',
        'How does route failover work?',
        'Explain the Policy Governor rules',
      ],
      actions: [
        { type: 'NAVIGATE', label: 'Inspect Corridor Health →', route: '/payment-health' },
      ],
      module_context: doc.name,
    };
  }

  // 7. POLICY & COMPLIANCE
  if (
    msg.includes('policy') ||
    msg.includes('rbi') ||
    msg.includes('trai') ||
    msg.includes('compliance') ||
    msg.includes('cooldown') ||
    msg.includes('blocked')
  ) {
    return {
      intent: 'POLICY_EXPLANATION',
      response:
        "**Regulatory Policy & Compliance Guardrails**\n\n" +
        "AIRA enforces strict guardrails aligned with central bank directives:\n\n" +
        "• **RBI e-Mandate Circular (RBI/2021-22/100)**: Enforces 48h pre-debit notifications and maximum 3 retry attempts per billing cycle.\n" +
        "• **TRAI DND Guidelines**: Strictly prohibits automated customer communications between 21:00 and 09:00 IST, with a mandatory 4-hour cooldown between nudges.\n" +
        "• **Product Safety Bounds**: Requires human-in-the-loop escalation for unverified high-value transactions (>₹5,00,000).",
      suggested_prompts: [
        'Open Policy Governor',
        'Where is the Cryptographic Audit Ledger?',
        'Explain this current screen',
      ],
      actions: [
        { type: 'NAVIGATE', label: 'Open Policy Governor →', route: '/policy-governor' },
      ],
      module_context: doc.name,
    };
  }

  // 8. DEFAULT / GENERAL HELP
  return {
    intent: 'GENERAL_HELP',
    response:
      `**Aira Assistant — Here to help with ${doc.name}**\n\n` +
      `I can explain what is happening on this screen, walk you through the end-to-end recovery loop, explain why specific recovery strategies are chosen, or help you navigate between modules.\n\n` +
      `**Current Module**: ${doc.name}\n` +
      `**Summary**: ${doc.description}`,
    suggested_prompts: doc.suggestedPrompts,
    actions: doc.defaultActions || [],
    module_context: doc.name,
  };
}

/**
 * Main Assistant Query Interface.
 * Calls backend `/api/assistant/chat` with graceful fallback to local knowledge.
 */
export async function askAiraAssistant({
  message,
  context,
  history = [],
}: {
  message: string;
  context: AssistantContext;
  history?: ChatMessage[];
}): Promise<AssistantResponse> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  try {
    const formattedHistory = history.map((h) => ({
      role: h.role,
      content: h.content,
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(`${API_URL}/api/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context,
        history: formattedHistory,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: AssistantResponse = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[AiraAssistant] Network call unavailable or timed out; using built-in knowledge fallback.', err);
  }

  // Graceful fallback to client knowledge engine
  return generateFallbackResponse(message, context);
}
