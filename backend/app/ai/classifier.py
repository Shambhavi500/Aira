"""
AI Classifier — uses Gemini 1.5 Flash to classify root cause and recommend action.
Falls back to deterministic rule-based classification on any failure.
The AI is NEVER the final authority — its output goes to the Policy Governor.
"""
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Root causes
ROOT_CAUSES = [
    "INSUFFICIENT_FUNDS",
    "CARD_EXPIRED",
    "CARD_DECLINED",
    "TECHNICAL_ERROR",
    "BANK_DEGRADATION",
    "MANDATE_INVALID",
    "MANDATE_PAUSED",
    "CUSTOMER_ABANDONED",
    "PROMISE_BROKEN",
    "AUTHENTICATION_FAILED",
    "NETWORK_TIMEOUT",
    "PAYMENT_METHOD_INVALID",
    "DUPLICATE_PAYMENT",
    "UNKNOWN",
]

# Possible recommendations
ACTIONS = [
    "RETRY",
    "SEND_PAYMENT_LINK",
    "SEND_REMINDER",
    "UPDATE_PAYMENT_METHOD",
    "MANDATE_REREGISTER",
    "ESCALATE",
    "MANUAL_REVIEW",
    "STOP",
    "WAIT",
    "UNKNOWN",
]

# Deterministic fallback rules: (failure_code_fragments, method) → (root_cause, action, confidence)
FALLBACK_RULES = [
    (["BAD_REQUEST_ERROR", "insufficient"], None,   "INSUFFICIENT_FUNDS",     "RETRY",              0.75),
    (["CARD_EXPIRED", "expired"],           "card", "CARD_EXPIRED",           "UPDATE_PAYMENT_METHOD", 0.85),
    (["CARD_DECLINED", "declined"],         "card", "CARD_DECLINED",          "RETRY",              0.70),
    (["GATEWAY_ERROR", "gateway"],          None,   "TECHNICAL_ERROR",        "RETRY",              0.65),
    (["NETWORK_ERROR", "timeout"],          None,   "NETWORK_TIMEOUT",        "RETRY",              0.70),
    (["INVALID_MANDATE", "mandate"],        None,   "MANDATE_INVALID",        "MANDATE_REREGISTER", 0.80),
    (["PAYMENT_CANCELLED", "abandon"],      None,   "CUSTOMER_ABANDONED",     "SEND_PAYMENT_LINK",  0.80),
    (["authentication", "auth"],            None,   "AUTHENTICATION_FAILED",  "ESCALATE",           0.72),
]


@dataclass
class ClassificationResult:
    root_cause: str
    confidence: float
    recommendation: str
    reason: str
    signals: list[str] = field(default_factory=list)
    is_fallback: bool = False


def _fallback_classify(failure_code: str, failure_reason: str, method: str) -> ClassificationResult:
    """Deterministic fallback when AI is unavailable."""
    text = f"{failure_code or ''} {failure_reason or ''}".lower()
    for fragments, req_method, root_cause, action, conf in FALLBACK_RULES:
        if req_method and method and req_method not in method.lower():
            continue
        if any(f.lower() in text for f in fragments):
            return ClassificationResult(
                root_cause=root_cause,
                confidence=conf,
                recommendation=action,
                reason=f"Rule-based classification: matched pattern '{fragments[0]}' in failure data.",
                signals=[f"failure_code={failure_code}", f"method={method}"],
                is_fallback=True,
            )
    return ClassificationResult(
        root_cause="UNKNOWN",
        confidence=0.3,
        recommendation="ESCALATE",
        reason="No matching rule found. Escalating for manual review.",
        signals=[f"failure_code={failure_code}", f"failure_reason={failure_reason}"],
        is_fallback=True,
    )


async def classify_recovery_signal(
    *,
    scenario_type: str,
    failure_code: Optional[str],
    failure_reason: Optional[str],
    payment_method: Optional[str],
    amount: float,
    customer_history: dict,  # {successful_payments, previous_failures, risk_segment}
    attempt_count: int = 0,
    extra_context: Optional[str] = None,
    gemini_api_key: str = "",
) -> ClassificationResult:
    """
    Classify the root cause of a revenue risk event and recommend a recovery action.
    Uses Gemini 1.5 Flash with structured JSON output.
    Falls back to rule-based classification on any error.
    """
    if not gemini_api_key:
        logger.info("No Gemini API key — using fallback classifier")
        return _fallback_classify(failure_code or "", failure_reason or "", payment_method or "")

    prompt = f"""You are an expert fintech revenue recovery analyst for an Indian payment platform.

Analyze the following payment failure and classify it precisely.

FAILURE DATA:
- Scenario: {scenario_type}
- Failure Code: {failure_code or 'N/A'}
- Failure Reason: {failure_reason or 'N/A'}
- Payment Method: {payment_method or 'N/A'}
- Amount: ₹{amount:.2f}
- Attempt Count: {attempt_count}
- Customer History: {json.dumps(customer_history)}
{f'- Additional Context: {extra_context}' if extra_context else ''}

VALID ROOT CAUSES: {', '.join(ROOT_CAUSES)}
VALID ACTIONS: {', '.join(ACTIONS)}

Respond ONLY with valid JSON in this exact format:
{{
  "root_cause": "<one of the VALID ROOT CAUSES>",
  "confidence": <float 0.0-1.0>,
  "recommendation": "<one of the VALID ACTIONS>",
  "reason": "<1-2 sentence explanation for a human operator>",
  "signals": ["<signal 1>", "<signal 2>", ...]
}}

Rules:
- If uncertain, set confidence < 0.5 and recommendation to "ESCALATE"
- If completely unknown, root_cause = "UNKNOWN", recommendation = "ESCALATE"
- Never invent facts not present in the data
- Signals must be concrete observations from the data, not generic statements"""

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=512,
            ),
        )
        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        data = json.loads(text)

        root_cause = data.get("root_cause", "UNKNOWN")
        if root_cause not in ROOT_CAUSES:
            root_cause = "UNKNOWN"

        recommendation = data.get("recommendation", "ESCALATE")
        if recommendation not in ACTIONS:
            recommendation = "ESCALATE"

        confidence = float(data.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        return ClassificationResult(
            root_cause=root_cause,
            confidence=confidence,
            recommendation=recommendation,
            reason=data.get("reason", ""),
            signals=data.get("signals", []),
            is_fallback=False,
        )

    except Exception as e:
        logger.warning(f"Gemini classification failed: {e}. Using fallback.")
        return _fallback_classify(failure_code or "", failure_reason or "", payment_method or "")
