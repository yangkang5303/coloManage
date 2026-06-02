from sqlalchemy.orm import Session

from app.models.domain import CeoBrief, RiskIssue
from app.services.llm_gateway import LLMGateway


def generate_ceo_brief(db: Session, title: str, scope_description: str | None, risk_issue_ids: list[int] | None, created_by: int | None) -> CeoBrief:
    query = db.query(RiskIssue)
    if risk_issue_ids:
        query = query.filter(RiskIssue.id.in_(risk_issue_ids))
    issues = query.order_by(RiskIssue.risk_level.desc(), RiskIssue.id).all()
    issue_payload = [
        {
            "id": issue.id,
            "title": issue.issue_title,
            "type": issue.issue_type,
            "risk_level": issue.risk_level,
            "rule_assessment": issue.rule_assessment,
            "ai_assessment": issue.ai_assessment,
            "evidence": issue.related_evidence_json,
            "human_review_status": issue.human_review_status,
        }
        for issue in issues
    ]
    cited = []
    for issue in issues:
        evidence = issue.related_evidence_json or {}
        for key, values in evidence.items():
            if key.endswith("_evidence"):
                cited.extend(item.get("chunk_id") for item in values if item.get("chunk_id"))
    ai = LLMGateway(db).run("generate_ceo_brief", {"risk_issues": issue_payload, "scope": scope_description}, cited_chunk_ids=cited)
    markdown = ai.get("brief_markdown") or _fallback_brief(issue_payload)
    row = CeoBrief(
        title=title,
        scope_description=scope_description,
        brief_markdown=markdown,
        source_risk_issue_ids=[issue.id for issue in issues],
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _fallback_brief(issues: list[dict]) -> str:
    lines = [
        "# CEO Risk Brief",
        "",
        "## Executive Summary",
        "This draft is based only on reviewed risk issue evidence. It is not legal advice and requires human review.",
        "",
        "## Top Risks",
    ]
    for issue in issues:
        lines.append(f"- {issue['risk_level']}: {issue['title']} - {issue.get('rule_assessment') or 'Requires review.'}")
    lines.extend(
        [
            "",
            "## Supplier Risk Overview",
            "See source risk issues for supplier-level evidence.",
            "",
            "## Contract Execution Concerns",
            "Issues listed above may affect contract execution and should be verified by business and legal reviewers.",
            "",
            "## Financial Exposure",
            "Review price escalation and billing anomaly issues where present.",
            "",
            "## Operational Exposure",
            "Review SLA, response time, Smart Hands, and expansion capacity issues where present.",
            "",
            "## Immediate Decisions Required",
            "Confirm ownership for each HIGH risk issue and decide whether legal review is required.",
            "",
            "## Recommended 30-Day Action Plan",
            "1. Verify evidence references.\n2. Confirm commercial impact.\n3. Request legal review for HIGH risks.\n4. Prepare supplier clarification only after human approval.",
            "",
            "## Appendix: Evidence References",
            "Evidence references are stored on each source risk issue.",
        ]
    )
    return "\n".join(lines)
