"""
Live Gemini Model Integration Test
──────────────────────────────────
Gated behind GitHub Actions secret and @pytest.mark.live_gemini.
Will SKIPPED if GEMINI_API_KEY is not set.
Never executes during normal CI.
"""

import os
import pytest
from app.ai.classifier import classify_recovery_signal, ROOT_CAUSES, ACTIONS
from app.ai.provider import RealGeminiProvider
from app.core.config import settings


@pytest.mark.live_gemini
@pytest.mark.asyncio
async def test_live_gemini_classification():
    """
    Execute real Gemini API call against Google's live endpoint.
    Only executed when GEMINI_API_KEY is present and --run-live-gemini or -m live_gemini is specified.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or settings.gemini_api_key
    if not api_key:
        pytest.skip("GEMINI_API_KEY is not configured. Skipping live Gemini test.")

    provider = RealGeminiProvider(api_key=api_key, model_name="gemini-1.5-flash")

    result = await classify_recovery_signal(
        scenario_type="FAILED_SUBSCRIPTION",
        failure_code="BAD_REQUEST_ERROR",
        failure_reason="Insufficient balance in customer bank account",
        payment_method="upi_autopay",
        amount=145000.0,
        customer_history={"risk_segment": "LOW", "successful_payments": 12},
        attempt_count=1,
        provider=provider,
    )

    assert result.is_fallback is False, "Live Gemini should return a direct model classification, not fallback."
    assert result.root_cause in ROOT_CAUSES, f"Unexpected root cause: {result.root_cause}"
    assert result.recommendation in ACTIONS, f"Unexpected recommendation: {result.recommendation}"
    assert 0.0 <= result.confidence <= 1.0, f"Confidence out of bounds: {result.confidence}"
    assert len(result.reason) > 0, "Reason must not be empty"
