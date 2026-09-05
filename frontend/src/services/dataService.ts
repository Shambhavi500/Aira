// Authoritative Shared Data Service Layer
// Single source of truth for all recovery cases, financial metrics, and operational mutations.
import {
  INITIAL_CASES,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_INVOICES,
  INITIAL_CHECKOUT_SESSIONS,
  INITIAL_MANDATE_SEQUENCES,
  INITIAL_VOICE_CALLS,
  INITIAL_PROMISES,
  INITIAL_POLICY_RULES,
  INITIAL_AUDIT_EVENTS,
} from '../data/seedData';
import type {
  RecoveryCase,
  SubscriptionItem,
  InvoiceItem,
  CheckoutSessionItem,
  MandateSequence,
  VoiceCallRecord,
  PromiseToPay,
  PolicyRule,
  AuditEvent,
  OverviewMetrics,
  ScenarioMetric,
  RootCauseMetric,
  PaymentHealthResponse,
  PaymentCorridor,
  PaymentIncident,
} from '../api/client';

type Listener = () => void;

class DataService {
  private cases: RecoveryCase[] = [...INITIAL_CASES];
  private subscriptions: SubscriptionItem[] = [...INITIAL_SUBSCRIPTIONS];
  private invoices: InvoiceItem[] = [...INITIAL_INVOICES];
  private checkoutSessions: CheckoutSessionItem[] = [...INITIAL_CHECKOUT_SESSIONS];
  private mandateSequences: MandateSequence[] = [...INITIAL_MANDATE_SEQUENCES];
  private voiceCalls: VoiceCallRecord[] = [...INITIAL_VOICE_CALLS];
  private promises: PromiseToPay[] = [...INITIAL_PROMISES];
  private policyRules: PolicyRule[] = [...INITIAL_POLICY_RULES];
  private auditEvents: AuditEvent[] = [...INITIAL_AUDIT_EVENTS];
  private listeners: Set<Listener> = new Set();

  private activeIncidents: PaymentIncident[] = [
    {
      id: 'inc_8901',
      corridor: 'HDFC_UPI',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      reason: 'HDFC UPI gateway latency spike (>1800ms) with 18.8% failure rate',
      detected_at: new Date(Date.now() - 42 * 60000).toISOString(),
      failover_corridor: 'ICICI_UPI',
    },
  ];

  private corridors: PaymentCorridor[] = [
    {
      corridor_id: 'c_hdfc_upi',
      name: 'HDFC UPI Switch',
      label: 'HDFC UPI Gateway',
      method: 'UPI',
      current_success_rate: 81.2,
      success_rate: 81.2,
      sla_baseline: 98.0,
      drop_pct: 16.8,
      volume_share_pct: 35.0,
      estimated_revenue_at_risk: 1250000,
      volume_24h: 38500000,
      status: 'DEGRADED',
      latency_ms: 1840,
    },
    {
      corridor_id: 'c_icici_upi',
      name: 'ICICI Instant UPI Rail',
      label: 'ICICI UPI Rail',
      method: 'UPI',
      current_success_rate: 98.4,
      success_rate: 98.4,
      sla_baseline: 98.0,
      drop_pct: 0,
      volume_share_pct: 25.0,
      estimated_revenue_at_risk: 0,
      volume_24h: 42000000,
      status: 'HEALTHY',
      latency_ms: 320,
    },
    {
      corridor_id: 'c_sbi_card',
      name: 'SBI Card Gateway',
      label: 'SBI Card Switch',
      method: 'CARD',
      current_success_rate: 94.6,
      success_rate: 94.6,
      sla_baseline: 96.0,
      drop_pct: 1.4,
      volume_share_pct: 20.0,
      estimated_revenue_at_risk: 280000,
      volume_24h: 18500000,
      status: 'HEALTHY',
      latency_ms: 450,
    },
    {
      corridor_id: 'c_axis_corp',
      name: 'Axis Corporate Netbanking',
      label: 'Axis Corp Netbanking',
      method: 'NETBANKING',
      current_success_rate: 93.8,
      success_rate: 93.8,
      sla_baseline: 95.0,
      drop_pct: 1.2,
      volume_share_pct: 20.0,
      estimated_revenue_at_risk: 420000,
      volume_24h: 24000000,
      status: 'HEALTHY',
      latency_ms: 610,
    },
  ];

  // --- Subscriptions and State Listening ---
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in listener:', err);
      }
    });
  }

  // --- Derived Overview Metrics ---
  getOverviewMetrics(): OverviewMetrics {
    const totalCases = this.cases.length;
    const activeCases = this.cases.filter((c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length;
    const recoveredCases = this.cases.filter((c) => c.status === 'RECOVERED').length;
    const escalatedCases = this.cases.filter((c) => c.status === 'ESCALATED').length;
    const blockedCases = this.cases.filter((c) => c.status === 'BLOCKED').length;

    const totalAtRisk = this.cases.reduce((sum, c) => sum + (c.amount_at_risk || 0), 0);
    const totalRecovered = this.cases.reduce((sum, c) => sum + (c.amount_recovered || 0), 0);
    const recoveryRate = totalAtRisk > 0 ? (totalRecovered / totalAtRisk) * 100 : 0;

    return {
      revenue_at_risk: totalAtRisk,
      revenue_recovered: totalRecovered,
      recovery_rate: Number(recoveryRate.toFixed(1)),
      active_cases: activeCases,
      blocked_actions: blockedCases,
      total_cases: totalCases,
      recovered_cases: recoveredCases,
      escalated_cases: escalatedCases,
      total_at_risk: totalAtRisk,
      total_recovered: totalRecovered,
    };
  }

  getScenarioMetrics(): ScenarioMetric[] {
    const map = new Map<string, { at_risk: number; recovered: number; count: number }>();
    this.cases.forEach((c) => {
      const prev = map.get(c.scenario_type) || { at_risk: 0, recovered: 0, count: 0 };
      prev.count += 1;
      prev.at_risk += c.amount_at_risk || 0;
      if (c.status === 'RECOVERED') {
        prev.recovered += c.amount_recovered || c.amount_at_risk || 0;
      }
      map.set(c.scenario_type, prev);
    });

    return Array.from(map.entries()).map(([scenario, data]) => ({
      scenario_type: scenario,
      case_count: data.count,
      scenario,
      count: data.count,
      amount_at_risk: data.at_risk,
      amount_recovered: data.recovered,
      recovery_rate: data.at_risk > 0 ? Number(((data.recovered / data.at_risk) * 100).toFixed(1)) : 0,
    }));
  }

  getRootCauseMetrics(): RootCauseMetric[] {
    const map = new Map<string, { count: number; volume: number }>();
    this.cases.forEach((c) => {
      const key = c.root_cause || 'UNKNOWN';
      const prev = map.get(key) || { count: 0, volume: 0 };
      prev.count += 1;
      prev.volume += c.amount_at_risk || 0;
      map.set(key, prev);
    });

    const totalCount = this.cases.length || 1;
    return Array.from(map.entries()).map(([root_cause, data]) => ({
      root_cause,
      case_count: data.count,
      amount_at_risk: data.volume,
      amount_recovered: 0,
      count: data.count,
      volume: data.volume,
      percentage: Number(((data.count / totalCount) * 100).toFixed(1)),
    }));
  }

  getPaymentHealth(): PaymentHealthResponse {
    const totalVolume = this.corridors.reduce((acc, c) => acc + (c.volume_24h || 1), 0);
    const weightedSuccess =
      totalVolume > 0
        ? this.corridors.reduce((acc, c) => acc + (c.current_success_rate || c.success_rate || 95) * (c.volume_24h || 1), 0) / totalVolume
        : 95.0;

    return {
      corridors: [...this.corridors],
      active_incidents: [...this.activeIncidents],
      overall_success_rate: Number(weightedSuccess.toFixed(1)),
      incident: this.activeIncidents[0] || null,
      current_metrics: {
        overall_success_rate: Number(weightedSuccess.toFixed(1)),
        upi_success_rate: 94.2,
        cards_success_rate: 91.5,
        netbanking_success_rate: 95.8,
        active_incidents: this.activeIncidents.length,
        revenue_at_risk: 1250000,
        revenue_recovered: 980000,
      },
      corridor_breakdown: this.corridors.map((c) => ({
        method: c.method,
        label: c.label || c.name || c.corridor_id || 'Corridor',
        status: c.status,
        current_success_rate: c.current_success_rate || c.success_rate || 95,
        sla_baseline: c.sla_baseline || 98.0,
        drop_pct: c.drop_pct || 0,
        volume_share_pct: c.volume_share_pct || 25.0,
        estimated_revenue_at_risk: c.estimated_revenue_at_risk || 0,
      })),
      timeseries: [],
    };
  }

  getReceivablesMetrics() {
    const overdueInvs = this.invoices.filter((i) => i.status === 'overdue');
    const totalOverdue = overdueInvs.reduce((sum, i) => sum + i.amount, 0);
    const buckets = {
      '0-30': this.invoices.filter((i) => i.days_overdue <= 30).reduce((sum, i) => sum + i.amount, 0),
      '31-60': this.invoices.filter((i) => i.days_overdue > 30 && i.days_overdue <= 60).reduce((sum, i) => sum + i.amount, 0),
      '61-90': this.invoices.filter((i) => i.days_overdue > 60 && i.days_overdue <= 90).reduce((sum, i) => sum + i.amount, 0),
      '90+': this.invoices.filter((i) => i.days_overdue > 90).reduce((sum, i) => sum + i.amount, 0),
    };
    return {
      total_overdue: totalOverdue,
      dso_days: 34,
      buckets,
    };
  }

  // --- Entity Accessors ---
  getCases(params?: { scenario?: string; status?: string; search?: string }) {
    let result = [...this.cases];
    if (params?.scenario) {
      result = result.filter((c) => c.scenario_type.toLowerCase() === params.scenario!.toLowerCase());
    }
    if (params?.status) {
      result = result.filter((c) => c.status.toLowerCase() === params.status!.toLowerCase());
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.customer_name?.toLowerCase().includes(q) ||
          c.failure_reason?.toLowerCase().includes(q)
      );
    }
    return {
      items: result,
      total: result.length,
      page: 1,
      page_size: result.length,
    };
  }

  getCaseById(id: string) {
    const found = this.cases.find((c) => c.id === id);
    if (!found) return null;
    return {
      ...found,
      customer: {
        id: found.customer_id,
        name: found.customer_name || 'Enterprise Client',
        email: found.customer_email || 'billing@enterprise.in',
        phone: found.customer_phone || '+919820123456',
        risk_segment: 'MEDIUM',
        language_preference: 'en',
        data_source: 'SYNTHETIC',
        created_at: found.created_at,
      },
      ai_recommendations: [
        {
          id: `ai_${found.id}`,
          case_id: found.id,
          recommended_action: found.latest_ai_recommendation || 'Autonomous Routing via Primary Fallback',
          confidence_score: 0.94,
          reasoning: 'Evaluated payment latency and card decline signals against historical settlement patterns.',
          channel: 'UPI / Secondary Switch',
          created_at: found.created_at,
        },
      ],
      policy_decisions: [
        {
          id: `pol_${found.id}`,
          case_id: found.id,
          decision: 'ALLOW',
          rule_applied: 'RBI Mandate Cooldown Guardrail (24h Window)',
          reason: 'Customer has not been contacted in the last 24h. Recovery action approved.',
          timestamp: found.created_at,
        },
      ],
      interventions: [
        {
          id: `inv_${found.id}`,
          case_id: found.id,
          action: 'DISPATCH_RECOVERY_LINK',
          channel: 'WhatsApp / SMS',
          requested_at: found.created_at,
          executed_at: found.created_at,
          result: found.status === 'RECOVERED' ? 'SUCCESS' : 'PENDING',
          amount_recovered: found.amount_recovered,
          notes: 'Autonomous 1-click Razorpay payment link dispatched.',
        },
      ],
      audit_events: this.auditEvents.filter((a) => a.case_id === found.id),
      promises: this.promises.filter((p) => p.case_id === found.id),
    };
  }

  getSubscriptions() {
    return [...this.subscriptions];
  }

  getInvoices() {
    return [...this.invoices];
  }

  getCheckoutSessions() {
    return [...this.checkoutSessions];
  }

  getMandateSequences() {
    return [...this.mandateSequences];
  }

  getVoiceCalls() {
    return [...this.voiceCalls];
  }

  getPromises() {
    return [...this.promises];
  }

  getPolicyRules() {
    return [...this.policyRules];
  }

  getAuditEvents() {
    return [...this.auditEvents];
  }

  // --- Mutation Actions ---
  executeCaseAction(caseId: string) {
    const c = this.cases.find((item) => item.id === caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    c.status = 'RECOVERED';
    c.amount_recovered = c.amount_at_risk;

    const audit: AuditEvent = {
      id: `aud_${Date.now()}`,
      event_type: 'AUTONOMOUS_RECOVERY',
      action: 'EXECUTED_RECOVERY_PIPELINE',
      actor: 'OPERATOR_DISPATCH',
      case_id: caseId,
      timestamp: new Date().toISOString(),
      reason: `Case executed manually or via AI copilot. Recovered ₹${c.amount_recovered}.`,
      metadata_json: JSON.stringify({ amount: c.amount_recovered, scenario: c.scenario_type }),
      created_at: new Date().toISOString(),
    };
    this.auditEvents.unshift(audit);
    this.notify();

    return {
      success: true,
      result: { case_id: caseId, status: 'RECOVERED', recovered: c.amount_recovered },
    };
  }

  bulkExecuteCases(caseIds: string[], action: string) {
    let processed = 0;
    let succeeded = 0;
    let totalRecovered = 0;
    const results: Array<{ case_id: string; status: string; recovered?: number }> = [];

    caseIds.forEach((id) => {
      const c = this.cases.find((item) => item.id === id);
      if (c) {
        processed += 1;
        succeeded += 1;
        c.status = 'RECOVERED';
        c.amount_recovered = c.amount_at_risk;
        totalRecovered += c.amount_recovered;
        results.push({ case_id: id, status: 'RECOVERED', recovered: c.amount_recovered });
      }
    });

    const audit: AuditEvent = {
      id: `aud_${Date.now()}`,
      event_type: 'BULK_EXECUTION',
      action: action || 'BATCH_AI_RECOVERY',
      actor: 'OPERATOR_DISPATCH',
      timestamp: new Date().toISOString(),
      reason: `Bulk execution performed across ${processed} cases. Recovered ₹${totalRecovered}.`,
      metadata_json: JSON.stringify({ processed, succeeded, total_recovered: totalRecovered }),
      created_at: new Date().toISOString(),
    };
    this.auditEvents.unshift(audit);
    this.notify();

    return {
      processed,
      succeeded,
      total_recovered: totalRecovered,
      results,
    };
  }

  escalateCase(caseId: string, reason?: string) {
    const c = this.cases.find((item) => item.id === caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    c.status = 'ESCALATED';
    const audit: AuditEvent = {
      id: `aud_${Date.now()}`,
      event_type: 'ESCALATION',
      action: 'CASE_ESCALATED_TO_OPERATOR',
      actor: 'OPERATOR_DISPATCH',
      case_id: caseId,
      timestamp: new Date().toISOString(),
      reason: reason || 'Escalated for senior billing team manual review.',
      metadata_json: JSON.stringify({ reason }),
      created_at: new Date().toISOString(),
    };
    this.auditEvents.unshift(audit);
    this.notify();

    return { success: true, case_id: caseId, status: 'ESCALATED' };
  }

  retrySubscription(subId: string) {
    const sub = this.subscriptions.find((s) => s.id === subId || s.subscription_id === subId);
    if (!sub) throw new Error(`Subscription ${subId} not found`);

    const currentCount = typeof sub.retry_count === 'number' ? sub.retry_count : parseInt(String(sub.retry_count).split('/')[0]) || 0;
    const maxRetries = sub.max_retries || 4;
    const nextCount = Math.min(maxRetries, currentCount + 1);
    sub.retry_count = `${nextCount}/${maxRetries}`;

    if (nextCount >= 2) {
      sub.status = 'active';
      sub.optimal_window = 'Recovered via Stage-2 Smart Retry';
      sub.next_retry_at = undefined;
    } else {
      sub.next_retry_at = new Date(Date.now() + 6 * 3600000).toISOString();
    }

    // Sync matching case
    const matchedCase = this.cases.find((c) => c.customer_name === sub.customer_name && c.scenario_type === 'FAILED_SUBSCRIPTION');
    if (matchedCase && sub.status === 'active') {
      matchedCase.status = 'RECOVERED';
      matchedCase.amount_recovered = matchedCase.amount_at_risk;
    }

    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'AUTONOMOUS_RECOVERY',
      action: 'SUBSCRIPTION_SMART_RETRY',
      actor: 'AIRA_SUBSCRIPTION_ENGINE',
      timestamp: new Date().toISOString(),
      reason: `Attempted retry #${nextCount} for ${sub.customer_name} (${sub.plan || sub.plan_name}). Result: ${sub.status.toUpperCase()}`,
      metadata_json: JSON.stringify({ subscription_id: sub.id, amount: sub.amount }),
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, subscription: sub };
  }

  scheduleSubscriptionCharge(subId: string, hours: number) {
    const sub = this.subscriptions.find((s) => s.id === subId || s.subscription_id === subId);
    if (!sub) throw new Error(`Subscription ${subId} not found`);

    sub.next_retry_at = new Date(Date.now() + hours * 3600000).toISOString();
    sub.optimal_window = `Optimized for +${hours}h (Salary / Treasury Inflow)`;
    this.notify();
    return { success: true, subscription: sub };
  }

  recoverCheckoutSession(sessionId: string) {
    const session = this.checkoutSessions.find((cs) => cs.id === sessionId);
    if (!session) throw new Error(`Checkout session ${sessionId} not found`);

    session.status = 'recovered';
    session.smart_link_sent = true;

    // Sync matching case
    const matchedCase = this.cases.find((c) => c.customer_name === session.customer_name && c.scenario_type === 'CHECKOUT_DROPOFF');
    if (matchedCase) {
      matchedCase.status = 'RECOVERED';
      matchedCase.amount_recovered = session.cart_value;
    }

    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'AUTONOMOUS_RECOVERY',
      action: 'CHECKOUT_CART_RECOVERED',
      actor: 'AIRA_CHECKOUT_RECOVERY',
      timestamp: new Date().toISOString(),
      reason: `Customer completed checkout via 1-click Razorpay Smart Link for ₹${session.cart_value}.`,
      metadata_json: JSON.stringify({ session_id: sessionId, value: session.cart_value }),
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, session };
  }

  sendCheckoutLink(sessionId: string) {
    const session = this.checkoutSessions.find((cs) => cs.id === sessionId);
    if (!session) throw new Error(`Checkout session ${sessionId} not found`);

    session.smart_link_sent = true;
    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'COMMUNICATION_DISPATCH',
      action: 'DISPATCH_SMART_LINK',
      actor: 'AIRA_CHECKOUT_RECOVERY',
      timestamp: new Date().toISOString(),
      reason: `Dispatched 1-click WhatsApp payment link with instant UPI QR to ${session.customer_phone}.`,
      metadata_json: JSON.stringify({ phone: session.customer_phone, cart_value: session.cart_value }),
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, message: `1-Click Razorpay Smart Link dispatched to ${session.customer_phone}` };
  }

  recordPromise(data: { customer_name: string; amount: number; promise_date: string; promise_source?: string; invoice_id?: string; notes?: string }) {
    const newPromise: PromiseToPay = {
      id: `ptp_${Date.now()}`,
      customer_id: `cust_${Math.random().toString(36).substring(2, 8)}`,
      customer_name: data.customer_name,
      invoice_id: data.invoice_id || 'inv_custom',
      amount: data.amount,
      currency: 'INR',
      promise_date: data.promise_date,
      promise_source: (data.promise_source as any) || 'manual',
      status: 'pending',
      confidence_score: 0.9,
      follow_up_count: 0,
      notes: data.notes || 'Recorded via AIRA Promise-to-Pay Manager',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.promises.unshift(newPromise);

    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'COMMITMENT_RECORDED',
      action: 'RECORDED_PROMISE_TO_PAY',
      actor: 'OPERATOR_DISPATCH',
      timestamp: new Date().toISOString(),
      reason: `Promise to pay recorded for ${data.customer_name} (₹${data.amount}) due ${data.promise_date}.`,
      metadata_json: JSON.stringify(newPromise),
      created_at: new Date().toISOString(),
    });

    this.notify();
    return newPromise;
  }

  updatePromiseStatus(promiseId: string, status: 'kept' | 'broken' | 'pending') {
    const p = this.promises.find((item) => item.id === promiseId);
    if (!p) throw new Error(`Promise ${promiseId} not found`);

    p.status = status;
    if (status === 'kept') {
      const inv = this.invoices.find((i) => i.id === p.invoice_id || i.customer_name === p.customer_name);
      if (inv) {
        inv.status = 'paid';
      }
      const c = this.cases.find((cs) => cs.customer_name === p.customer_name && cs.scenario_type === 'PROMISE_TRACKER');
      if (c) {
        c.status = 'RECOVERED';
        c.amount_recovered = p.amount;
      }
    }

    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'COMMITMENT_UPDATED',
      action: `PROMISE_${status.toUpperCase()}`,
      actor: 'OPERATOR_DISPATCH',
      timestamp: new Date().toISOString(),
      reason: `Promise status updated to ${status.toUpperCase()} for ${p.customer_name} (₹${p.amount}).`,
      metadata_json: JSON.stringify({ promise_id: promiseId, status }),
      created_at: new Date().toISOString(),
    });

    this.notify();
    return p;
  }

  toggleMandateStatus(sequenceId: string) {
    const seq = this.mandateSequences.find((s) => s.id === sequenceId);
    if (!seq) throw new Error(`Sequence ${sequenceId} not found`);

    seq.status = seq.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.notify();
    return seq;
  }

  retryMandateStep(mandateRef: string) {
    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'MANDATE_EXECUTION',
      action: 'RETRY_MANDATE_STEP',
      actor: 'AIRA_MANDATE_SEQUENCER',
      timestamp: new Date().toISOString(),
      reason: `Dispatched mandate execution retry for ${mandateRef} via secondary clearing rail.`,
      metadata_json: JSON.stringify({ ref: mandateRef }),
      created_at: new Date().toISOString(),
    });
    this.notify();
    return { success: true, message: `Mandate retry queued for ${mandateRef}` };
  }

  simulateCorridorFailover(corridorKey = 'HDFC_UPI') {
    const hdfc = this.corridors.find((c) => c.corridor_id === 'c_hdfc_upi');
    const icici = this.corridors.find((c) => c.corridor_id === 'c_icici_upi');

    if (hdfc && icici) {
      hdfc.status = 'DEGRADED';
      hdfc.current_success_rate = 81.2;
      hdfc.success_rate = 81.2;
    }

    this.activeIncidents = [
      {
        id: `inc_${Date.now()}`,
        corridor: corridorKey,
        severity: 'CRITICAL',
        status: 'ACTIVE',
        reason: 'HDFC UPI gateway latency spike (>1800ms). Autonomous failover triggered.',
        detected_at: new Date().toISOString(),
        failover_corridor: 'ICICI_UPI',
      },
    ];

    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'AUTONOMOUS_FAILOVER',
      action: 'ROUTING_FAILOVER_TRIGGERED',
      actor: 'AIRA_AI_ROUTER',
      timestamp: new Date().toISOString(),
      reason: `Automated failover executed. Rerouted UPI intent volume from degraded HDFC switch to ICICI rail.`,
      metadata_json: JSON.stringify({ source: 'HDFC_UPI', target: 'ICICI_UPI' }),
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, message: 'Corridor failover simulation active: Traffic shifted to ICICI.' };
  }

  executeIncidentRecovery(incidentId = 'inc_upi_route_01') {
    const hdfc = this.corridors.find((c) => c.corridor_id === 'c_hdfc_upi');
    if (hdfc) {
      hdfc.status = 'HEALTHY';
      hdfc.current_success_rate = 96.4;
      hdfc.success_rate = 96.4;
      hdfc.latency_ms = 480;
    }
    if (this.activeIncidents.length > 0) {
      this.activeIncidents[0].status = 'RECOVERED';
    }
    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'AUTONOMOUS_FAILOVER_COMPLETED',
      action: 'FAILOVER_RECOVERY_SUCCESS',
      actor: 'AIRA_AUTONOMOUS_ENGINE',
      timestamp: new Date().toISOString(),
      reason: 'Rerouted 100% of affected UPI volume to secondary ICICI rail. Anomaly stabilized.',
      metadata_json: JSON.stringify({ incident_id: incidentId, recovered: 420000 }),
      created_at: new Date().toISOString(),
    });
    this.notify();
    return {
      success: true,
      status: 'RECOVERED',
      incident_id: incidentId,
      cases_processed: 38,
      cases_recovered: 32,
      cases_escalated: 6,
      amount_recovered: 420000,
      message: 'Aira autonomous recovery executed successfully: 32 cases recovered, 6 escalated to VIP desk.',
    };
  }

  resetCorridorHealth() {
    this.activeIncidents = [];
    const hdfc = this.corridors.find((c) => c.corridor_id === 'c_hdfc_upi');
    if (hdfc) {
      hdfc.status = 'HEALTHY';
      hdfc.current_success_rate = 96.4;
      hdfc.success_rate = 96.4;
      hdfc.latency_ms = 520;
    }

    this.auditEvents.unshift({
      id: `aud_${Date.now()}`,
      event_type: 'CORRIDOR_RESET',
      action: 'ROUTING_NORMALIZED',
      actor: 'OPERATOR_DISPATCH',
      timestamp: new Date().toISOString(),
      reason: `Payment corridor health normalized. All gateway switches operational.`,
      metadata_json: JSON.stringify({ status: 'HEALTHY' }),
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, message: 'Corridor telemetry restored to healthy state.' };
  }
}

export const dataService = new DataService();
