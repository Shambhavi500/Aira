import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=gen_id)
    case_id = Column(String, ForeignKey("recovery_cases.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String, nullable=False)     # CASE_CREATED, SIGNAL_RECEIVED,
                                                     # AI_ANALYZED, POLICY_EVALUATED,
                                                     # INTERVENTION_REQUESTED, INTERVENTION_EXECUTED,
                                                     # OUTCOME_RECORDED, CASE_CLOSED, CASE_ESCALATED,
                                                     # PROMISE_CREATED, PROMISE_BROKEN,
                                                     # WEBHOOK_RECEIVED, VOICE_INTERACTION
    actor = Column(String, nullable=False)           # SYSTEM, AI, POLICY_GOVERNOR, USER,
                                                     # RAZORPAY, VOICE_AGENT
    action = Column(String, nullable=False)
    reason = Column(Text)
    metadata_ = Column("metadata", Text)             # JSON blob with extra context

    # Relationships
    case = relationship("RecoveryCase", back_populates="audit_events")
