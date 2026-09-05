<p align="center">
  <img src="frontend/public/aira-logo-full.png" alt="AIRA Revenue Recovery OS" width="460" />
</p>

<h3 align="center">
  Autonomous AI Revenue Recovery Operating System for the Indian Fintech Ecosystem
</h3>

<p align="center">
  <a href="#-key-features"><img src="https://img.shields.io/badge/Platform-Indian%20Fintech%20%26%20Banking-blue?style=for-the-badge&logo=razorpay" alt="Platform" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react" alt="React" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" /></a>
  <a href="#-regulatory-compliance"><img src="https://img.shields.io/badge/Compliance-RBI%20%7C%20NPCI-success?style=for-the-badge" alt="Compliance" /></a>
  <a href="#-license"><img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge" alt="License" /></a>
</p>

---

## 📌 Executive Overview

In the Indian digital payments and subscription landscape, businesses lose up to **20% to 30%** of recurring transaction volume to involuntary churn, gateway corridor timeouts, mandate drop-offs, and delayed B2B settlements.

**AIRA (Autonomous Intelligent Recovery Agent)** is a mission-critical Revenue Recovery Operating System engineered specifically for Indian fintech rails. Combining real-time payment telemetry, multi-channel dunning automation, algorithmic retry scheduling, and conversational voice AI, AIRA autonomously mitigates transaction failures while strictly adhering to Reserve Bank of India (RBI) regulations and NPCI guidelines.

AIRA unifies the entire recovery lifecycle into an intuitive, high-velocity command surface designed with Razorpay's Blade design tokens and native tabular typography.

---

## ⚡ Core Pillars & Capabilities

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             AIRA ENGINE                                  │
├──────────────────────────────────────────────────────────────────────────┤
│  ⚡ Autonomous Dunning  │  💳 Corridor Routing  │  🎙️ Multilingual Voice │
│  📊 B2B Receivables & DSO│ 🔄 NPCI Mandate Engine│  🛡️ Cryptographic Ledger│
└──────────────────────────────────────────────────────────────────────────┘
```

### 1. 💳 Payment Corridor Telemetry & Autonomous Failover
* **Real-time Rail Monitoring**: Tracks throughput, error rates, and round-trip latency across major Indian payment corridors:
  * **UPI**: HDFC UPI, ICICI UPI, SBI UPI, Axis UPI
  * **Cards**: Razorpay Visa/MasterCard, RuPay
  * **Netbanking**: HDFC, ICICI, SBI Netbanking
  * **Recurring**: e-NACH NPCI Batch Clearing
* **Autonomous Incident Detection**: Flags degraded corridors if latency exceeds 2,500ms or error rates exceed 15%.
* **Self-Healing Routing**: Dynamically reroutes inflight payments away from congested banking rails to healthy backup corridors.

### 2. ⚡ Intelligent Subscription Dunning & Optimal Retries
* **Liquidity-Aware Smart Retries**: Automatically models retry attempts around Indian salary credit cycles (1st to 5th of each month) and intraday banking clearing windows (10:00 AM – 2:00 PM).
* **Multi-Tier Dunning Ladder**: Progressively transitions across gentle WhatsApp notifications, SMS payment alerts, and automated escalations.

### 3. 📊 B2B Receivables & Days Sales Outstanding (DSO) Optimization
* **Aging Bucket Analysis**: Categorizes enterprise accounts receivable into `0-30`, `31-60`, `61-90`, and `90+` days overdue.
* **Dynamic DSO Computation**: Evaluates weighted collection periods:
  $$\text{DSO} = \frac{\sum (\text{Overdue Days} \times \text{Balance})}{\sum \text{Total Balance}}$$
* **1-Click Settlement Links**: Dispatches Razorpay Smart Payment Links with customizable grace periods and partial settlement options.

### 4. 🤝 Promise-to-Pay (P2P) Tracking Ledger
* **Omnichannel Commitment Capture**: Logs payment promises secured across voice, WhatsApp, email, or client portals.
* **Automated Settlement Reconciliation**: Automatically synchronizes state across the ledger—marking commitments as `kept`, settling linked invoices as `paid`, and recovering cases in real time.

### 5. 🔄 NPCI & RBI Compliant Mandate Sequencing
* **Regulatory Guardrails**: Enforces the statutory 24-hour cooldown between subsequent mandate execution attempts per RBI guidelines.
* **Pre-Debit WhatsApp Nudges**: Transmits mandatory pre-debit notifications to customer handsets prior to debit presentation.
* **Adaptive Rail Sequencing**: Orchestrates cascading fallbacks from primary UPI Autopay to secondary card standing instructions and e-NACH.

### 6. 🎙️ Multilingual Hinglish Voice AI Recovery
* **Real-time Conversational Recovery**: Powered by generative conversational intelligence trained on colloquial Indian financial dialogues.
* **Real-time Telemetry**: Features interactive live audio visualizers, sentiment analysis, and instantaneous in-call commitment logging.

### 7. 🛡️ Cryptographic Tamper-Evident Audit Trail
* **Immutable Decision Ledger**: Every autonomous routing choice, human operator intervention, and dunning action is immutably logged.
* **SHA-256 Verification**: Generates tamper hashes for verifiable accounting and financial audit compliance.

### 8. 🔄 Dual-Mode Architectural Resilience
* **Full-Stack Execution**: Operates against an asynchronous FastAPI backend backed by SQLite / PostgreSQL.
* **Zero-Friction Client Autonomy**: If the backend is offline, the frontend seamlessly engages an in-memory reactive data service (`dataService.ts`) with zero loss of interactive fidelity or metrics accuracy.

---

## 🏗️ Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client ["AIRA Frontend (React 19 + TypeScript + Vite)"]
        UI[Operational Command Center]
        StateCtx[AiraStateContext]
        DataBus[dataService Reactive Event Bus]
        ApiClient[apiFetch Layer with Fallback Intercept]
        UI --> StateCtx
        StateCtx --> DataBus
        UI --> ApiClient
    end

    subgraph Backend ["AIRA Core Backend (FastAPI + Async SQLAlchemy)"]
        API[FastAPI REST Router]
        Policy[Policy Governor Engine]
        RecoveryEngine[Autonomous Recovery Engine]
        CorridorMonitor[Payment Rail Telemetry Monitor]
        DB[(SQLite / PostgreSQL DB)]
        
        API --> Policy
        API --> RecoveryEngine
        API --> CorridorMonitor
        RecoveryEngine --> DB
        Policy --> DB
        CorridorMonitor --> DB
    end

    subgraph Rails ["Indian Banking & Payment Rails"]
        UPI[UPI Autopay (NPCI)]
        Cards[Cards SI / RuPay / Visa / MC]
        eNACH[e-NACH Batch Clearing]
        Razorpay[Razorpay Gateway & Webhooks]
    end

    ApiClient -->|HTTP Fetch| API
    ApiClient -.->|Offline Fallback| DataBus
    RecoveryEngine --> Razorpay
    CorridorMonitor --> UPI
    CorridorMonitor --> Cards
    CorridorMonitor --> eNACH
```

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript 5.x, Vite 8, React Router v7 |
| **Design System & Styling**| Razorpay Blade Design Tokens, Tailwind CSS, Lucide Icons |
| **Data Visualization** | Recharts, Custom SVG Audio Visualizers |
| **Backend Framework** | Python 3.11+, FastAPI 0.115, Uvicorn |
| **ORM & Database** | SQLAlchemy 2.0 (Async), aiosqlite, Alembic |
| **Validation & Schema** | Pydantic v2, Pydantic Settings |
| **AI & Telemetry** | Google Gemini API (`google-generativeai`), Faker |
| **Payment Integration** | Razorpay Python SDK, Webhook HMAC Verification |
| **Testing & Tooling** | Pytest, Pytest-Asyncio, Oxlint, TSX |

---

## 📁 Repository Structure

```
Aira/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/          # REST route handlers (cases, invoices, metrics, etc.)
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic environment settings
│   │   │   └── database.py      # Async SQLAlchemy engine & session factory
│   │   ├── models/              # SQLAlchemy database models
│   │   ├── policy/              # RBI & rate-limiting policy governors
│   │   ├── recovery/            # Recovery orchestrators & smart retry logic
│   │   ├── seed/                # Realistic synthetic data generators
│   │   ├── simulator/           # Payment corridor health & load simulator
│   │   └── main.py              # FastAPI application bootstrap
│   ├── tests/                   # Pytest test suite
│   ├── enrich_db.py             # Realistic state & scenario enrichment script
│   └── requirements.txt         # Backend Python dependencies
│
├── frontend/
│   ├── public/                  # Brand assets, high-res logos, favicons
│   ├── src/
│   │   ├── api/                 # API client with transparent fallback interceptor
│   │   ├── assets/              # Static media & vector graphics
│   │   ├── assistant/           # In-app conversational co-pilot
│   │   ├── components/          # Reusable Blade UI components (Command Palette, Drawers, etc.)
│   │   ├── context/             # React Context for synchronized state
│   │   ├── data/                # Deterministic seed datasets
│   │   ├── pages/               # Primary operational dashboards & detail views
│   │   ├── services/            # Authoritative reactive in-memory dataService
│   │   ├── tests/               # System flow verification suite
│   │   ├── utils/               # Indian numbering & zero-handling formatters
│   │   ├── App.tsx              # Application root & routing
│   │   └── index.css            # Blade color tokens & tabular typography
│   └── package.json             # Frontend dependencies and scripts
│
├── .env.example                 # Environment variable template
├── .gitignore                   # Comprehensive ignore rules
├── BUG_AUDIT.md                 # 25-point comprehensive bug resolution matrix
├── DATA_ARCHITECTURE.md         # Detailed data architecture & mathematical specs
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
* **Node.js**: v18.0.0 or later (v20+ recommended)
* **Python**: v3.11 or later
* **Git**: Installed and configured

---

### 1. Clone the Repository

```bash
git clone https://github.com/Shambhavi500/Aira.git
cd Aira
```

---

### 2. Backend Setup

1. **Navigate to the backend directory and set up a virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   ```

2. **Activate the virtual environment:**
   * **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux:**
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Copy the example environment configuration from the project root:
   ```bash
   cp ../.env.example ../.env
   ```
   *(Optionally edit `.env` to configure your `GEMINI_API_KEY` or `RAZORPAY_KEY_ID`)*

5. **Generate and Seed the Database:**
   ```bash
   python enrich_db.py
   ```

6. **Start the FastAPI Server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   The backend API will be available at: **`http://localhost:8000`**  
   Interactive Swagger docs: **`http://localhost:8000/docs`**

---

### 3. Frontend Setup

1. **Open a new terminal window and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Launch the development server:**
   ```bash
   npm run dev
   ```
   The application will launch at: **`http://localhost:5173`**

---

## 🧪 CI/CD & Local Verification

AIRA provides a robust, reproducible CI/CD pipeline engineered to verify the complete project deterministically on every pull request and push to `main`.

### 🛡️ Core CI Mandate: Deterministic & Keyless

> **Normal CI does NOT require a live Gemini API key.**

All AI-dependent recovery signal classification and root-cause analysis in normal CI utilize a deterministic mock provider (`MockGeminiProvider`). This guarantees **100% reproducible test outcomes** with zero network latency, zero flakiness, and zero external API dependencies.

A live Gemini test job is supported as an **optional, isolated pipeline job** strictly gated behind the presence of the `GEMINI_API_KEY` repository secret (`secrets.GEMINI_API_KEY != ''`).

---

### 🚀 Unified Local CI Runner (`npm run ci`)

You can execute the exact equivalent of the full GitHub Actions CI pipeline locally with a single command from the repository root:

```bash
npm run ci
```

This sequentially executes all verification stages in offline mode:

1. **Frontend Lint**: `npm --prefix frontend run lint` (`oxlint`)
2. **Frontend Typecheck**: `npm --prefix frontend run typecheck` (`tsc -b`)
3. **Unit & Contract Tests**:
   - Backend contract & unit suite (`pytest` with deterministic mock Gemini)
   - Frontend state machine & flow verification (`tsx verify_flows.ts`)
4. **Dataset Validation**:
   - Backend SQLite database schema & constraint validation (`validate_datasets.py`)
   - Frontend in-memory seed dataset validation (`validate_datasets.ts`)
5. **Backend Startup Verification**:
   - Starts FastAPI application, verifies lifespan initialization, asserts `/health` HTTP 200, checks `/api/metrics`, and terminates cleanly (`verify_backend.py`)
6. **Production Frontend Build**: `npm --prefix frontend run build` (`vite build`)

---

### 📋 Individual Verification Commands

From the project root:

| Command | Description | Environment |
|---------|-------------|-------------|
| `npm run ci` | Runs complete 6-stage CI verification locally | `AI_PROVIDER=mock` (Offline) |
| `npm run lint` | Runs frontend code quality checks via `oxlint` | Local / CI |
| `npm run typecheck` | Validates TypeScript types across frontend | Local / CI |
| `npm test` | Runs both backend pytest and frontend verification tests | Offline / Keyless |
| `npm run test:gemini` | Runs live Gemini contract tests (skips if key absent) | Requires `GEMINI_API_KEY` |
| `npm run validate:dataset` | Validates backend SQLite DB and frontend seed datasets | Local / CI |
| `npm run verify:backend` | Boots backend, probes `/health` & `/api/metrics`, exits | Local / CI |
| `npm run build` | Compiles production-ready frontend bundle | Local / CI |

---

### 🤖 Live Gemini Integration Testing

To run live integration tests against Google Gemini:

```bash
# Set your API key
export GEMINI_API_KEY="your-actual-api-key"
export AI_PROVIDER="gemini"

# Run dedicated live Gemini test suite
npm run test:gemini
```

If `GEMINI_API_KEY` is not present, the live test cleanly skips without failing.

## 📜 Indian Financial & Regulatory Compliance

AIRA is built around strict compliance with Indian financial regulations:

* **RBI Circular on Recurring Transactions (RBI/2020-21/74)**:
  * Strict adherence to pre-debit notifications (minimum 24 hours prior).
  * Enforcement of statutory 24-hour cooldown periods between automated retries.
* **NPCI Procedural Guidelines for UPI Autopay**:
  * Unified error code normalization across bank remitter and beneficiary codes.
* **DPDP Act (Digital Personal Data Protection)**:
  * Sensitive customer banking identifiers and cards are masked at the API boundary.

---

## 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---

<p align="center">
  Built with ❤️ for the Indian Fintech Ecosystem • Powered by <b>AIRA</b>
</p>
