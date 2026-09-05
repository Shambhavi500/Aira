# AIRA Revenue Recovery OS — Data Architecture Specification

## 1. Executive Summary & Design Principles

AIRA is a mission-critical Autonomous Revenue Recovery Operating System designed specifically for the Indian fintech ecosystem. To ensure operational trust, compliance with Reserve Bank of India (RBI) mandates, and financial accuracy, the data architecture adheres to five core principles:

1. **Single Source of Truth**: Financial state is never fragmented across isolated component states. All recovery actions update an authoritative state layer (`dataService.ts` in client mode, SQLite/PostgreSQL in backend mode) which recomputes metrics deterministically and broadcasts updates.
2. **Strict Financial Value Semantics**: Zero is a legitimate numerical result (e.g., zero failed mandates, ₹0 recovered). It must never be conflated with `null` or `undefined` (which represent missing data, uncomputed metrics, or loading states).
3. **Indian Financial Formatting Standards**: All monetary representations adhere to the Indian numbering system (thousands, lakhs, crores) formatted via `formatINR()`.
4. **Dual-Mode Operational Resilience**: The frontend functions seamlessly with a live backend API or autonomously via a stateful in-memory service (`dataService.ts`) with zero loss of interactive fidelity.
5. **Cryptographic Tamper-Evident Auditability**: Every automated decision, human intervention, and corridor failover appends an immutable audit event with a SHA-256 tamper hash.

---

## 2. Core Entities & Data Models

### 2.1 Recovery Case (`RecoveryCase`)
The central unit of revenue recovery representing a failed transaction, unpaid invoice, or abandoned cart.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique case identifier (e.g., `case_rec_101`) |
| `customer_id` | `string` | Foreign key referencing the customer |
| `customer_name` | `string` | Display name of the customer or business |
| `scenario_type` | `string` | Scenario category: `SUBSCRIPTION_DUNNING`, `INVOICE_CHASING`, `CHECKOUT_DROPOFF`, `MANDATE_RETRY` |
| `amount_at_risk` | `number` | Exact monetary volume in INR subject to loss |
| `amount_recovered`| `number` | Recovered volume in INR (0 initially, updated on resolution) |
| `status` | `string` | State machine: `OPEN` \| `IN_PROGRESS` \| `RECOVERED` \| `ESCALATED` \| `FAILED` |
| `priority` | `string` | Priority level: `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` |
| `failure_code` | `string` | Standardized rail error code (e.g., `GATEWAY_TIMEOUT`, `MANDATE_LIMIT_EXCEEDED`) |
| `failure_reason` | `string` | Human-readable explanation of the underlying failure |
| `created_at` | `string` | ISO 8601 creation timestamp |
| `updated_at` | `string` | ISO 8601 modification timestamp |

### 2.2 Payment Corridor & Incident (`PaymentCorridor`, `PaymentIncident`)
Tracks real-time telemetry across Indian payment corridors (UPI, Cards, Netbanking, e-NACH).

- **Corridors Tracked**:
  - `HDFC_UPI`, `ICICI_UPI`, `SBI_UPI`, `AXIS_UPI`
  - `RAZORPAY_CARDS_VISA_MC`, `RAZORPAY_CARDS_RUPAY`
  - `HDFC_NETBANKING`, `ICICI_NETBANKING`, `SBI_NETBANKING`
  - `ENACH_NPCI_BATCH`
- **Telemetry Metrics**: `success_rate` (%), `latency_ms`, `error_rate` (%), `status` (`HEALTHY`, `DEGRADED`, `DOWN`).
- **Autonomous Incident Lifecycle**:
  When a corridor's error rate exceeds 15% or latency exceeds 2,500ms, AIRA generates an active `PaymentIncident`. Routing rules reroute traffic to healthy corridors until operator resolution or automated recovery.

### 2.3 Subscription Item (`SubscriptionItem`)
Represents recurring SaaS/utility subscriptions undergoing automated dunning cycles.

- **Attributes**: `subscription_id`, `plan_name`, `amount`, `currency`, `status` (`active`, `halted`, `failing`), `retry_count`, `max_retries`, `next_retry_at`, `optimal_window`, `failure_reason`.
- **Smart Retries**: Retries are scheduled during optimal salary credit and banking liquidity windows (post-salary dates, 10:00 AM – 2:00 PM).

### 2.4 Receivables & Invoices (`InvoiceItem`)
Manages B2B accounts receivable and collections workflows.

- **Attributes**: `invoice_number`, `company_name`, `amount`, `due_date`, `days_overdue`, `aging_bucket` (`0-30`, `31-60`, `61-90`, `90+`), `status` (`pending`, `overdue`, `paid`), `reminders_sent`, `recovery_probability`.
- **Calculated Metric (DSO - Days Sales Outstanding)**:
  $$\text{DSO} = \frac{\sum (\text{Overdue Days} \times \text{Amount})}{\sum \text{Amount}}$$

### 2.5 Checkout Dropoffs (`CheckoutSessionItem`)
Monitors abandoned high-intent checkout sessions.

- **Attributes**: `cart_value`, `items_summary`, `dropoff_step` (`PAYMENT_METHOD`, `UPI_INTENT`, `OTP_SCREEN`), `payment_method`, `status` (`abandoned`, `recovered`, `expired`), `smart_link_sent`.
- **Intervention**: Dispatches 1-click Razorpay payment links via WhatsApp and SMS.

### 2.6 Promise-to-Pay Tracker (`PromiseToPay`)
Captures verbal and digital commitments made by customers to settle debt.

- **Attributes**: `amount`, `promise_date`, `status` (`pending`, `kept`, `broken`), `source` (`voice`, `whatsapp`, `email`, `portal`), `notes`.
- **Lifecycle Sync**: When a promise is marked `kept`, the corresponding invoice is marked `paid` and associated recovery case is marked `RECOVERED`.

### 2.7 Mandate Sequencing (`MandateSequence`, `MandateStep`)
Governs multi-step retry sequences under NPCI and RBI e-mandate rules.

- **Attributes**: `name`, `mandate_type` (`RECURRING_UPI`, `ENACH`, `SI_CARD`), `steps` (array of actions with cooldown delays, e.g., Pre-Debit WhatsApp Nudge $\rightarrow$ Primary Rail Retry $\rightarrow$ Fallback Netbanking).

### 2.8 Tamper-Evident Audit Trail (`AuditEvent`)
Immutable ledger of all state-altering operations.

- **Attributes**: `id`, `event_type`, `action`, `actor` (`AIRA_AI_ROUTER`, `POLICY_GOVERNOR`, `HUMAN_OPERATOR`), `case_id`, `reason`, `metadata_json`, `tamper_hash`, `timestamp`.

---

## 3. Financial Metrics & Mathematical Formulas

AIRA enforces strict numerical derivation across all operational dashboards:

### 3.1 Total Revenue at Risk
$$\text{Revenue at Risk} = \sum_{c \in \text{Cases}, c.\text{status} \in \{\text{OPEN}, \text{IN\_PROGRESS}\}} c.\text{amount\_at\_risk}$$

### 3.2 Total Revenue Recovered
$$\text{Revenue Recovered} = \sum_{c \in \text{Cases}} c.\text{amount\_recovered}$$

### 3.3 Recovery Rate
$$\text{Recovery Rate} = \frac{\text{Revenue Recovered}}{\text{Revenue Recovered} + \text{Revenue at Risk}} \times 100\%$$
*(If total volume is 0, recovery rate is strictly 0.0%)*

### 3.4 Days Sales Outstanding (DSO)
$$\text{DSO} = \frac{\text{Total Accounts Receivable}}{\text{Total Credit Sales}} \times \text{Days in Period}$$
*(Implemented in `dataService.getReceivablesMetrics()` using overdue volume weighting).*

---

## 4. Value Display & Zero-Data Compliance

To prevent misleading UI states and conform to professional banking standards, all values are routed through `frontend/src/utils/formatters.ts`:

| Raw Input Value | Formatter Used | Rendered Output | Rule Explanation |
| :--- | :--- | :--- | :--- |
| `1250000` | `formatINR(val)` | `₹12,50,000` | Standard Indian comma placement (3, 2, 2 grouping) |
| `12500000` | `formatINR(val, { compact: true })` | `₹1.25Cr` | Crores compact notation for high-volume KPIs |
| `450000` | `formatINR(val, { compact: true })` | `₹4.5L` | Lakhs compact notation |
| `0` | `formatINR(0)` | `₹0` | **Real Zero**: Confirmed calculation resulting in zero volume |
| `null` | `formatINR(null)` | `—` | **Missing Data**: No value supplied |
| `undefined`| `formatINR(undefined)` | `—` | **Unloaded State**: Asynchronous data pending |
| `NaN` | `formatINR(NaN)` | `—` | **Calculation Error**: Guard against JavaScript runtime errors |
| `0` | `formatPercent(0)` | `0.0%` | **Real Zero Rate**: Confirmed zero rate |
| `null` | `formatPercent(null)`| `—` | **Missing Rate**: Em-dash displayed |

---

## 5. Dual-Mode Resilience & Reactive State Sync

```
+-------------------------------------------------------------+
|                     AIRA React Frontend                     |
|                                                             |
|  +------------------------+      +-----------------------+  |
|  |     AiraStateContext   | <--- |   dataService (Bus)   |  |
|  +------------------------+      +-----------------------+  |
|              |                               ^               |
|              v                               |               |
|  +------------------------+                  | (Sync / Evt)  |
|  |       apiClient        | -----------------+               |
+-------------------------------------------------------------+
           |                             |
      (HTTP Fetch)               (Fallback Intercept)
           |                             |
           v                             v
+---------------------+        +--------------------+
|  FastAPI Backend    |        | In-Memory Database |
|  SQLite / PostgreSQL|        | Deterministic Seed |
+---------------------+        +--------------------+
```

1. **Primary Route**: Requests execute via `fetch()` against `http://localhost:8000`.
2. **Transparent Fallback**: If the backend is offline or an endpoint fails with a network error, `apiFetch()` intercepts the error and routes the operation to `dataService.ts`.
3. **Reactive Bus**: Any mutation in `dataService.ts` automatically updates dependent entities (e.g., executing a checkout recovery updates the checkout session, resolves the associated case, and logs an audit event), recalculates top-level metrics, and notifies all subscribing React components.
