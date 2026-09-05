import type { AssistantAction } from './assistantTypes';

export interface ModuleDoc {
  name: string;
  route: string;
  badge: string;
  description: string;
  whatsHappening: string;
  why: string;
  whatAiraDoesNext: string;
  suggestedPrompts: string[];
  defaultActions?: AssistantAction[];
}

export const MODULE_DOCS: Record<string, ModuleDoc> = {
  '/': {
    name: 'AI Command Center',
    route: '/',
    badge: 'Overview',
    description: "Centralized executive pulse aggregating real-time payment leakage, active recovery campaigns, and ROI metrics across all payment methods.",
    whatsHappening: "You are looking at AIRA's high-level command center showing real-time revenue at risk, total recovered amount, active AI interventions, and scenario breakdowns.",
    why: "Centralized visibility allows revenue teams to monitor leakage velocity across payment gateways, checkout funnels, and B2B invoices in a single pane of glass.",
    whatAiraDoesNext: "AIRA automatically triages incoming payment failures, computes root-cause probabilities, enforces RBI/TRAI compliance policies, and dispatches multi-channel recovery workflows.",
    suggestedPrompts: [
      'What is Aira?',
      'How does payment recovery work?',
      'What can Aira recover?',
      'Where can I see failed subscriptions?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Open Benchmark Evaluation →', route: '/evaluation' },
      { type: 'NAVIGATE', label: 'View Payment Corridor Health →', route: '/payment-health' },
    ],
  },
  '/payment-health': {
    name: 'Payment Corridor Degradation',
    route: '/payment-health',
    badge: 'Corridor Health',
    description: "Real-time telemetry tracking UPI, Cards, and Netbanking corridor degradation, isolating bank switch failures, and triggering route failovers.",
    whatsHappening: "AIRA is tracking payment gateway and banking switch telemetry. An active anomaly is flagged when corridor success rates drop below the 95% SLA threshold.",
    why: "External PSP and banking route degradation (e.g., NPCI latency spikes or bank switch timeouts) causes high-volume payment drops that merchants cannot control without dynamic routing.",
    whatAiraDoesNext: "AIRA isolates the root cause via a 5-step evidence chain, evaluates retry safety against the Policy Governor, and initiates intelligent corridor failovers with scheduled secondary gateway retries.",
    suggestedPrompts: [
      'Why did UPI payments drop?',
      'What is the root cause diagnosis?',
      'How does Aira route failover work?',
      'Explain the 5-point evidence chain',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Open Policy Governor →', route: '/policy-governor' },
      { type: 'NAVIGATE', label: 'View Unified Recovery Queue →', route: '/recovery' },
    ],
  },
  '/checkout': {
    name: 'Checkout Drop-off Recovery',
    route: '/checkout',
    badge: 'Checkout Recovery',
    description: "Full-funnel abandoned session tracker identifying authentication drop-offs and dispatching 1-click Razorpay recovery payment links.",
    whatsHappening: "AIRA is analyzing shoppers who stalled during checkout due to OTP timeouts, payment method friction, or 3DS failures.",
    why: "70%+ of cart abandonments happen during authentication or bank redirects. Immediate multi-channel outreach recovers up to 35% of stalled GMV.",
    whatAiraDoesNext: "AIRA verifies customer contact cooldowns against TRAI/RBI limits, generates 1-click Razorpay payment links, and dispatches personalized WhatsApp/SMS nudges within 15 minutes.",
    suggestedPrompts: [
      'Where do most shoppers drop off?',
      'Why was this customer selected?',
      'How do smart recovery links work?',
      'What compliance limits apply to checkout nudges?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Inspect Omni Communications →', route: '/conversations' },
    ],
  },
  '/subscriptions': {
    name: 'Failed-Subscription Recovery',
    route: '/subscriptions',
    badge: 'Subscription Retries',
    description: "Intelligent recurring billing recovery using 4-stage smart retries, salary-window scheduling, and alternate UPI Autopay link generation.",
    whatsHappening: "AIRA is monitoring recurring SaaS and D2C subscription charges that failed due to insufficient funds, card expiry, or network timeouts.",
    why: "Involuntary churn accounts for 40%+ of SaaS revenue loss. Blind retries fail repeatedly and trigger customer bank dispute fees.",
    whatAiraDoesNext: "AIRA schedules retries during salary credit windows (e.g., 1st–5th of month), offers alternate UPI Autopay methods, and notifies subscribers via omnichannel payment links.",
    suggestedPrompts: [
      'Why did this subscription fail?',
      'How does Aira schedule the next retry?',
      'What is the 4-stage retry sequence?',
      'How does Aira prevent involuntary churn?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'View Mandate Retry Sequencer →', route: '/mandates' },
    ],
  },
  '/receivables': {
    name: 'B2B Receivables Chaser',
    route: '/receivables',
    badge: 'B2B Invoices',
    description: "Aging bucket management (0-30d, 31-60d, 61-90d, 90d+), automated dunning campaigns, and structured Promise-to-Pay capture.",
    whatsHappening: "AIRA is monitoring outstanding enterprise B2B invoices, calculating recovery probabilities, and organizing accounts by aging severity.",
    why: "Delayed receivables increase working capital strain. Unstructured email dunning leads to missed payment promises and poor collection rates.",
    whatAiraDoesNext: "AIRA classifies accounts by recovery risk, automates graduated dunning notices (Gentle → Firm → Executive Escalation), and captures structured Promises-to-Pay.",
    suggestedPrompts: [
      'What are the aging buckets showing?',
      'How does Aira prioritize overdue invoices?',
      'What dunning templates are used?',
      'How is DSO benchmarked?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Open Promise-to-Pay Tracker →', route: '/promise-tracker' },
    ],
  },
  '/mandates': {
    name: 'Mandate Retry Sequencer',
    route: '/mandates',
    badge: 'e-NACH & Mandates',
    description: "Visual retry sequence builder for e-NACH and UPI Autopay mandates adhering strictly to RBI pre-debit rules and cooldown windows.",
    whatsHappening: "AIRA is executing structured, compliance-checked retry sequences for recurring bank debit mandates.",
    why: "RBI guidelines restrict recurring debit hits without cooldowns. Mandates require strict backoff periods and pre-debit notifications to avoid penalties.",
    whatAiraDoesNext: "AIRA enforces 48-hour pre-debit notifications, adheres to maximum attempt limits (3 tries per cycle), and executes fallback UPI smart links.",
    suggestedPrompts: [
      'What is the mandate retry cooldown?',
      'How do e-NACH retry rules work?',
      'What happens if all 3 mandate attempts fail?',
      'How does Aira comply with RBI circulars?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'View Policy Governor →', route: '/policy-governor' },
    ],
  },
  '/voice-recovery': {
    name: 'Hinglish Voice Recovery Agent',
    route: '/voice-recovery',
    badge: 'Voice AI',
    description: "Autonomous bilingual conversational phone calls that negotiate payment dates and capture formal Promises-to-Pay in Hindi and English.",
    whatsHappening: "AIRA's voice AI is conducting empathetic, natural conversations with customers to resolve overdue balances and capture structured commitments.",
    why: "Digital messages are often ignored for high-value balances. Conversational voice reaches customers immediately and achieves 3x higher commitment rates.",
    whatAiraDoesNext: "AIRA listens for payment promises, parses dates via natural language understanding, assesses customer sentiment, and generates instant UPI payment links during the call.",
    suggestedPrompts: [
      'How does Hinglish speech processing work?',
      'What happens when a customer makes a promise?',
      'How does Aira handle hostile or reluctant callers?',
      'What are the compliance rules for voice calls?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Open Promise-to-Pay Tracker →', route: '/promise-tracker' },
    ],
  },
  '/promise-tracker': {
    name: 'Promise-to-Pay Lifecycle Tracker',
    route: '/promise-tracker',
    badge: 'PTP Tracker',
    description: "Monitors customer payment commitments from creation to fulfillment, alerting operators when promises are broken or require follow-ups.",
    whatsHappening: "AIRA is tracking active payment commitments recorded from voice calls, emails, and WhatsApp conversations.",
    why: "Tracking promised dates ensures accounts are not prematurely escalated while allowing immediate intervention the moment a commitment expires.",
    whatAiraDoesNext: "AIRA sends automated WhatsApp reminders 24 hours before due date, detects incoming payments, marks promises fulfilled, and escalates broken promises.",
    suggestedPrompts: [
      'What is the current fulfillment rate?',
      'What happens when a promise is broken?',
      'How are automated follow-ups sent?',
      'How does Aira record new promises?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Open B2B Receivables Chaser →', route: '/receivables' },
    ],
  },
  '/conversations': {
    name: 'Omni Communications Hub',
    route: '/conversations',
    badge: 'Communications',
    description: "Unified omnichannel inbox across WhatsApp, SMS, Email, and Voice with AI suggested replies and 1-click dispatch.",
    whatsHappening: "AIRA is consolidating all customer recovery communications into a single chronological stream with AI response recommendations.",
    why: "Omnichannel coordination prevents embarrassing duplicate messages and ensures customers receive contextually relevant payment links.",
    whatAiraDoesNext: "AIRA analyzes customer replies, parses payment intent, drafts personalized responses with Razorpay links, and updates case status upon customer reply.",
    suggestedPrompts: [
      'How are channels selected?',
      'What is the WhatsApp open rate?',
      'How does AI draft replies?',
      'What happens when a customer replies?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'View Checkout Recovery →', route: '/checkout' },
    ],
  },
  '/analytics': {
    name: 'Financial Intelligence & Reports',
    route: '/analytics',
    badge: 'Analytics & ROI',
    description: "Comprehensive financial analytics featuring recovery pipeline waterfalls, cohort aging curves, channel unit economics, and audit exports.",
    whatsHappening: "AIRA is computing financial performance metrics, channel ROI multipliers, and recovery cohort curves from transactional data.",
    why: "Finance and risk leaders need transparent visibility into net recovered capital, channel cost efficiency, and cohort velocity.",
    whatAiraDoesNext: "AIRA generates real-time pipeline waterfall charts, compares multi-channel recovery yields, and exports cryptographic audit summaries.",
    suggestedPrompts: [
      'What is the average ROI across channels?',
      'How is the pipeline waterfall computed?',
      'How do cohort recovery curves work?',
      'How do I export audit reports?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'View Cryptographic Audit Ledger →', route: '/audit-trail' },
    ],
  },
  '/policy-governor': {
    name: 'Regulatory Policy Governor',
    route: '/policy-governor',
    badge: 'Regulatory Governor',
    description: "Deterministic compliance engine enforcing central bank (RBI) circulars, TRAI DND contact rules, and financial risk limits.",
    whatsHappening: "You are viewing the regulatory policy rules and parameter bounds that govern every autonomous recovery action before execution.",
    why: "Autonomous AI systems must never violate financial regulations, spam customers, or exceed retry limits.",
    whatAiraDoesNext: "Every recovery proposal passes through the Policy Governor. If an action breaches contact quotas or cooldown windows, it is immediately BLOCKED or ESCALATED.",
    suggestedPrompts: [
      'Which RBI circulars are enforced?',
      'What are the TRAI contact cooldown limits?',
      'How are blocked actions audited?',
      'What is the Policy Override workflow?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Inspect Cryptographic Audit Ledger →', route: '/audit-trail' },
    ],
  },
  '/audit-trail': {
    name: 'Cryptographic Audit Ledger',
    route: '/audit-trail',
    badge: 'Audit Ledger',
    description: "Immutable, SHA-256 verifiable chronological record of every AI detection, policy evaluation, and recovery intervention.",
    whatsHappening: "AIRA records all system events with actor timestamps, rule evaluations, and cryptographic hashes.",
    why: "Financial audits require complete transparency and non-repudiation for every automated dollar recovered.",
    whatAiraDoesNext: "Provides proof of compliance for regulatory audits, internal risk reviews, and dispute resolution.",
    suggestedPrompts: [
      'How is the SHA-256 hash verified?',
      'Can audit records be modified or deleted?',
      'How do I filter audit events by actor?',
      'What events are recorded in the ledger?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'View Policy Governor →', route: '/policy-governor' },
    ],
  },
  '/recovery': {
    name: 'Unified Recovery Queue',
    route: '/recovery',
    badge: 'Recovery Queue',
    description: "Filterable operational ledger of all active recovery cases with multi-scenario search and batch autonomous execution.",
    whatsHappening: "You are looking at all open, in-progress, recovered, and escalated payment cases across every scenario type.",
    why: "Provides operators with real-time case triage, intervention history, and manual override capabilities when human intervention is required.",
    whatAiraDoesNext: "AIRA routes eligible cases through autonomous recovery pipelines, logs every execution to the ledger, and alerts teams if escalation is required.",
    suggestedPrompts: [
      'How are cases prioritized in the queue?',
      'What is the difference between Open and Escalated?',
      'How do batch recovery actions work?',
      'Explain this screen',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'View AI Command Center →', route: '/' },
    ],
  },
  '/evaluation': {
    name: 'Agent Evaluation Benchmark',
    route: '/evaluation',
    badge: 'Benchmark',
    description: "Deterministic benchmark evaluation testing AIRA's decision engine across 120 synthetic cases with seed=42.",
    whatsHappening: "AIRA is running an automated evaluation of recovery accuracy, policy adherence, and simulated revenue yield.",
    why: "Reproducible benchmarking proves system reliability and safety under extreme market conditions without endangering live customer funds.",
    whatAiraDoesNext: "Evaluates diagnosis accuracy, policy block rate, and recovery yield across 7 distinct failure scenarios.",
    suggestedPrompts: [
      'What is the evaluation benchmark score?',
      'Why is seed=42 used?',
      'What scenarios are tested?',
      'How is recovery yield calculated?',
    ],
    defaultActions: [
      { type: 'NAVIGATE', label: 'Open AI Command Center →', route: '/' },
    ],
  },
};

export function getDocForRoute(pathname: string): ModuleDoc {
  if (pathname === '/voice') return MODULE_DOCS['/voice-recovery'];
  if (pathname === '/promises') return MODULE_DOCS['/promise-tracker'];
  if (pathname === '/policy') return MODULE_DOCS['/policy-governor'];
  if (pathname === '/audit') return MODULE_DOCS['/audit-trail'];
  return MODULE_DOCS[pathname] || MODULE_DOCS['/'];
}
