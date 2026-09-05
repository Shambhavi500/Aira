import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class CheckoutSession(Base):
    __tablename__ = "checkout_sessions"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    cart_value = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    items_summary = Column(String)                     # e.g., "Apple MacBook Pro 16", AirPods Max"
    dropoff_step = Column(String, default="payment")   # cart, details, payment_method, otp_auth, bank_redirect
    payment_method = Column(String, default="upi")     # upi, card, netbanking, emi
    dropoff_reason = Column(String)                    # OTP_NOT_ENTERED, 3DS_TIMEOUT, PAYMENT_REJECTED, CART_ABANDONED
    status = Column(String, default="abandoned")       # abandoned, link_sent, retrying, recovered, escalated, expired
    payment_link_url = Column(String)
    reminder_count = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    recovered_amount = Column(Float, default=0.0)
    recovery_duration_minutes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    recovered_at = Column(DateTime)
    case_id = Column(String, ForeignKey("recovery_cases.id"), nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="checkout_sessions")
    case = relationship("RecoveryCase", back_populates="checkout_sessions")

