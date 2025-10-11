"""SQLAlchemy ORM models for core UX writer workflow entities."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import JSON, Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base


class UserRole(str, Enum):
    DESIGNER = "designer"
    WRITER = "writer"
    ADMIN = "admin"


class RequestStatus(str, Enum):
    DRAFTING = "drafting"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class DraftGenerationMethod(str, Enum):
    AI = "ai"
    MANUAL = "manual"


class CommentStatus(str, Enum):
    OPEN = "open"
    RESOLVED = "resolved"


class ApprovalDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


class StyleGuideEntry(Base):
    __tablename__ = "style_guide_entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    device: Mapped[Optional[str]] = mapped_column(String(64))
    feature_norm: Mapped[Optional[str]] = mapped_column(String(255))
    style_tag: Mapped[Optional[str]] = mapped_column(String(255))
    tone: Mapped[Optional[str]] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GlossaryEntry(Base):
    __tablename__ = "glossary_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_language: Mapped[str] = mapped_column(String(16), nullable=False, default="ko")
    target_language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    source_term: Mapped[str] = mapped_column(String(255), nullable=False)
    target_term: Mapped[str] = mapped_column(String(255), nullable=False)
    device: Mapped[Optional[str]] = mapped_column(String(64))
    must_use: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    part_of_speech: Mapped[Optional[str]] = mapped_column(String(64))
    synonyms: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ContextSnippet(Base):
    __tablename__ = "context_snippets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    device: Mapped[Optional[str]] = mapped_column(String(64))
    feature: Mapped[Optional[str]] = mapped_column(String(255))
    feature_norm: Mapped[Optional[str]] = mapped_column(String(255))
    style_tag: Mapped[Optional[str]] = mapped_column(String(255))
    user_utterance: Mapped[Optional[str]] = mapped_column(Text)
    response_case_raw: Mapped[Optional[str]] = mapped_column(String(255))
    response_case_norm: Mapped[Optional[str]] = mapped_column(String(255))
    response_case_tags: Mapped[Optional[List[str]]] = mapped_column(JSON)
    response_text: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GuardrailScope(str, Enum):
    GLOBAL = "global"
    FEATURE = "feature"
    REQUEST = "request"


class GuardrailRuleType(str, Enum):
    FORBIDDEN_TERM = "forbidden_term"
    REPLACE = "replace"
    LENGTH = "length"
    STYLE = "style"


class RagSourceType(str, Enum):
    STYLE_GUIDE = "style_guide"
    APPROVED_STRING = "approved_string"
    GLOSSARY = "glossary"
    CONTEXT = "context"


class ExportFormat(str, Enum):
    CSV = "csv"
    DOCX = "docx"
    NOTION = "notion"


class ExportStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole, name="user_role"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    requests: Mapped[List["Request"]] = relationship(
        back_populates="requested_by_user",
        cascade="all, delete-orphan",
        foreign_keys="Request.requested_by",
    )
    assigned_requests: Mapped[List["Request"]] = relationship(
        back_populates="assigned_writer_user",
        foreign_keys="Request.assigned_writer_id",
    )
    drafts: Mapped[List["Draft"]] = relationship(back_populates="created_by_user")
    comments: Mapped[List["Comment"]] = relationship(back_populates="author")


class Request(Base):
    __tablename__ = "requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    feature_name: Mapped[str] = mapped_column(String(255), nullable=False)
    context_description: Mapped[Optional[str]] = mapped_column(Text)
    source_text: Mapped[Optional[str]] = mapped_column(Text)
    tone: Mapped[Optional[str]] = mapped_column(String(255))
    style_preferences: Mapped[Optional[str]] = mapped_column(Text)
    constraints_json: Mapped[Optional[dict]] = mapped_column(JSON)
    status: Mapped[RequestStatus] = mapped_column(SQLEnum(RequestStatus, name="request_status"), default=RequestStatus.DRAFTING, nullable=False)
    requested_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_writer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    requested_by_user: Mapped[User] = relationship(back_populates="requests", foreign_keys=[requested_by])
    assigned_writer_user: Mapped[Optional[User]] = relationship(back_populates="assigned_requests", foreign_keys=[assigned_writer_id])
    drafts: Mapped[List["Draft"]] = relationship(back_populates="request", cascade="all, delete-orphan")
    approvals: Mapped[List["Approval"]] = relationship(back_populates="request", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship(back_populates="request", cascade="all, delete-orphan")


class Draft(Base):
    __tablename__ = "drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("requests.id"), nullable=False)
    llm_run_id: Mapped[Optional[str]] = mapped_column(String(255))
    generation_method: Mapped[DraftGenerationMethod] = mapped_column(SQLEnum(DraftGenerationMethod, name="draft_generation_method"), default=DraftGenerationMethod.AI, nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request: Mapped[Request] = relationship(back_populates="drafts")
    created_by_user: Mapped[User] = relationship(back_populates="drafts")
    versions: Mapped[List["DraftVersion"]] = relationship(
        back_populates="draft",
        cascade="all, delete-orphan"
    )


class DraftVersion(Base):
    __tablename__ = "draft_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    draft_id: Mapped[str] = mapped_column(String(36), ForeignKey("drafts.id"), nullable=False)
    version_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    draft: Mapped[Draft] = relationship(back_populates="versions")
    author: Mapped[User] = relationship()
    comments: Mapped[List["Comment"]] = relationship(back_populates="draft_version", cascade="all, delete-orphan")


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("requests.id"), nullable=False)
    decision: Mapped[ApprovalDecision] = mapped_column(SQLEnum(ApprovalDecision, name="approval_decision"), nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    decided_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request: Mapped[Request] = relationship(back_populates="approvals")
    decider: Mapped[User] = relationship()


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("requests.id"), nullable=False)
    draft_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("draft_versions.id"))
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[CommentStatus] = mapped_column(SQLEnum(CommentStatus, name="comment_status"), default=CommentStatus.OPEN, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    request: Mapped[Request] = relationship(back_populates="comments")
    draft_version: Mapped[Optional[DraftVersion]] = relationship(back_populates="comments")
    author: Mapped[User] = relationship(back_populates="comments")


class GuardrailRule(Base):
    __tablename__ = "guardrail_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scope: Mapped[GuardrailScope] = mapped_column(SQLEnum(GuardrailScope, name="guardrail_scope"), nullable=False)
    rule_type: Mapped[GuardrailRuleType] = mapped_column(SQLEnum(GuardrailRuleType, name="guardrail_rule_type"), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RagIngestion(Base):
    __tablename__ = "rag_ingestions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_type: Mapped[RagSourceType] = mapped_column(SQLEnum(RagSourceType, name="rag_source_type"), nullable=False)
    source_id: Mapped[Optional[str]] = mapped_column(String(255))
    version: Mapped[Optional[str]] = mapped_column(String(128))
    embedding_vector_id: Mapped[Optional[str]] = mapped_column(String(255))
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("requests.id"), nullable=False)
    format: Mapped[ExportFormat] = mapped_column(SQLEnum(ExportFormat, name="export_format"), nullable=False)
    status: Mapped[ExportStatus] = mapped_column(SQLEnum(ExportStatus, name="export_status"), default=ExportStatus.PENDING, nullable=False)
    result_url: Mapped[Optional[str]] = mapped_column(String(512))
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    request: Mapped[Request] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON)
    actor_id: Mapped[Optional[str]] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


__all__ = [
    "User",
    "Request",
    "Draft",
    "DraftVersion",
    "Approval",
    "Comment",
    "StyleGuideEntry",
    "GlossaryEntry",
    "ContextSnippet",
    "GuardrailRule",
    "RagIngestion",
    "ExportJob",
    "AuditLog",
    "UserRole",
    "RequestStatus",
    "DraftGenerationMethod",
    "CommentStatus",
    "ApprovalDecision",
    "GuardrailScope",
    "GuardrailRuleType",
    "RagSourceType",
    "ExportFormat",
    "ExportStatus",
]
