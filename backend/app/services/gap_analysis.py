from sqlalchemy.orm import Session

from app.models.domain import Contract, GapAnalysis, RiskIssue
from app.services.llm_gateway import LLMGateway
from app.services.retrieval import get_evidence_pack
from app.services.rules import run_rule_engine


def run_topic_gap_analysis(db: Session, contract_id: int, topic_key: str) -> dict:
    contract = db.get(Contract, contract_id)
    evidence_pack = get_evidence_pack(db, topic_key, contract_id)
    cited_chunk_ids = [item["chunk_id"] for key, values in evidence_pack.items() if key.endswith("_evidence") for item in values]
    ai = LLMGateway(db).run("compare_topic_evidence", evidence_pack, cited_chunk_ids=cited_chunk_ids)
    rules = run_rule_engine(topic_key, evidence_pack)

    rfp_found = bool(evidence_pack["rfp_evidence"])
    proposal_found = bool(evidence_pack["proposal_evidence"])
    contract_found = bool(evidence_pack["contract_evidence"] or evidence_pack["sla_evidence"])
    gap_type = rules["issue_type"] if rules["issue_type"] != "NEEDS_REVIEW" else ai.get("gap_type", "NEEDS_REVIEW")
    summary = ai.get("summary") or rules["rule_assessment"]
    human_review_required = bool(rules["human_review_required"] or ai.get("human_review_required", True))

    gap = GapAnalysis(
        contract_id=contract_id,
        topic_key=topic_key,
        rfp_requirement_found=rfp_found,
        proposal_commitment_found=proposal_found,
        contract_commitment_found=contract_found and rules["issue_type"] not in {"RFP_CONTRACT_GAP", "COMMITMENT_WEAKENED", "EXPANSION_RIGHT_GAP"},
        gap_type=gap_type,
        summary=summary,
        evidence_json=evidence_pack,
        confidence_score=max(float(ai.get("confidence_score", 0.0) or 0.0), rules["confidence_score"]),
        human_review_required=human_review_required,
    )
    db.add(gap)
    db.commit()
    db.refresh(gap)

    risk_issue = None
    if gap_type not in {"INCLUDED", "EVIDENCE_NOT_FOUND"}:
        risk_issue = RiskIssue(
            contract_id=contract_id,
            vendor_id=contract.vendor_id if contract else None,
            site_id=contract.site_id if contract else None,
            issue_title=f"{topic_key}: {gap_type}",
            issue_type=gap_type,
            risk_level=rules["risk_level"],
            evidence_strength="high" if cited_chunk_ids else "low",
            ai_assessment=ai.get("summary") or ai.get("ai_assessment"),
            rule_assessment=rules["rule_assessment"],
            recommended_next_action="Human reviewer should verify cited evidence before any supplier communication.",
            related_evidence_json=evidence_pack,
            human_review_status="pending",
        )
        db.add(risk_issue)
        db.commit()
        db.refresh(risk_issue)

    return {
        "topic_key": topic_key,
        "rfp_requirement_found": rfp_found,
        "proposal_commitment_found": proposal_found,
        "contract_commitment_found": gap.contract_commitment_found,
        "gap_type": gap_type,
        "risk_level": rules["risk_level"],
        "summary": summary,
        "evidence": evidence_pack,
        "rule_assessment": rules["rule_assessment"],
        "ai_assessment": ai,
        "confidence_score": gap.confidence_score,
        "human_review_required": human_review_required,
        "gap_analysis_id": gap.id,
        "risk_issue_id": risk_issue.id if risk_issue else None,
    }
