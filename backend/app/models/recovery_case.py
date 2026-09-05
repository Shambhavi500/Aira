import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class RecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    source_type = Column(String, nullable=False)    # payment, subscription, invoice, checkout, mandate
    source_id = Column(String, nullable=False)       # ID of the source record
    scenario_type = Column(String, nullable=False)   # PAYMENT_DEGRADATION, CHECKOUT_DROPOFF,
                                                     # FAILED_SUBSCRIPTION, B2B_RECEIVABLE,
                                                     # MANDATE_RETRY, VOICE_RECOVERY, PROMISE_TRACKER
    amount_at_risk = Column(Float, nullable=False)
    amount_recovered = Column(Float, default=0.0)
    root_cause = Column(String)                     # INSUFFICIENT_FUNDS, CARD_EXPIRED, etc.
    status = Column(String, default="OPEN")         # OPEN, IN_PROGRESS, RECOVERED,
                                                     # UNRECOVERABLE, ESCALATED, STOPPED, BLOCKED
    priority = Column(String, default="MEDIUM")     # LOW, MEDIUM, HIGH, CRITICAL
    data_source = Column(String, default="SYNTHETIC")   # SYNTHETIC | RAZORPAY_TEST
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="recovery_cases")
    ai_recommendations = relationship("AIRecommendation", back_populates="case", order_by="AIRecommendation.created_at")
    policy_decisions = relationship("PolicyDecision", back_populates="case", order_by="PolicyDecision.timestamp")
    interventions = relationship("Intervention", back_populates="case", order_by="Intervention.requested_at")
    audit_events = relationship("AuditEvent", back_populates="case", order_by="AuditEvent.timestamp")
    promises = relationship("PromiseToPay", back_populates="case")
    checkout_sessions = relationship("CheckoutSession", back_populates="case")

