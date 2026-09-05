"""
Gemini Provider Abstraction Layer for AIRA
─────────────────────────────────────────
Provides a clean interface for Gemini AI interactions with:
- RealGeminiProvider: Production provider using google.generativeai with lazy initialization.
- MockGeminiProvider: Deterministic, offline mock provider for tests and CI without API keys.
"""

import json
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import Optional, Any, Dict, List

logger = logging.getLogger(__name__)


class GeminiProvider(ABC):
    """Abstract interface for Gemini model providers."""

    @abstractmethod
    async def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate text content given a prompt.
        Must return the raw response string (e.g. JSON string).
        """
        pass


class RealGeminiProvider(GeminiProvider):
    """
    Production Gemini provider using Google Generative AI SDK.
    Initializes lazily only when generate_content is invoked to prevent
    unnecessary startup errors when GEMINI_API_KEY is not configured.
    """

    def __init__(self, api_key: str = "", model_name: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model_name = model_name
        self._model = None

    def _get_model(self):
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY is required to initialize RealGeminiProvider. "
                "For local testing and CI, use AI_PROVIDER=mock."
            )
        if self._model is None:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            self._model = genai.GenerativeModel(self.model_name)
        return self._model

    async def generate_content(self, prompt: str, **kwargs) -> str:
        model = self._get_model()
        import google.generativeai as genai

        generation_config = genai.types.GenerationConfig(
            temperature=kwargs.get("temperature", 0.1),
            max_output_tokens=kwargs.get("max_output_tokens", 512),
        )

        response = await asyncio.to_thread(
            model.generate_content,
            prompt,
            generation_config=generation_config,
        )
        return response.text.strip()


class MockGeminiProvider(GeminiProvider):
    """
    Deterministic mock provider for CI, unit testing, and contract verification.
    Requires NO Gemini API key, performs NO network requests, and returns
    reproducible structured responses matching AIRA's expected schemas.
    """

    def __init__(
        self,
        fixed_response: Optional[str] = None,
        should_fail: bool = False,
        failure_error: Optional[Exception] = None,
    ):
        self.fixed_response = fixed_response
        self.should_fail = should_fail
        self.failure_error = failure_error
        self.call_history: List[Dict[str, Any]] = []

    def set_fixed_response(self, response: Optional[str]) -> None:
        self.fixed_response = response

    def set_failure(self, should_fail: bool, error: Optional[Exception] = None) -> None:
        self.should_fail = should_fail
        self.failure_error = error

    def clear_history(self) -> None:
        self.call_history.clear()

    async def generate_content(self, prompt: str, **kwargs) -> str:
        self.call_history.append({"prompt": prompt, "kwargs": kwargs})

        if self.should_fail:
            raise self.failure_error or RuntimeError("Simulated Gemini API error")

        if self.fixed_response is not None:
            return self.fixed_response

        # Deterministic simulation matching AIRA failure patterns
        p_lower = prompt.lower()

        if "insufficient" in p_lower or "bad_request_error" in p_lower:
            payload = {
                "root_cause": "INSUFFICIENT_FUNDS",
                "confidence": 0.94,
                "recommendation": "RETRY",
                "reason": "Customer account balance was insufficient at charge presentation; optimal salary liquidity window recommended for smart retry.",
                "signals": ["failure_code=BAD_REQUEST_ERROR", "insufficient_balance_indicator", "liquidity_recovery_eligible"],
            }
        elif "card_expired" in p_lower or "expired" in p_lower:
            payload = {
                "root_cause": "CARD_EXPIRED",
                "confidence": 0.96,
                "recommendation": "UPDATE_PAYMENT_METHOD",
                "reason": "Card validity period expired; automated card update link dispatched to cardholder.",
                "signals": ["failure_code=CARD_EXPIRED", "expired_card_instrument", "card_update_eligible"],
            }
        elif "card_declined" in p_lower or "declined" in p_lower:
            payload = {
                "root_cause": "CARD_DECLINED",
                "confidence": 0.88,
                "recommendation": "RETRY",
                "reason": "Issuing bank declined debit attempt; retry scheduled via secondary payment rail.",
                "signals": ["failure_code=CARD_DECLINED", "issuer_declined", "alternate_corridor_candidate"],
            }
        elif "gateway_error" in p_lower or "technical_error" in p_lower or "504" in p_lower:
            payload = {
                "root_cause": "TECHNICAL_ERROR",
                "confidence": 0.91,
                "recommendation": "RETRY",
                "reason": "Payment gateway corridor degradation observed; autonomous rail failover activated.",
                "signals": ["failure_code=GATEWAY_ERROR", "corridor_latency_spike", "rail_failover_triggered"],
            }
        elif "timeout" in p_lower or "network_error" in p_lower:
            payload = {
                "root_cause": "NETWORK_TIMEOUT",
                "confidence": 0.89,
                "recommendation": "RETRY",
                "reason": "Upstream bank switch network timeout; automated retry scheduled during lower congestion window.",
                "signals": ["failure_code=NETWORK_ERROR", "switch_timeout", "backoff_applied"],
            }
        elif "invalid_mandate" in p_lower or "mandate" in p_lower:
            payload = {
                "root_cause": "MANDATE_INVALID",
                "confidence": 0.93,
                "recommendation": "MANDATE_REREGISTER",
                "reason": "Recurring debit mandate inactive or expired under RBI rules; mandate re-registration link dispatched.",
                "signals": ["failure_code=INVALID_MANDATE", "rbi_mandate_compliance", "reregistration_required"],
            }
        elif "payment_cancelled" in p_lower or "abandon" in p_lower or "checkout_dropoff" in p_lower:
            payload = {
                "root_cause": "CUSTOMER_ABANDONED",
                "confidence": 0.92,
                "recommendation": "SEND_PAYMENT_LINK",
                "reason": "Customer abandoned checkout session before completion; 1-click Razorpay payment link generated.",
                "signals": ["failure_code=PAYMENT_CANCELLED", "dropoff_recovery", "smart_link_eligible"],
            }
        elif "authentication_failed" in p_lower or "auth" in p_lower or "otp" in p_lower:
            payload = {
                "root_cause": "AUTHENTICATION_FAILED",
                "confidence": 0.85,
                "recommendation": "ESCALATE",
                "reason": "Two-factor authentication repeatedly failed; account escalated for operator assistance.",
                "signals": ["failure_code=AUTHENTICATION_FAILED", "otp_failure", "human_operator_review"],
            }
        else:
            payload = {
                "root_cause": "UNKNOWN",
                "confidence": 0.40,
                "recommendation": "ESCALATE",
                "reason": "Telemetry did not match standard failure patterns; case escalated for manual inspection.",
                "signals": ["unrecognized_pattern", "manual_investigation_required"],
            }

        return json.dumps(payload)


_active_provider: Optional[GeminiProvider] = None


def get_gemini_provider() -> GeminiProvider:
    """
    Returns the active Gemini provider based on application configuration.
    Controlled explicitly via AI_PROVIDER setting ("mock" | "gemini" | "auto").
    """
    global _active_provider
    if _active_provider is not None:
        return _active_provider

    from app.core.config import settings

    provider_type = (settings.ai_provider or "").strip().lower()

    if provider_type == "gemini":
        return RealGeminiProvider(api_key=settings.gemini_api_key)
    elif provider_type == "mock":
        return MockGeminiProvider()
    elif provider_type == "auto":
        if settings.gemini_api_key:
            return RealGeminiProvider(api_key=settings.gemini_api_key)
        return MockGeminiProvider()
    else:
        # Default safe mock provider
        return MockGeminiProvider()


def set_gemini_provider(provider: Optional[GeminiProvider]) -> None:
    """Explicitly set or reset the active Gemini provider (primarily for tests)."""
    global _active_provider
    _active_provider = provider
