from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.domain import AIOutputLog, AuditLog, CeoBrief, Contract, Document, GapAnalysis, RiskIssue, User
from app.schemas.domain import CeoBriefGenerateRequest, CeoBriefRead, GapRunRequest, RiskIssueRead
from app.services.audit import audit
from app.services.briefs import generate_ceo_brief
from app.services.gap_analysis import run_topic_gap_analysis


router = APIRouter(tags=["Workflows"])


@router.post("/gap-analysis/run-topic")
def run_topic(payload: GapRunRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return run_topic_gap_analysis(db, payload.contract_id, payload.topic_key)


@router.post("/gap-analysis/run-contract")
def run_contract(payload: dict, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    contract_id = int(payload["contract_id"])
    topics = payload.get("topic_keys") or ["p1_response_time", "price_escalation", "expansion_right", "sla_credit", "remote_hands", "smart_hands"]
    return [run_topic_gap_analysis(db, contract_id, topic) for topic in topics]


@router.get("/gap-analysis/{contract_id}")
def get_gap_analyses(contract_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(GapAnalysis).filter(GapAnalysis.contract_id == contract_id).order_by(GapAnalysis.id).all()


@router.get("/risk-issues", response_model=list[RiskIssueRead])
def list_risk_issues(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(RiskIssue).order_by(RiskIssue.id).all()


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
def create_ceo_brief(payload: CeoBriefGenerateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = generate_ceo_brief(db, payload.title, payload.scope_description, payload.risk_issue_ids, user.id)
    audit(db, user.id, "generate", "ceo_brief", row.id, {"risk_issue_ids": row.source_risk_issue_ids})
    return row


@router.get("/ceo-briefs", response_model=list[CeoBriefRead])
def list_ceo_briefs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(CeoBrief).order_by(CeoBrief.id).all()


@router.get("/ceo-briefs/{brief_id}", response_model=CeoBriefRead)
def get_ceo_brief(brief_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(CeoBrief, brief_id)
    if not row:
        raise HTTPException(status_code=404, detail="CEO brief not found")
    return row


@router.get("/audit-logs")
def audit_logs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).limit(200).all()


@router.get("/ai-output-logs")
def ai_output_logs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(AIOutputLog).order_by(AIOutputLog.id.desc()).limit(200).all()


@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return {
        "contracts": db.query(Contract).count(),
        "documents": db.query(Document).count(),
        "risk_issues": db.query(RiskIssue).count(),
        "high_risk_issues": db.query(RiskIssue).filter(RiskIssue.risk_level.in_(["HIGH", "CRITICAL"])).count(),
    }


@router.get("/dashboard/vendor-risks")
def vendor_risks(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(RiskIssue.vendor_id, RiskIssue.risk_level).all()
    return [{"vendor_id": vendor_id, "risk_level": risk_level} for vendor_id, risk_level in rows]


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
