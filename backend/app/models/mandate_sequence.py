import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class MandateSequence(Base):
    __tablename__ = "mandate_sequences"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    description = Column(String)
    mandate_type = Column(String, default="upi_autopay")  # upi_autopay, e_mandate, cards
    status = Column(String, default="ACTIVE")  # ACTIVE, PAUSED, DRAFT
    total_steps = Column(Integer, default=4)
    success_rate = Column(Float, default=78.5)
    recovered_volume = Column(Float, default=0.0)
    steps_config = Column(Text)  # JSON array of step definitions
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MandateExecutionLog(Base):
    __tablename__ = "mandate_execution_logs"

    id = Column(String, primary_key=True, default=gen_id)
    sequence_id = Column(String, ForeignKey("mandate_sequences.id"), nullable=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    mandate_id = Column(String, nullable=False)
    mandate_type = Column(String, default="upi_autopay")
    amount = Column(Float, nullable=False)
    current_step = Column(Integer, default=1)
    status = Column(String, default="PENDING")  # PENDING, IN_PROGRESS, SUCCESS, FAILED, ESCALATED
    failure_reason = Column(String)
    next_retry_at = Column(DateTime)
    executed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer")
    sequence = relationship("MandateSequence")
