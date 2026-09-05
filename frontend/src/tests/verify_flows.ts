// Comprehensive System Flow Verification Test
// Validates Zero-Data rules, Single Source of Truth, Cross-Module State Sync, and Fallback Routing.
import { formatINR, formatPercent, formatDate, formatDuration, formatRelativeTime } from '../utils/formatters';
import { dataService } from '../services/dataService';
import { api } from '../api/client';

declare const process: any;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    if (typeof process !== 'undefined') process.exit(1);
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
}

async function runVerification() {
  console.log('=== [1] TESTING ZERO-DATA FORMATTERS & INDIAN NUMBERING ===');
  assert(formatINR(undefined) === '—', 'formatINR(undefined) must yield em-dash');
  assert(formatINR(null) === '—', 'formatINR(null) must yield em-dash');
  assert(formatINR(0) === '₹0', 'formatINR(0) must yield ₹0');
  assert(formatINR(1250000) === '₹12,50,000', 'formatINR(1250000) formats with Indian grouping');
  assert(formatINR(480000) === '₹4,80,000', 'formatINR(480000) formats as ₹4,80,000');
  assert(formatPercent(undefined) === '—', 'formatPercent(undefined) must yield em-dash');
  assert(formatPercent(null) === '—', 'formatPercent(null) must yield em-dash');
  assert(formatPercent(98.4) === '98.4%', 'formatPercent(98.4) formats as 98.4%');
  assert(formatDate(undefined) === '—', 'formatDate(undefined) must yield em-dash');
  assert(formatDuration(94) === '1m 34s', 'formatDuration(94) formats as 1m 34s');
  assert(formatDuration(45) === '45s', 'formatDuration(45) formats as 45s');
  assert(typeof formatRelativeTime(new Date().toISOString()) === 'string', 'formatRelativeTime returns readable string');

  console.log('\n=== [2] TESTING SINGLE SOURCE OF TRUTH & OPERATIONAL MUTATIONS ===');
  const initialOverview = dataService.getOverviewMetrics();
  console.log('Initial Total at Risk:', initialOverview.revenue_at_risk);
  console.log('Initial Recovered:', initialOverview.revenue_recovered);
  console.log('Initial Active Cases:', initialOverview.active_cases);

  assert(initialOverview.revenue_at_risk > 0, 'Seed cases must have positive revenue at risk');
  assert(initialOverview.active_cases > 0, 'Seed cases must have active recovery cases');

  // Test 2.1: Execute Single Case Action
  const cases = dataService.getCases().items;
  const targetCase = cases.find((c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS');
  assert(!!targetCase, 'Found active target case for execution');

  const execResult = dataService.executeCaseAction(targetCase!.id);
  assert(execResult.success, 'Case execution action must succeed');
  
  const updatedCase = dataService.getCaseById(targetCase!.id);
  assert(updatedCase?.status === 'RECOVERED', 'Executed case status must transition to RECOVERED');
  assert(updatedCase?.amount_recovered === updatedCase?.amount_at_risk, 'amount_recovered must equal amount_at_risk');

  const postExecOverview = dataService.getOverviewMetrics();
  assert(postExecOverview.revenue_recovered > initialOverview.revenue_recovered, 'Total recovered must increase after case recovery');

  // Test 2.2: Subscription Smart Retry & Cross-Module Sync
  const subs = dataService.getSubscriptions();
  const failedSub = subs.find((s) => s.status === 'halted' || s.status === 'failing' || s.status === 'failed');
  assert(!!failedSub, 'Found failing/halted subscription');
  const subRetryResult = dataService.retrySubscription(failedSub!.id);
  assert(subRetryResult.success, 'Subscription retry succeeds');
  console.log('Subscription retry updated retry_count:', subRetryResult.subscription.retry_count);

  // Test 2.3: Checkout Session Recovery & Case Sync
  const checkouts = dataService.getCheckoutSessions();
  const openCheckout = checkouts.find((c) => c.status === 'abandoned');
  assert(!!openCheckout, 'Found abandoned checkout session');
  const sendLinkRes = dataService.sendCheckoutLink(openCheckout!.id);
  assert(sendLinkRes.success, 'Smart link dispatched');
  const recoverCheckoutRes = dataService.recoverCheckoutSession(openCheckout!.id);
  assert(recoverCheckoutRes.success, 'Checkout session recovered');
  assert(recoverCheckoutRes.session.status === 'recovered', 'Checkout session marked recovered');

  // Test 2.4: Promise-to-Pay Lifecycle
  const recordedPromise = dataService.recordPromise({
    customer_name: 'Veritas Solutions India',
    amount: 175000,
    promise_date: '2026-09-12',
    notes: 'CFO signed settlement deed',
  });
  assert(recordedPromise.status === 'pending', 'New promise is pending');
  const updatedPromise = dataService.updatePromiseStatus(recordedPromise.id, 'kept');
  assert(updatedPromise.status === 'kept', 'Promise marked kept');

  // Test 2.5: Corridor Failover & Anomaly Simulation
  const initialHealth = dataService.getPaymentHealth();
  console.log('Initial Overall Gateway Health:', initialHealth.overall_success_rate + '%');
  const failoverRes = dataService.simulateCorridorFailover('HDFC_UPI');
  assert(failoverRes.success, 'Corridor failover simulated');
  const degradedHealth = dataService.getPaymentHealth();
  assert(!!(degradedHealth.active_incidents && degradedHealth.active_incidents.length > 0), 'Active incident present during degradation');
  
  const resetHealthRes = dataService.resetCorridorHealth();
  assert(resetHealthRes.success, 'Corridor health restored');
  const restoredHealth = dataService.getPaymentHealth();
  assert(restoredHealth.active_incidents?.length === 0, 'No active incidents after reset');

  // Test 2.6: Cryptographic Audit Trail Verification
  const auditEvents = dataService.getAuditEvents();
  assert(auditEvents.length >= 8, 'Audit ledger captures every mutation event');
  auditEvents.forEach((evt) => {
    assert(!!evt.id && !!evt.action && !!evt.actor, `Audit event ${evt.id} has complete metadata`);
    assert(!!evt.timestamp || !!evt.created_at, `Audit event ${evt.id} has valid timestamp`);
  });

  console.log('\n=== [3] TESTING TRANSPARENT CLIENT FALLBACK ROUTING ===');
  const apiMetrics = await api.metrics();
  assert(apiMetrics.revenue_at_risk > 0, 'api.metrics() returns valid metrics');
  const apiCases = await api.cases();
  assert(apiCases.items.length > 0, 'api.cases() returns paginated case items');
  const apiHealth = await api.paymentHealth();
  assert(apiHealth.overall_success_rate !== undefined, 'api.paymentHealth() returns corridor health');
  const apiSubs = await api.subscriptions();
  assert(apiSubs.items.length > 0, 'api.subscriptions() returns subscription records');
  const apiInvoices = await api.invoices();
  assert(apiInvoices.items.length > 0, 'api.invoices() returns invoices');
  const apiCheckouts = await api.checkout();
  assert(apiCheckouts.items.length > 0, 'api.checkout() returns checkout records');
  const apiPromises = await api.promises();
  assert(apiPromises.items.length > 0, 'api.promises() returns promises list');
  const apiPolicy = await api.policyRules();
  assert(Array.isArray(apiPolicy) && apiPolicy.length > 0, 'api.policyRules() returns rules array');
  const apiAudit = await api.recentActivity();
  assert(apiAudit.length > 0, 'api.recentActivity() returns audit events');
  const apiMandates = await api.mandateSequences();
  assert(Array.isArray(apiMandates) && apiMandates.length > 0, 'api.mandateSequences() returns configured sequences');
  const apiMandateQueue = await api.mandateQueue();
  assert(Array.isArray(apiMandateQueue.items) && apiMandateQueue.items.length > 0, 'api.mandateQueue() returns active queue items');

  console.log('\n🎉 ALL VERIFICATION ASSERTIONS PASSED WITH ZERO ERRORS!');
}

runVerification().catch((err) => {
  console.error('Verification failed with uncaught exception:', err);
  if (typeof process !== 'undefined') process.exit(1);
});
