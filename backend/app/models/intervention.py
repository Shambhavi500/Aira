import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class Intervention(Base):
    __tablename__ = "interventions"

    id = Column(String, primary_key=True, default=gen_id)
    case_id = Column(String, ForeignKey("recovery_cases.id"), nullable=False)
    action = Column(String, nullable=False)         # RETRY, SEND_PAYMENT_LINK, SEND_REMINDER,
                                                     # ESCALATE, STOP, UPDATE_METHOD,
                                                     # MANDATE_REREGISTER, MANUAL_REVIEW
    channel = Column(String)                         # system, email, sms, whatsapp, voice, manual
    requested_at = Column(DateTime, default=datetime.utcnow)
    policy_decision_id = Column(String, ForeignKey("policy_decisions.id"), nullable=True)
    executed_at = Column(DateTime)
    result = Column(String)                          # SUCCESS, FAILED, TIMEOUT,
                                                     # CUSTOMER_ACTION_REQUIRED, POLICY_BLOCKED,
                                                     # PENDING
    amount_recovered = Column(Float, default=0.0)
    simulator_seed = Column(Integer)                 # seed used for deterministic simulation
    notes = Column(Text)

    # Relationships
    case = relationship("RecoveryCase", back_populates="interventions")
    policy_decision = relationship("PolicyDecision", back_populates="interventions")
