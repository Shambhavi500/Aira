import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    method = Column(String)         # card, upi, netbanking, wallet, emi
    status = Column(String)         # created, authorized, captured, failed, refunded
    created_at = Column(DateTime, default=datetime.utcnow)
    failure_code = Column(String)
    failure_reason = Column(Text)
    data_source = Column(String, default="SYNTHETIC")   # SYNTHETIC | RAZORPAY_TEST
    razorpay_payment_id = Column(String)                # set for real Razorpay events
    subscription_id = Column(String, ForeignKey("subscriptions.id"), nullable=True)
    checkout_session_id = Column(String)                # for checkout drop-off tracking

    # Relationships
    customer = relationship("Customer", back_populates="payments")
    subscription = relationship("Subscription", back_populates="payments", foreign_keys=[subscription_id])
