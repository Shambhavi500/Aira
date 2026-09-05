"""
Policy Governor — deterministic, rule-based.
AI CANNOT bypass this. Every automated financial action must pass through it.

Inputs: case context, AI recommendation, customer contact history, policy rules from DB.
Output: ALLOW, BLOCK, or ESCALATE — with full rule audit trail.
"""
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.policy_rule import PolicyRule
from app.models.intervention import Intervention
from app.models.audit_event import AuditEvent
from app.models.recovery_case import RecoveryCase

logger = logging.getLogger(__name__)

POLICY_VERSION = "1.0"


@dataclass
class RuleCheck:
    rule_key: str
    rule_name: str
    passed: bool
    reason: str


@dataclass
class GovernorDecision:
    decision: str                       # ALLOW, BLOCK, ESCALATE
    reason: str
    rules_checked: list[RuleCheck] = field(default_factory=list)
    policy_version: str = POLICY_VERSION
    timestamp: datetime = field(default_factory=datetime.utcnow)


async def _load_rule(rule_key: str, db: AsyncSession) -> Optional[dict]:
    """Load a policy rule config from DB."""
    result = await db.execute(
        select(PolicyRule).where(PolicyRule.rule_key == rule_key, PolicyRule.status != "DEPRECATED")
    )
    rule = result.scalar_one_or_none()
    if not rule:
        return None
    try:
        return json.loads(rule.config)
    except Exception:
        return {}


async def evaluate_action(
    *,
    case: RecoveryCase,
    recommended_action: str,
    payment_method: Optional[str],
    amount: float,
    mandate_status: Optional[str],
    attempt_count: int,
    last_attempt_at: Optional[datetime],
    mandate_type: Optional[str],
    db: AsyncSession,
) -> GovernorDecision:
    """
    Evaluate whether a recommended action is allowed under policy.
    
    Returns GovernorDecision with ALLOW, BLOCK, or ESCALATE.
    Every check is recorded in rules_checked for full auditability.
    """
    checks: list[RuleCheck] = []
    block_reasons: list[str] = []

    # -----------------------------------------------------------------------
    # CHECK 1: Stopping rules — never retry UNRECOVERABLE or STOPPED cases
    # -----------------------------------------------------------------------
    if case.status in ("UNRECOVERABLE", "STOPPED"):
        checks.append(RuleCheck(
            rule_key="stopping_rule",
            rule_name="Case Stopping Rule",
            passed=False,
            reason=f"Case is in terminal state: {case.status}. No further actions permitted.",
        ))
        return GovernorDecision(
            decision="BLOCK",
            reason=f"Case is in terminal state {case.status}.",
            rules_checked=checks,
        )
    checks.append(RuleCheck(
        rule_key="stopping_rule",
        rule_name="Case Stopping Rule",
        passed=True,
        reason=f"Case status {case.status} is eligible for recovery actions.",
    ))

    # -----------------------------------------------------------------------
    # CHECK 2: Mandate validity (for mandate-based actions)
    # -----------------------------------------------------------------------
    if recommended_action in ("RETRY", "MANDATE_REREGISTER") and mandate_status is not None:
        if mandate_status in ("revoked", "cancelled"):
            checks.append(RuleCheck(
                rule_key="mandate_validity",
                rule_name="Mandate Validity Check",
                passed=False,
                reason=f"Mandate is {mandate_status}. Cannot execute automated debit. Customer must reauthorize.",
            ))
            block_reasons.append("Mandate is revoked/cancelled")
        else:
            checks.append(RuleCheck(
                rule_key="mandate_validity",
                rule_name="Mandate Validity Check",
                passed=True,
                reason=f"Mandate status is {mandate_status}.",
            ))

    # -----------------------------------------------------------------------
    # CHECK 3: Maximum automated retries (method-specific)
    # -----------------------------------------------------------------------
    if recommended_action == "RETRY":
        method_key = "upi" if payment_method and "upi" in payment_method.lower() else \
                     "netbanking" if payment_method and "netbanking" in payment_method.lower() else "card"
        rule_key = f"max_auto_retries_{method_key}"
        config = await _load_rule(rule_key, db)
        max_retries = config.get("max_retries", 3) if config else 3

        if attempt_count >= max_retries:
            checks.append(RuleCheck(
                rule_key=rule_key,
                rule_name=f"Max Auto Retries ({method_key.upper()})",
                passed=False,
                reason=f"Attempt count {attempt_count} has reached or exceeded policy limit of {max_retries}. Automated retry not permitted.",
            ))
            block_reasons.append(f"Max retries ({max_retries}) reached for {method_key}")
        else:
            checks.append(RuleCheck(
                rule_key=rule_key,
                rule_name=f"Max Auto Retries ({method_key.upper()})",
                passed=True,
                reason=f"Attempt count {attempt_count} is within limit of {max_retries}.",
            ))

    # -----------------------------------------------------------------------
    # CHECK 4: Minimum retry interval
    # -----------------------------------------------------------------------
    if recommended_action == "RETRY" and last_attempt_at is not None:
        config = await _load_rule("min_retry_interval_hours", db)
        min_hours = config.get("min_hours", 24) if config else 24
        hours_since = (datetime.utcnow() - last_attempt_at).total_seconds() / 3600

        if hours_since < min_hours:
            checks.append(RuleCheck(
                rule_key="min_retry_interval_hours",
                rule_name="Minimum Retry Interval",
                passed=False,
                reason=f"Only {hours_since:.1f}h since last attempt. Policy requires {min_hours}h minimum interval.",
            ))
            block_reasons.append(f"Retry interval not satisfied ({hours_since:.1f}h < {min_hours}h required)")
        else:
            checks.append(RuleCheck(
                rule_key="min_retry_interval_hours",
                rule_name="Minimum Retry Interval",
                passed=True,
                reason=f"{hours_since:.1f}h since last attempt exceeds {min_hours}h minimum.",
            ))

    # -----------------------------------------------------------------------
    # CHECK 5: RBI e-mandate authentication requirement (VERIFY_REQUIRED)
    # -----------------------------------------------------------------------
    if mandate_type in ("e_mandate",) and recommended_action == "RETRY":
        config = await _load_rule("rbi_e_mandate_auth_requirement", db)
        threshold = config.get("afa_threshold_inr", 15000) if config else 15000
        if amount > threshold:
            checks.append(RuleCheck(
                rule_key="rbi_e_mandate_auth_requirement",
                rule_name="RBI e-Mandate Authentication (VERIFY_REQUIRED)",
                passed=False,
                reason=(
                    f"Amount ₹{amount:,.2f} exceeds AFA threshold ₹{threshold:,.0f}. "
                    "Per RBI circular, additional factor authentication required. "
                    "NOTE: Exact threshold marked VERIFY_REQUIRED — confirm from latest RBI circular."
                ),
            ))
            block_reasons.append("RBI e-mandate AFA required for this amount")
        else:
            checks.append(RuleCheck(
                rule_key="rbi_e_mandate_auth_requirement",
                rule_name="RBI e-Mandate Authentication (VERIFY_REQUIRED)",
                passed=True,
                reason=f"Amount ₹{amount:,.2f} is within AFA threshold.",
            ))

    # -----------------------------------------------------------------------
    # CHECK 6: Customer contact frequency
    # -----------------------------------------------------------------------
    if recommended_action in ("SEND_PAYMENT_LINK", "SEND_REMINDER"):
        config = await _load_rule("max_customer_contacts_per_day", db)
        max_contacts = config.get("max_contacts", 2) if config else 2
        window_hours = config.get("window_hours", 24) if config else 24

        since = datetime.utcnow() - timedelta(hours=window_hours)
        contact_count = await db.scalar(
            select(func.count(Intervention.id)).where(
                Intervention.case_id == case.id,
                Intervention.action.in_(["SEND_PAYMENT_LINK", "SEND_REMINDER"]),
                Intervention.requested_at >= since,
            )
        ) or 0

        if contact_count >= max_contacts:
            checks.append(RuleCheck(
                rule_key="max_customer_contacts_per_day",
                rule_name="Max Customer Contacts Per Day",
                passed=False,
                reason=f"Already sent {contact_count} contact(s) in last {window_hours}h. Policy limit is {max_contacts}.",
            ))
            block_reasons.append(f"Contact frequency limit reached ({contact_count}/{max_contacts})")
        else:
            checks.append(RuleCheck(
                rule_key="max_customer_contacts_per_day",
                rule_name="Max Customer Contacts Per Day",
                passed=True,
                reason=f"Contact count {contact_count} within limit of {max_contacts}.",
            ))

    # -----------------------------------------------------------------------
    # Synthesize final decision
    # -----------------------------------------------------------------------
    if block_reasons:
        # Check if any block is a high-signal escalation candidate
        escalate_triggers = ["AFA required", "Mandate is revoked"]
        should_escalate = any(t in reason for reason in block_reasons for t in escalate_triggers)
        decision = "ESCALATE" if should_escalate else "BLOCK"
        reason = "; ".join(block_reasons)
        return GovernorDecision(decision=decision, reason=reason, rules_checked=checks)

    return GovernorDecision(
        decision="ALLOW",
        reason="All policy checks passed. Action is permitted.",
        rules_checked=checks,
    )
