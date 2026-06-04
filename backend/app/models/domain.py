from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="reviewer")


class Vendor(Base, TimestampMixin):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(String(100))


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)


class Site(Base, TimestampMixin):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    location: Mapped[str | None] = mapped_column(String(255))
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))


class Contract(Base, TimestampMixin):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"))
    effective_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(50), default="draft")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    document_type: Mapped[str] = mapped_column(String(50), index=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"))
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"), index=True)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))
    file_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    text_content: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[str] = mapped_column(String(50), default="uploaded")
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    chunks: Mapped[list["DocumentChunk"]] = relationship(cascade="all, delete-orphan")


class DocumentChunk(Base, TimestampMixin):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    page_number: Mapped[int | None] = mapped_column(Integer)
    sheet_name: Mapped[str | None] = mapped_column(String(255))
    section_title: Mapped[str | None] = mapped_column(String(500))
    clause_reference: Mapped[str | None] = mapped_column(String(100))
    text: Mapped[str] = mapped_column(Text)
    search_text: Mapped[str] = mapped_column(Text, default="")
    # Vector embedding (stored as JSON array for SQLite compatibility)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)


class Obligation(Base, TimestampMixin):
    __tablename__ = "obligations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"))
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"))
    obligation_type: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"))
    source_chunk_id: Mapped[int | None] = mapped_column(ForeignKey("document_chunks.id"))
    source_quote: Mapped[str | None] = mapped_column(Text)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    human_review_status: Mapped[str] = mapped_column(String(50), default="pending")


class TopicEvidence(Base, TimestampMixin):
    __tablename__ = "topic_evidence"
    __table_args__ = (Index("ix_topic_evidence_topic_contract", "topic_key", "contract_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic_key: Mapped[str] = mapped_column(String(100), index=True)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"), index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    chunk_id: Mapped[int] = mapped_column(ForeignKey("document_chunks.id"))
    evidence_text: Mapped[str] = mapped_column(Text)
    document_role: Mapped[str] = mapped_column(String(50))
    score: Mapped[float] = mapped_column(Float, default=0.0)


class GapAnalysis(Base, TimestampMixin):
    __tablename__ = "gap_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"), index=True)
    topic_key: Mapped[str] = mapped_column(String(100), index=True)
    rfp_requirement_found: Mapped[bool] = mapped_column(Boolean, default=False)
    proposal_commitment_found: Mapped[bool] = mapped_column(Boolean, default=False)
    contract_commitment_found: Mapped[bool] = mapped_column(Boolean, default=False)
    gap_type: Mapped[str] = mapped_column(String(100))
    summary: Mapped[str] = mapped_column(Text)
    evidence_json: Mapped[dict | list | None] = mapped_column(JSON)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    human_review_required: Mapped[bool] = mapped_column(Boolean, default=True)


class RiskIssue(Base):
    __tablename__ = "risk_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"), index=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"))
    issue_title: Mapped[str] = mapped_column(String(255))
    issue_type: Mapped[str] = mapped_column(String(100), index=True)
    risk_level: Mapped[str] = mapped_column(String(50), index=True)
    evidence_strength: Mapped[str] = mapped_column(String(50), default="medium")
    ai_assessment: Mapped[str | None] = mapped_column(Text)
    rule_assessment: Mapped[str | None] = mapped_column(Text)
    recommended_next_action: Mapped[str | None] = mapped_column(Text)
    related_evidence_json: Mapped[dict | list | None] = mapped_column(JSON)
    human_review_status: Mapped[str] = mapped_column(String(50), default="pending")
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CeoBrief(Base, TimestampMixin):
    __tablename__ = "ceo_briefs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    scope_description: Mapped[str | None] = mapped_column(Text)
    brief_markdown: Mapped[str] = mapped_column(Text)
    source_risk_issue_ids: Mapped[list | None] = mapped_column(JSON)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class AIOutputLog(Base, TimestampMixin):
    __tablename__ = "ai_output_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_type: Mapped[str] = mapped_column(String(100), index=True)
    model_name: Mapped[str] = mapped_column(String(100))
    prompt_version: Mapped[str] = mapped_column(String(50), default="v1")
    input_hash: Mapped[str] = mapped_column(String(128), index=True)
    input_preview: Mapped[str | None] = mapped_column(Text)
    output_text: Mapped[str | None] = mapped_column(Text)
    output_json: Mapped[dict | list | None] = mapped_column(JSON)
    cited_chunk_ids: Mapped[list | None] = mapped_column(JSON)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    human_review_required: Mapped[bool] = mapped_column(Boolean, default=True)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(100), index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    before_value: Mapped[dict | list | None] = mapped_column(JSON)
    after_value: Mapped[dict | list | None] = mapped_column(JSON)
