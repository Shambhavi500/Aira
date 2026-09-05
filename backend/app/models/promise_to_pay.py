import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class PromiseToPay(Base):
    __tablename__ = "promises_to_pay"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True)
    case_id = Column(String, ForeignKey("recovery_cases.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    promise_date = Column(DateTime, nullable=False)
    status = Column(String, default="PROMISED")     # PROMISED, DUE_SOON, DUE_TODAY,
                                                     # BROKEN, FULFILLED, CANCELLED
    promise_source = Column(String, default="manual")   # voice, email, manual, agent
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    fulfilled_at = Column(DateTime)
    follow_up_count = Column(Integer, default=0)
    last_follow_up_at = Column(DateTime)
    notes = Column(String)

    # Relationships
    customer = relationship("Customer", back_populates="promises")
    invoice = relationship("Invoice", back_populates="promises")
    case = relationship("RecoveryCase", back_populates="promises")
