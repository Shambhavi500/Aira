import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    plan = Column(String, nullable=False)           # plan name/id
    amount = Column(Float, nullable=False)
    frequency = Column(String, nullable=False)       # monthly, quarterly, yearly
    status = Column(String, default="active")        # active, paused, cancelled, halted, expired
    mandate_id = Column(String)                      # UPI/e-mandate id
    mandate_status = Column(String)                  # active, paused, revoked, pending
    mandate_type = Column(String)                    # e_mandate, upi_autopay
    retry_count = Column(String, default="0")        # stored as string for safety
    last_charge_at = Column(DateTime)
    next_charge_at = Column(DateTime)
    data_source = Column(String, default="SYNTHETIC")
    razorpay_subscription_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="subscriptions")
    payments = relationship("Payment", back_populates="subscription", foreign_keys="Payment.subscription_id")
