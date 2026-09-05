import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id = Column(String, primary_key=True, default=gen_id)
    case_id = Column(String, ForeignKey("recovery_cases.id"), nullable=False)
    root_cause = Column(String)         # classified root cause
    confidence = Column(Float)          # 0.0 – 1.0
    recommendation = Column(String)     # RETRY, SEND_LINK, ESCALATE, STOP, UPDATE_METHOD,
                                        # SEND_REMINDER, MANDATE_REREGISTER, MANUAL_REVIEW, UNKNOWN
    reason = Column(Text)               # human-readable explanation
    signals = Column(Text)              # JSON array of signal strings
    model_used = Column(String, default="gemini-1.5-flash")
    is_fallback = Column(String, default="false")   # "true" if AI failed and rule-based used
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    case = relationship("RecoveryCase", back_populates="ai_recommendations")
    policy_decisions = relationship("PolicyDecision", back_populates="recommendation")
