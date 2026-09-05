"""
Deterministic Recovery Simulator.
Used when real payment infrastructure cannot reproduce every failure scenario.
Clearly labeled SIMULATED. Uses deterministic seeds for reproducibility.
Same dataset + same seed → same outcomes every time.
"""
import random
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Simulation outcomes
OUTCOMES = ["SUCCESS", "FAILED", "TIMEOUT", "CUSTOMER_ACTION_REQUIRED", "POLICY_BLOCKED"]


@dataclass
class SimulationResult:
    outcome: str                    # One of OUTCOMES
    amount_recovered: float
    notes: str
    simulated: bool = True
    seed_used: int = 0


# Outcome probabilities by root cause and action
OUTCOME_MATRIX: dict[tuple[str, str], list[tuple[str, float]]] = {
    # (root_cause, action): [(outcome, probability)]
    ("INSUFFICIENT_FUNDS", "RETRY"): [
        ("SUCCESS", 0.45), ("FAILED", 0.40), ("TIMEOUT", 0.10), ("CUSTOMER_ACTION_REQUIRED", 0.05),
    ],
    ("INSUFFICIENT_FUNDS", "SEND_PAYMENT_LINK"): [
        ("SUCCESS", 0.55), ("FAILED", 0.30), ("TIMEOUT", 0.15),
    ],
    ("CARD_EXPIRED", "RETRY"): [
        ("FAILED", 0.85), ("SUCCESS", 0.05), ("CUSTOMER_ACTION_REQUIRED", 0.10),
    ],
    ("CARD_EXPIRED", "UPDATE_PAYMENT_METHOD"): [
        ("CUSTOMER_ACTION_REQUIRED", 0.70), ("SUCCESS", 0.20), ("FAILED", 0.10),
    ],
    ("CARD_DECLINED", "RETRY"): [
        ("SUCCESS", 0.50), ("FAILED", 0.35), ("TIMEOUT", 0.15),
    ],
    ("TECHNICAL_ERROR", "RETRY"): [
        ("SUCCESS", 0.65), ("FAILED", 0.20), ("TIMEOUT", 0.15),
    ],
    ("BANK_DEGRADATION", "RETRY"): [
        ("SUCCESS", 0.40), ("FAILED", 0.40), ("TIMEOUT", 0.20),
    ],
    ("MANDATE_INVALID", "MANDATE_REREGISTER"): [
        ("CUSTOMER_ACTION_REQUIRED", 0.80), ("FAILED", 0.20),
    ],
    ("MANDATE_INVALID", "RETRY"): [
        ("FAILED", 0.90), ("TIMEOUT", 0.10),
    ],
    ("CUSTOMER_ABANDONED", "SEND_PAYMENT_LINK"): [
        ("SUCCESS", 0.35), ("FAILED", 0.50), ("TIMEOUT", 0.15),
    ],
    ("AUTHENTICATION_FAILED", "RETRY"): [
        ("FAILED", 0.70), ("SUCCESS", 0.15), ("CUSTOMER_ACTION_REQUIRED", 0.15),
    ],
    ("NETWORK_TIMEOUT", "RETRY"): [
        ("SUCCESS", 0.60), ("FAILED", 0.25), ("TIMEOUT", 0.15),
    ],
    ("PROMISE_BROKEN", "SEND_REMINDER"): [
        ("SUCCESS", 0.30), ("FAILED", 0.60), ("TIMEOUT", 0.10),
    ],
    ("UNKNOWN", "ESCALATE"): [
        ("CUSTOMER_ACTION_REQUIRED", 0.60), ("FAILED", 0.40),
    ],
}

# Default when no specific matrix entry
DEFAULT_OUTCOMES: list[tuple[str, float]] = [
    ("SUCCESS", 0.40), ("FAILED", 0.40), ("TIMEOUT", 0.15), ("CUSTOMER_ACTION_REQUIRED", 0.05),
]

# Outcome messages
OUTCOME_MESSAGES: dict[str, str] = {
    "SUCCESS": "Simulated recovery successful. Payment processed.",
    "FAILED": "Simulated recovery failed. Payment could not be processed.",
    "TIMEOUT": "Simulated timeout. Payment gateway did not respond.",
    "CUSTOMER_ACTION_REQUIRED": "Simulated: customer action required to complete recovery.",
    "POLICY_BLOCKED": "Action was blocked by Policy Governor before execution.",
}


def simulate_recovery(
    *,
    root_cause: str,
    action: str,
    amount: float,
    seed: int,
) -> SimulationResult:
    """
    Run a deterministic simulation of a recovery action.
    
    The same (root_cause, action, amount, seed) → always produces the same outcome.
    This is by design for reproducible evaluation.
    """
    rng = random.Random(seed)

    # Look up outcome probabilities
    matrix = OUTCOME_MATRIX.get((root_cause, action)) or \
             OUTCOME_MATRIX.get((root_cause, "RETRY")) or \
             DEFAULT_OUTCOMES

    outcomes = [o for o, _ in matrix]
    weights = [w for _, w in matrix]

    outcome = rng.choices(outcomes, weights=weights, k=1)[0]

    amount_recovered = amount if outcome == "SUCCESS" else 0.0

    logger.info(
        f"[SIMULATOR] root_cause={root_cause} action={action} "
        f"amount={amount:.2f} seed={seed} → {outcome}"
    )

    return SimulationResult(
        outcome=outcome,
        amount_recovered=amount_recovered,
        notes=f"[SIMULATED seed={seed}] {OUTCOME_MESSAGES.get(outcome, outcome)}",
        simulated=True,
        seed_used=seed,
    )
