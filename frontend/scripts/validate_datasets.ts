/**
 * Dataset Validation Suite for AIRA Frontend Seed Dataset
 * ────────────────────────────────────────────────────────
 * Validates the authoritative deterministic in-memory seed dataset in `src/data/seedData.ts`.
 * Ensures data integrity, financial non-negativity, valid enum statuses,
 * unique primary keys, and referential integrity across entities.
 */

import {
  INITIAL_CUSTOMERS,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_INVOICES,
  INITIAL_CHECKOUT_SESSIONS,
  INITIAL_PROMISES,
  INITIAL_CASES,
  INITIAL_MANDATE_SEQUENCES,
  INITIAL_VOICE_CALLS,
  INITIAL_POLICY_RULES,
  INITIAL_AUDIT_EVENTS,
} from '../src/data/seedData';

const errors: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    errors.push(message);
  }
}

function checkUniqueIds<T extends { id: string }>(items: T[], entityName: string) {
  const ids = new Set<string>();
  for (const item of items) {
    assert(!!item.id, `${entityName} has empty or missing id`);
    assert(!ids.has(item.id), `Duplicate id '${item.id}' found in ${entityName}`);
    ids.add(item.id);
  }
}

console.log('[CHECK] Validating AIRA Frontend Seed Dataset (seedData.ts)...');

// 1. Customers
assert(INITIAL_CUSTOMERS.length > 0, 'INITIAL_CUSTOMERS must not be empty');
checkUniqueIds(INITIAL_CUSTOMERS, 'Customer');
const customerIdSet = new Set(INITIAL_CUSTOMERS.map((c) => c.id));

for (const cust of INITIAL_CUSTOMERS) {
  assert(!!cust.name, `Customer ${cust.id} must have a name`);
  assert(cust.email.includes('@'), `Customer ${cust.id} has invalid email: ${cust.email}`);
  assert(cust.phone.startsWith('+91'), `Customer ${cust.id} phone must use +91 Indian format: ${cust.phone}`);
  assert(
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(cust.risk_segment),
    `Customer ${cust.id} has invalid risk_segment: ${cust.risk_segment}`
  );
}

// 2. Subscriptions
assert(INITIAL_SUBSCRIPTIONS.length > 0, 'INITIAL_SUBSCRIPTIONS must not be empty');
checkUniqueIds(INITIAL_SUBSCRIPTIONS, 'Subscription');
for (const sub of INITIAL_SUBSCRIPTIONS) {
  assert(customerIdSet.has(sub.customer_id), `Subscription ${sub.id} references missing customer ${sub.customer_id}`);
  assert(sub.amount >= 0, `Subscription ${sub.id} has negative amount: ${sub.amount}`);
  assert(
    ['active', 'halted', 'failing', 'paused'].includes(sub.status),
    `Subscription ${sub.id} has invalid status: ${sub.status}`
  );
  assert(sub.retry_count <= sub.max_retries, `Subscription ${sub.id} retry_count exceeds max_retries`);
}

// 3. Invoices
assert(INITIAL_INVOICES.length > 0, 'INITIAL_INVOICES must not be empty');
checkUniqueIds(INITIAL_INVOICES, 'Invoice');
for (const inv of INITIAL_INVOICES) {
  assert(customerIdSet.has(inv.customer_id), `Invoice ${inv.id} references missing customer ${inv.customer_id}`);
  assert(inv.amount >= 0, `Invoice ${inv.id} has negative amount: ${inv.amount}`);
  assert(inv.days_overdue >= 0, `Invoice ${inv.id} has negative days_overdue: ${inv.days_overdue}`);
  assert(
    ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'].includes(inv.aging_bucket),
    `Invoice ${inv.id} has invalid aging_bucket: ${inv.aging_bucket}`
  );
  assert(
    ['pending', 'overdue', 'paid'].includes(inv.status),
    `Invoice ${inv.id} has invalid status: ${inv.status}`
  );
}

// 4. Checkout Sessions
assert(INITIAL_CHECKOUT_SESSIONS.length > 0, 'INITIAL_CHECKOUT_SESSIONS must not be empty');
checkUniqueIds(INITIAL_CHECKOUT_SESSIONS, 'CheckoutSession');
for (const chk of INITIAL_CHECKOUT_SESSIONS) {
  if (chk.customer_id) {
    assert(customerIdSet.has(chk.customer_id), `Checkout ${chk.id} references missing customer ${chk.customer_id}`);
  }
  assert(chk.cart_value >= 0, `Checkout ${chk.id} has negative cart_value: ${chk.cart_value}`);
  assert(
    ['abandoned', 'recovered', 'expired', 'escalated'].includes(chk.status),
    `Checkout ${chk.id} has invalid status: ${chk.status}`
  );
}

// 5. Promises to Pay
assert(INITIAL_PROMISES.length > 0, 'INITIAL_PROMISES must not be empty');
checkUniqueIds(INITIAL_PROMISES, 'PromiseToPay');
for (const p of INITIAL_PROMISES) {
  assert(customerIdSet.has(p.customer_id), `Promise ${p.id} references missing customer ${p.customer_id}`);
  assert(p.amount >= 0, `Promise ${p.id} has negative amount: ${p.amount}`);
  assert(
    ['pending', 'kept', 'broken'].includes(p.status),
    `Promise ${p.id} has invalid status: ${p.status}`
  );
}

// 6. Recovery Cases
assert(INITIAL_CASES.length > 0, 'INITIAL_CASES must not be empty');
checkUniqueIds(INITIAL_CASES, 'RecoveryCase');
for (const c of INITIAL_CASES) {
  assert(customerIdSet.has(c.customer_id), `Case ${c.id} references missing customer ${c.customer_id}`);
  assert(c.amount_at_risk >= 0, `Case ${c.id} has negative amount_at_risk: ${c.amount_at_risk}`);
  assert(c.amount_recovered >= 0, `Case ${c.id} has negative amount_recovered: ${c.amount_recovered}`);
  assert(
    ['OPEN', 'IN_PROGRESS', 'RECOVERED', 'ESCALATED', 'FAILED'].includes(c.status),
    `Case ${c.id} has invalid status: ${c.status}`
  );
  assert(
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(c.priority),
    `Case ${c.id} has invalid priority: ${c.priority}`
  );
}

// 7. Mandate Sequences
assert(INITIAL_MANDATE_SEQUENCES.length > 0, 'INITIAL_MANDATE_SEQUENCES must not be empty');
checkUniqueIds(INITIAL_MANDATE_SEQUENCES, 'MandateSequence');
for (const seq of INITIAL_MANDATE_SEQUENCES) {
  assert(seq.steps.length > 0, `Mandate sequence ${seq.id} must have at least one step`);
}

// 8. Voice Calls
assert(INITIAL_VOICE_CALLS.length > 0, 'INITIAL_VOICE_CALLS must not be empty');
checkUniqueIds(INITIAL_VOICE_CALLS, 'VoiceCallRecord');
for (const call of INITIAL_VOICE_CALLS) {
  assert(customerIdSet.has(call.customer_id), `Voice call ${call.id} references missing customer ${call.customer_id}`);
  assert(call.duration_seconds >= 0, `Voice call ${call.id} has negative duration`);
}

// 9. Policy Rules
assert(INITIAL_POLICY_RULES.length > 0, 'INITIAL_POLICY_RULES must not be empty');
checkUniqueIds(INITIAL_POLICY_RULES, 'PolicyRule');
for (const rule of INITIAL_POLICY_RULES) {
  assert(!!rule.rule_key, `Policy rule ${rule.id} missing rule_key`);
  assert(rule.status === 'ACTIVE' || rule.status === 'PAUSED', `Rule ${rule.id} has invalid status`);
}

// 10. Audit Events
assert(INITIAL_AUDIT_EVENTS.length > 0, 'INITIAL_AUDIT_EVENTS must not be empty');
checkUniqueIds(INITIAL_AUDIT_EVENTS, 'AuditEvent');
for (const aud of INITIAL_AUDIT_EVENTS) {
  assert(!!aud.action, `Audit event ${aud.id} missing action`);
  assert(!!aud.actor, `Audit event ${aud.id} missing actor`);
  assert(!!aud.timestamp, `Audit event ${aud.id} missing timestamp`);
  assert(
    typeof aud.tamper_hash === 'string' && aud.tamper_hash.length === 64,
    `Audit event ${aud.id} tamper_hash must be a 64-char SHA-256 string`
  );
}

if (errors.length > 0) {
  console.error(`[FAIL] Frontend Seed Dataset Validation failed with ${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`   • ${err}`);
  }
  process.exit(1);
} else {
  console.log('[PASS] Frontend Seed Dataset Validation Passed:');
  console.log(`   • ${INITIAL_CUSTOMERS.length} Customers (all IDs unique, phone and email verified)`);
  console.log(`   • ${INITIAL_SUBSCRIPTIONS.length} Subscriptions`);
  console.log(`   • ${INITIAL_INVOICES.length} Invoices`);
  console.log(`   • ${INITIAL_CHECKOUT_SESSIONS.length} Checkout Sessions`);
  console.log(`   • ${INITIAL_PROMISES.length} Promises to Pay`);
  console.log(`   • ${INITIAL_CASES.length} Recovery Cases`);
  console.log(`   • ${INITIAL_MANDATE_SEQUENCES.length} Mandate Sequences`);
  console.log(`   • ${INITIAL_VOICE_CALLS.length} Voice Calls`);
  console.log(`   • ${INITIAL_POLICY_RULES.length} Policy Rules`);
  console.log(`   • ${INITIAL_AUDIT_EVENTS.length} Audit Events with SHA-256 tamper hashes`);
  process.exit(0);
}
