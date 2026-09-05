"""
Gemini Provider Contract & Integration Tests
───────────────────────────────────────────
Deterministic contract verification for AIRA's Gemini AI integration.
Guarantees that:
1. Normal CI requires ZERO Gemini API keys and executes NO external network calls.
2. Structured output generation adheres to AIRA's expected schema.
3. Markdown code fences are stripped correctly.
4. Schema violations, malformed JSON, and network failures gracefully fall back.
5. RealGeminiProvider enforces key requirements and initializes lazily.
"""

import json
import pytest
from app.ai.classifier import (
    classify_recovery_signal,
    ROOT_CAUSES,
    ACTIONS,
    ClassificationResult,
)
from app.ai.provider import (
    MockGeminiProvider,
    RealGeminiProvider,
    get_gemini_provider,
    set_gemini_provider,
)
from app.core.config import settings


@pytest.fixture(autouse=True)
def reset_provider():
    """Ensure clean provider state for each contract test."""
    set_gemini_provider(None)
    yield
    set_gemini_provider(None)


@pytest.mark.asyncio
async def test_mock_provider_deterministic_responses():
    """Verify MockGeminiProvider produces deterministic, valid JSON contracts without API keys."""
    mock = MockGeminiProvider()

    test_cases = [
        ("BAD_REQUEST_ERROR", "INSUFFICIENT_FUNDS", "RETRY"),
        ("CARD_EXPIRED", "CARD_EXPIRED", "UPDATE_PAYMENT_METHOD"),
        ("CARD_DECLINED", "CARD_DECLINED", "RETRY"),
        ("GATEWAY_ERROR", "TECHNICAL_ERROR", "RETRY"),
        ("NETWORK_ERROR", "NETWORK_TIMEOUT", "RETRY"),
        ("INVALID_MANDATE", "MANDATE_INVALID", "MANDATE_REREGISTER"),
        ("PAYMENT_CANCELLED", "CUSTOMER_ABANDONED", "SEND_PAYMENT_LINK"),
        ("AUTHENTICATION_FAILED", "AUTHENTICATION_FAILED", "ESCALATE"),
    ]

    for failure_code, expected_cause, expected_action in test_cases:
        prompt = f"Failure Code: {failure_code}\nAnalyze this payment."
        raw_response = await mock.generate_content(prompt)
        data = json.loads(raw_response)

        assert data["root_cause"] == expected_cause
        assert data["recommendation"] == expected_action
        assert 0.0 <= data["confidence"] <= 1.0
        assert isinstance(data["reason"], str) and len(data["reason"]) > 0
        assert isinstance(data["signals"], list) and len(data["signals"]) > 0


@pytest.mark.asyncio
async def test_request_construction_and_prompt_structure():
    """Verify classify_recovery_signal constructs prompts with complete telemetry context."""
    mock = MockGeminiProvider()

    result = await classify_recovery_signal(
        scenario_type="FAILED_SUBSCRIPTION",
        failure_code="BAD_REQUEST_ERROR",
        failure_reason="Insufficient balance in customer bank account",
        payment_method="upi_autopay",
        amount=145000.0,
        customer_history={"risk_segment": "LOW", "successful_payments": 12},
        attempt_count=2,
        extra_context="Salaried employee corridor; optimal window Tuesday",
        provider=mock,
    )

    assert len(mock.call_history) == 1
    sent_prompt = mock.call_history[0]["prompt"]

    assert "FAILED_SUBSCRIPTION" in sent_prompt
    assert "BAD_REQUEST_ERROR" in sent_prompt
    assert "Insufficient balance" in sent_prompt
    assert "upi_autopay" in sent_prompt
    assert "₹145000.00" in sent_prompt
    assert "Attempt Count: 2" in sent_prompt
    assert "Salaried employee corridor" in sent_prompt
    assert "VALID ROOT CAUSES" in sent_prompt
    assert "VALID ACTIONS" in sent_prompt

    assert isinstance(result, ClassificationResult)
    assert result.root_cause == "INSUFFICIENT_FUNDS"
    assert result.recommendation == "RETRY"
    assert result.is_fallback is False


@pytest.mark.asyncio
async def test_markdown_code_fence_stripping():
    """Verify parser cleanly strips markdown code fences (```json ... ```)."""
    mock = MockGeminiProvider(
        fixed_response="""```json
{
  "root_cause": "CARD_EXPIRED",
  "confidence": 0.95,
  "recommendation": "UPDATE_PAYMENT_METHOD",
  "reason": "Card validity expired on last day of previous month.",
  "signals": ["failure_code=CARD_EXPIRED", "expired_instrument"]
}
```"""
    )

    result = await classify_recovery_signal(
        scenario_type="FAILED_SUBSCRIPTION",
        failure_code="CARD_EXPIRED",
        failure_reason="Card expired",
        payment_method="card",
        amount=4500.0,
        customer_history={},
        provider=mock,
    )

    assert result.root_cause == "CARD_EXPIRED"
    assert result.recommendation == "UPDATE_PAYMENT_METHOD"
    assert result.confidence == 0.95
    assert result.is_fallback is False


@pytest.mark.asyncio
async def test_malformed_json_triggers_rule_fallback():
    """Verify malformed JSON from model triggers safe deterministic fallback without crashing."""
    mock = MockGeminiProvider(fixed_response="Internal server error occurred: {malformed JSON missing closing brace")

    result = await classify_recovery_signal(
        scenario_type="FAILED_SUBSCRIPTION",
        failure_code="CARD_EXPIRED",
        failure_reason="Card expired",
        payment_method="card",
        amount=5000.0,
        customer_history={},
        provider=mock,
    )

    assert result.is_fallback is True
    assert result.root_cause == "CARD_EXPIRED"
    assert result.recommendation == "UPDATE_PAYMENT_METHOD"


@pytest.mark.asyncio
async def test_simulated_gemini_api_failure_triggers_fallback():
    """Verify provider runtime/network exception triggers rule fallback."""
    mock = MockGeminiProvider(should_fail=True, failure_error=RuntimeError("503 Service Unavailable"))

    result = await classify_recovery_signal(
        scenario_type="CHECKOUT_DROPOFF",
        failure_code="PAYMENT_CANCELLED",
        failure_reason="User cancelled checkout flow",
        payment_method="upi",
        amount=12000.0,
        customer_history={},
        provider=mock,
    )

    assert result.is_fallback is True
    assert result.root_cause == "CUSTOMER_ABANDONED"
    assert result.recommendation == "SEND_PAYMENT_LINK"


@pytest.mark.asyncio
async def test_schema_clamping_for_unknown_model_outputs():
    """Verify invalid root cause or action strings are normalized to UNKNOWN / ESCALATE."""
    mock = MockGeminiProvider(
        fixed_response=json.dumps({
            "root_cause": "NON_EXISTENT_CAUSE",
            "confidence": 1.75,  # Exceeds 1.0
            "recommendation": "NON_EXISTENT_ACTION",
            "reason": "Test non-existent action",
            "signals": ["signal_1"],
        })
    )

    result = await classify_recovery_signal(
        scenario_type="FAILED_SUBSCRIPTION",
        failure_code="UNKNOWN_ERROR",
        failure_reason="Something strange",
        payment_method="card",
        amount=1000.0,
        customer_history={},
        provider=mock,
    )

    assert result.root_cause == "UNKNOWN"
    assert result.recommendation == "ESCALATE"
    assert result.confidence == 1.0  # Clamped to max 1.0
    assert result.is_fallback is False


@pytest.mark.asyncio
async def test_real_provider_lazy_initialization_and_key_enforcement():
    """Verify RealGeminiProvider enforces API key requirement when invoked."""
    real_provider_no_key = RealGeminiProvider(api_key="")

    with pytest.raises(ValueError, match="GEMINI_API_KEY is required"):
        await real_provider_no_key.generate_content("Hello")

    # In classify_recovery_signal, invoking RealGeminiProvider without key falls back gracefully
    result = await classify_recovery_signal(
        scenario_type="FAILED_SUBSCRIPTION",
        failure_code="CARD_DECLINED",
        failure_reason="Card declined by issuer",
        payment_method="card",
        amount=3000.0,
        customer_history={},
        provider=real_provider_no_key,
    )

    assert result.is_fallback is True
    assert result.root_cause == "CARD_DECLINED"


def test_provider_factory_resolution():
    """Verify get_gemini_provider respects AI_PROVIDER setting."""
    orig_provider = settings.ai_provider

    try:
        settings.ai_provider = "mock"
        set_gemini_provider(None)
        p = get_gemini_provider()
        assert isinstance(p, MockGeminiProvider)

        settings.ai_provider = "gemini"
        set_gemini_provider(None)
        p2 = get_gemini_provider()
        assert isinstance(p2, RealGeminiProvider)

        # Custom dependency injection
        custom = MockGeminiProvider()
        set_gemini_provider(custom)
        assert get_gemini_provider() is custom

    finally:
        settings.ai_provider = orig_provider
        set_gemini_provider(None)
