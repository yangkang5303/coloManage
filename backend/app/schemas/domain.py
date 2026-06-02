from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserRead(ORMModel):
    id: int
    email: str
    full_name: str | None = None
    role: str
    created_at: datetime


class VendorCreate(BaseModel):
    name: str
    description: str | None = None
    country: str | None = None


class VendorRead(VendorCreate, ORMModel):
    id: int
    created_at: datetime


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectRead(ProjectCreate, ORMModel):
    id: int
    created_at: datetime


class SiteCreate(BaseModel):
    name: str
    location: str | None = None
    vendor_id: int | None = None
    project_id: int | None = None


class SiteRead(SiteCreate, ORMModel):
    id: int
    created_at: datetime


class ContractCreate(BaseModel):
    title: str
    vendor_id: int | None = None
    project_id: int | None = None
    site_id: int | None = None
    effective_date: date | None = None
    expiry_date: date | None = None
    status: str = "draft"


class ContractRead(ContractCreate, ORMModel):
    id: int
    created_at: datetime


class DocumentRead(ORMModel):
    id: int
    title: str
    document_type: str
    vendor_id: int | None = None
    project_id: int | None = None
    site_id: int | None = None
    contract_id: int | None = None
    original_filename: str | None = None
    processing_status: str
    uploaded_at: datetime


class ChunkRead(ORMModel):
    id: int
    document_id: int
    chunk_index: int
    page_number: int | None = None
    sheet_name: str | None = None
    section_title: str | None = None
    clause_reference: str | None = None
    text: str
    created_at: datetime


class SearchChunksRequest(BaseModel):
    query: str
    contract_id: int | None = None
    document_type: str | None = None
    limit: int = Field(default=10, ge=1, le=50)


class TopicRequest(BaseModel):
    topic_key: str
    contract_id: int | None = None


class ChatRequest(BaseModel):
    question: str
    contract_id: int | None = None
    topic_key: str | None = None


class GapRunRequest(BaseModel):
    contract_id: int
    topic_key: str


class RiskIssueRead(ORMModel):
    id: int
    contract_id: int | None = None
    vendor_id: int | None = None
    site_id: int | None = None
    issue_title: str
    issue_type: str
    risk_level: str
    evidence_strength: str
    ai_assessment: str | None = None
    rule_assessment: str | None = None
    recommended_next_action: str | None = None
    related_evidence_json: dict | list | None = None
    human_review_status: str
    created_at: datetime
    updated_at: datetime


class CeoBriefGenerateRequest(BaseModel):
    title: str = "CEO Risk Brief"
    scope_description: str | None = None
    risk_issue_ids: list[int] | None = None


class CeoBriefRead(ORMModel):
    id: int
    title: str
    scope_description: str | None = None
    brief_markdown: str
    source_risk_issue_ids: list | None = None
    created_by: int | None = None
    created_at: datetime
