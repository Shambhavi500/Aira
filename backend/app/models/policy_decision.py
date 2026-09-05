import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class PolicyDecision(Base):
    __tablename__ = "policy_decisions"

    id = Column(String, primary_key=True, default=gen_id)
    case_id = Column(String, ForeignKey("recovery_cases.id"), nullable=False)
    recommendation_id = Column(String, ForeignKey("ai_recommendations.id"), nullable=True)
    decision = Column(String, nullable=False)   # ALLOW, BLOCK, ESCALATE
    reason = Column(Text, nullable=False)
    rules_checked = Column(Text)                # JSON array of {rule_key, passed, reason}
    policy_version = Column(String, default="1.0")
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    case = relationship("RecoveryCase", back_populates="policy_decisions")
    recommendation = relationship("AIRecommendation", back_populates="policy_decisions")
    interventions = relationship("Intervention", back_populates="policy_decision")
