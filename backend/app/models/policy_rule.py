import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(String, primary_key=True, default=gen_id)
    rule_key = Column(String, unique=True, nullable=False)  # e.g. max_auto_retries_card
    name = Column(String, nullable=False)
    description = Column(Text)
    source = Column(String)             # RBI, NPCI, Razorpay, Internal
    source_url = Column(String)
    effective_date = Column(DateTime)
    last_verified = Column(DateTime)
    status = Column(String, default="ACTIVE")       # ACTIVE, DEPRECATED, VERIFY_REQUIRED
    rule_type = Column(String, nullable=False)       # REGULATORY, PRODUCT_SAFETY
    config = Column(Text, nullable=False)            # JSON with rule parameters
                                                     # e.g. {"max_retries": 3, "applies_to": ["card"]}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
