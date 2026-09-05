from fastapi import APIRouter
from app.api.routes import (
    health,
    metrics,
    cases,
    policy,
    seed,
    evaluation,
    payment_health,
    subscriptions,
    checkout,
    invoices,
    promises,
    mandates,
    voice,
    conversations,
    analytics,
    search,
    assistant,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(metrics.router)
api_router.include_router(cases.router)
api_router.include_router(policy.router)
api_router.include_router(seed.router)
api_router.include_router(evaluation.router)
api_router.include_router(payment_health.router)
api_router.include_router(subscriptions.router)
api_router.include_router(checkout.router)
api_router.include_router(invoices.router)
api_router.include_router(promises.router)
api_router.include_router(mandates.router)
api_router.include_router(voice.router)
api_router.include_router(conversations.router)
api_router.include_router(analytics.router)
api_router.include_router(search.router)
api_router.include_router(assistant.router)
