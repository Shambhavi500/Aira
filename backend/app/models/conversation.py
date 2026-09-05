import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class ConversationThread(Base):
    __tablename__ = "conversation_threads"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    case_id = Column(String, ForeignKey("recovery_cases.id"), nullable=True)
    channel = Column(String, default="whatsapp")  # whatsapp, sms, email, voice
    subject = Column(String)
    status = Column(String, default="OPEN")  # OPEN, RESOLVED, WAITING_CUSTOMER, ESCALATED
    sentiment = Column(String, default="NEUTRAL")  # POSITIVE, NEUTRAL, FRUSTRATED, ANGRY
    intent = Column(String, default="PAYMENT_PROMISE")  # PAYMENT_PROMISE, DISPUTE, LINK_REQUEST, EXTENSION, CALL_BACK
    risk_level = Column(String, default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    outstanding_amount = Column(Float, default=0.0)
    suggested_reply = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer")
    case = relationship("RecoveryCase")
    messages = relationship("ConversationMessage", back_populates="thread", cascade="all, delete-orphan", order_by="ConversationMessage.created_at")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(String, primary_key=True, default=gen_id)
    thread_id = Column(String, ForeignKey("conversation_threads.id"), nullable=False)
    sender = Column(String, default="CUSTOMER")  # CUSTOMER, AIRA_AGENT, HUMAN_OPERATOR, SYSTEM
    content = Column(Text, nullable=False)
    channel = Column(String, default="whatsapp")
    language = Column(String, default="en")  # en, hi, hinglish
    status = Column(String, default="DELIVERED")  # SENT, DELIVERED, READ, FAILED
    metadata_ = Column(Text)  # JSON metadata (payment link, quick replies, audio URI)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    thread = relationship("ConversationThread", back_populates="messages")
