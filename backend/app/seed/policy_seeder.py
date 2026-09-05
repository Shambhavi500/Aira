"""
Seed policy rules into the database on first run.
Rules are stored in DB (not hardcoded in Python) so they can be
updated without code changes.

REGULATORY rules have VERIFY_REQUIRED status where the exact
limit has not been confirmed from primary sources.
PRODUCT_SAFETY rules are internal defaults.
"""
import json
from datetime import datetime
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.policy_rule import PolicyRule


POLICY_RULES = [
    # -----------------------------------------------------------------------
    # PRODUCT SAFETY — internal Razorpay platform defaults
    # -----------------------------------------------------------------------
    {
        "rule_key": "max_auto_retries_card",
        "name": "Maximum Automated Card Retries",
        "description": (
            "Maximum number of automated retry attempts for a failed card payment "
            "within a single recovery case before requiring human or customer action."
        ),
        "source": "Internal Product Safety",
        "source_url": "",
        "effective_date": datetime(2024, 1, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "ACTIVE",
        "rule_type": "PRODUCT_SAFETY",
        "config": json.dumps({"max_retries": 3, "applies_to": ["card", "emi"]}),
    },
    {
        "rule_key": "max_auto_retries_upi",
        "name": "Maximum Automated UPI Retries",
        "description": (
            "Maximum number of automated retry attempts for a failed UPI payment."
        ),
        "source": "Internal Product Safety",
        "source_url": "",
        "effective_date": datetime(2024, 1, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "ACTIVE",
        "rule_type": "PRODUCT_SAFETY",
        "config": json.dumps({"max_retries": 2, "applies_to": ["upi"]}),
    },
    {
        "rule_key": "min_retry_interval_hours",
        "name": "Minimum Retry Interval",
        "description": (
            "Minimum time in hours that must elapse between automated retry attempts "
            "for the same case. Prevents aggressive retry storms."
        ),
        "source": "Internal Product Safety",
        "source_url": "",
        "effective_date": datetime(2024, 1, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "ACTIVE",
        "rule_type": "PRODUCT_SAFETY",
        "config": json.dumps({"min_hours": 24, "applies_to": ["card", "upi", "netbanking"]}),
    },
    {
        "rule_key": "max_customer_contacts_per_day",
        "name": "Maximum Customer Contacts Per Day",
        "description": (
            "Maximum number of automated outbound contacts (SMS, email, push) "
            "allowed per customer per calendar day across all channels."
        ),
        "source": "Internal Product Safety",
        "source_url": "",
        "effective_date": datetime(2024, 1, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "ACTIVE",
        "rule_type": "PRODUCT_SAFETY",
        "config": json.dumps({"max_contacts": 2, "window_hours": 24}),
    },
    {
        "rule_key": "max_auto_retries_netbanking",
        "name": "Maximum Automated Netbanking Retries",
        "description": (
            "Maximum number of automated retry attempts for a failed netbanking payment."
        ),
        "source": "Internal Product Safety",
        "source_url": "",
        "effective_date": datetime(2024, 1, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "ACTIVE",
        "rule_type": "PRODUCT_SAFETY",
        "config": json.dumps({"max_retries": 2, "applies_to": ["netbanking"]}),
    },
    # -----------------------------------------------------------------------
    # REGULATORY — status VERIFY_REQUIRED where limit not confirmed
    # from primary RBI/NPCI source documents
    # -----------------------------------------------------------------------
    {
        "rule_key": "rbi_e_mandate_auth_requirement",
        "name": "RBI e-Mandate Authentication Requirement",
        "description": (
            "RBI circular mandates that recurring e-mandate debits above a specified "
            "threshold require additional factor authentication (AFA) from the customer. "
            "Status: VERIFY_REQUIRED — exact threshold should be confirmed from the "
            "latest RBI circular on recurring transactions."
        ),
        "source": "RBI",
        "source_url": "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11668",
        "effective_date": datetime(2021, 10, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "VERIFY_REQUIRED",
        "rule_type": "REGULATORY",
        "config": json.dumps({
            "afa_threshold_inr": 15000,
            "note": "Threshold requires verification from latest RBI circular",
            "applies_to": ["e_mandate"],
        }),
    },
    {
        "rule_key": "npci_upi_autopay_debit_window",
        "name": "NPCI UPI AutoPay Debit Window",
        "description": (
            "NPCI guidelines specify a pre-debit notification window for UPI AutoPay "
            "mandates. The customer must be notified before auto-debit is executed. "
            "Status: VERIFY_REQUIRED — confirm exact window from current NPCI circulars."
        ),
        "source": "NPCI",
        "source_url": "https://www.npci.org.in/what-we-do/upi/upi-autopay",
        "effective_date": datetime(2021, 10, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "VERIFY_REQUIRED",
        "rule_type": "REGULATORY",
        "config": json.dumps({
            "pre_debit_notification_hours": 24,
            "note": "Pre-debit window requires verification from NPCI circular",
            "applies_to": ["upi_autopay"],
        }),
    },
    {
        "rule_key": "promise_broken_cooldown_days",
        "name": "Promise Broken Contact Cooldown",
        "description": (
            "After a promise-to-pay is broken, wait this many days before "
            "automated follow-up to avoid harassment."
        ),
        "source": "Internal Product Safety",
        "source_url": "",
        "effective_date": datetime(2024, 1, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "ACTIVE",
        "rule_type": "PRODUCT_SAFETY",
        "config": json.dumps({"cooldown_days": 2}),
    },
    {
        "rule_key": "checkout_recovery_max_links",
        "name": "Checkout Recovery Maximum Payment Links",
        "description": (
            "Maximum number of recovery payment links sent per abandoned checkout session."
        ),
        "source": "Internal Product Safety",
        "source_url": "",
        "effective_date": datetime(2024, 1, 1),
        "last_verified": datetime(2024, 1, 1),
        "status": "ACTIVE",
        "rule_type": "PRODUCT_SAFETY",
        "config": json.dumps({"max_links": 2}),
    },
]


async def seed_policy_rules() -> None:
    """Insert policy rules if they don't already exist."""
    async with AsyncSessionLocal() as session:
        for rule_data in POLICY_RULES:
            result = await session.execute(
                select(PolicyRule).where(PolicyRule.rule_key == rule_data["rule_key"])
            )
            existing = result.scalar_one_or_none()
            if existing is None:
                rule = PolicyRule(**rule_data)
                session.add(rule)
        await session.commit()
