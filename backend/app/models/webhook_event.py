import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String, primary_key=True, default=gen_id)
    event_type = Column(String, nullable=False)         # payment.failed, payment.captured, etc.
    payment_id = Column(String)
    subscription_id = Column(String)
    payload = Column(Text, nullable=False)              # raw JSON payload
    received_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    processing_status = Column(String, default="PENDING")   # PENDING, PROCESSED, FAILED, DUPLICATE
    processing_error = Column(Text)
    idempotency_key = Column(String, unique=True, nullable=False)  # event_id from Razorpay
    data_source = Column(String, default="RAZORPAY_TEST")
