import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    invoice_number = Column(String)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    due_date = Column(DateTime, nullable=False)
    status = Column(String, default="sent")     # draft, sent, overdue, paid, cancelled
    days_overdue = Column(Integer, default=0)
    description = Column(Text)
    reminder_count = Column(Integer, default=0)
    last_reminder_at = Column(DateTime)
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime)

    # Relationships
    customer = relationship("Customer", back_populates="invoices")
    promises = relationship("PromiseToPay", back_populates="invoice")
