from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.domain import AIOutputLog, AuditLog, CeoBrief, Contract, Document, GapAnalysis, Project, RiskIssue, Site, User, Vendor
from app.core.config import get_settings
from app.schemas.domain import CeoBriefGenerateRequest, CeoBriefRead, GapRunRequest, RiskIssueRead, RunContractRequest
from app.services.audit import audit
from app.services.briefs import generate_ceo_brief
from app.services.gap_analysis import run_topic_gap_analysis


limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["Workflows"])


@router.post("/gap-analysis/run-topic")
@limiter.limit(lambda: get_settings().ai_rate_limit)
async def run_topic(request: Request, payload: GapRunRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return await run_topic_gap_analysis(db, payload.contract_id, payload.topic_key)


_DEFAULT_TOPICS = ["p1_response_time", "price_escalation", "expansion_right", "sla_credit", "remote_hands", "smart_hands"]


@router.post("/gap-analysis/run-contract")
@limiter.limit(lambda: get_settings().ai_rate_limit)
async def run_contract(request: Request, payload: RunContractRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    topics = payload.topic_keys or _DEFAULT_TOPICS
    results = []
    for topic in topics:
        try:
            result = await run_topic_gap_analysis(db, payload.contract_id, topic)
        except Exception as exc:
            result = {"topic_key": topic, "error": str(exc), "status": "failed"}
        results.append(result)
    return results


@router.get("/gap-analysis/{contract_id}")
def get_gap_analyses(contract_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(GapAnalysis).filter(GapAnalysis.contract_id == contract_id).order_by(GapAnalysis.id).all()


@router.get("/risk-issues", response_model=list[RiskIssueRead])
def list_risk_issues(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(RiskIssue).order_by(RiskIssue.id).offset(skip).limit(limit).all()


@router.get("/risk-issues/{issue_id}", response_model=RiskIssueRead)
def get_risk_issue(issue_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    issue = db.get(RiskIssue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Risk issue not found")
    return issue


@router.post("/risk-issues/{issue_id}/confirm")
def confirm_risk_issue(issue_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _set_issue_status(db, user, issue_id, "confirmed")


@router.post("/risk-issues/{issue_id}/reject")
def reject_risk_issue(issue_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _set_issue_status(db, user, issue_id, "rejected")


@router.post("/risk-issues/{issue_id}/request-legal-review")
def legal_review(issue_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _set_issue_status(db, user, issue_id, "legal_review_requested")


@router.post("/ceo-briefs/generate", response_model=CeoBriefRead)
async def create_ceo_brief(payload: CeoBriefGenerateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = await generate_ceo_brief(db, payload.title, payload.scope_description, payload.risk_issue_ids, user.id)
    audit(db, user.id, "generate", "ceo_brief", row.id, {"risk_issue_ids": row.source_risk_issue_ids})
    return row


@router.get("/ceo-briefs", response_model=list[CeoBriefRead])
def list_ceo_briefs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(CeoBrief).order_by(CeoBrief.id).offset(skip).limit(limit).all()


@router.get("/ceo-briefs/{brief_id}", response_model=CeoBriefRead)
def get_ceo_brief(brief_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(CeoBrief, brief_id)
    if not row:
        raise HTTPException(status_code=404, detail="CEO brief not found")
    return row


@router.get("/audit-logs")
def audit_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    total = db.query(AuditLog).count()
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit, "items": rows}


@router.get("/ai-output-logs")
def ai_output_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(AIOutputLog).order_by(AIOutputLog.id.desc()).offset(skip).limit(limit).all()


@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = get_settings()
    recent_audit = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(5).all()
    recent_ai = db.query(AIOutputLog).order_by(AIOutputLog.id.desc()).limit(5).all()
    return {
        "counts": {
            "vendors": db.query(Vendor).count(),
            "projects": db.query(Project).count(),
            "sites": db.query(Site).count(),
            "contracts": db.query(Contract).count(),
            "documents": db.query(Document).count(),
            "risk_issues": db.query(RiskIssue).count(),
            "high_risk_issues": db.query(RiskIssue).filter(RiskIssue.risk_level.in_(["HIGH", "CRITICAL"])).count(),
            "pending_review": db.query(RiskIssue).filter(RiskIssue.human_review_status == "pending").count(),
            "ai_calls_total": db.query(AIOutputLog).count(),
        },
        "system": {
            "llm_base_url": s.llm_base_url,
            "llm_api_key_set": bool(s.llm_api_key and s.llm_api_key != "changeme"),
            "llm_model": s.llm_medium_model,
            "embedding_enabled": s.embedding_enabled,
            "database_url": __import__("re").sub(r"://[^@]+@", "://***:***@", s.database_url),
        },
        "recent_audit": [
            {"id": r.id, "action": r.action, "entity_type": r.entity_type, "entity_id": r.entity_id, "created_at": r.created_at.isoformat()}
            for r in recent_audit
        ],
        "recent_ai": [
            {"id": r.id, "task_type": r.task_type, "model_name": r.model_name, "confidence_score": r.confidence_score, "human_review_required": r.human_review_required, "created_at": r.created_at.isoformat()}
            for r in recent_ai
        ],
    }


@router.get("/dashboard/vendor-risks")
def vendor_risks(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(RiskIssue.contract_id, RiskIssue.risk_level).all()
    return [{"contract_id": contract_id, "risk_level": risk_level} for contract_id, risk_level in rows]


@router.get("/dashboard/high-risk-issues")
def high_risk_issues(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(RiskIssue).filter(RiskIssue.risk_level.in_(["HIGH", "CRITICAL"])).order_by(RiskIssue.id).all()


@router.get("/dashboard/contracts-expiring")
def contracts_expiring(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Contract).filter(Contract.expiry_date.is_not(None)).order_by(Contract.expiry_date).limit(20).all()


def _set_issue_status(db: Session, user: User, issue_id: int, status: str):
    issue = db.get(RiskIssue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Risk issue not found")
    issue.human_review_status = status
    db.commit()
    db.refresh(issue)
    audit(db, user.id, status, "risk_issue", issue.id, {"human_review_status": status})
    return issue
