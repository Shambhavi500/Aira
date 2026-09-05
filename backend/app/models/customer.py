import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String)
    language_preference = Column(String, default="en")      # en, hi, hinglish
    risk_segment = Column(String, default="MEDIUM")         # LOW, MEDIUM, HIGH, CRITICAL
    data_source = Column(String, default="SYNTHETIC")       # SYNTHETIC | RAZORPAY_TEST
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    payments = relationship("Payment", back_populates="customer")
    subscriptions = relationship("Subscription", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")
    recovery_cases = relationship("RecoveryCase", back_populates="customer")
    promises = relationship("PromiseToPay", back_populates="customer")
    checkout_sessions = relationship("CheckoutSession", back_populates="customer")

