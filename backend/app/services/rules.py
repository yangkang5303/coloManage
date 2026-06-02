import re


HIGH_TOPICS = {"availability_sla", "price_escalation", "termination", "liability_cap", "power_capacity", "expansion_right", "p1_response_time", "sla_credit"}
MUST_RE = re.compile(r"\b(must|shall|required|mandatory)\b", re.I)
COMMIT_RE = re.compile(r"\b(comply|included|yes|committed|commitment|will provide|shall)\b", re.I)
NUMERIC_SLA_RE = re.compile(r"\b(\d+\s*minutes?|\d+(?:\.\d+)?%)\b", re.I)
BEST_EFFORT_RE = re.compile(r"\b(best effort|reasonable effort|commercially reasonable effort|commercially reasonable)\b", re.I)
PRICE_RE = re.compile(r"\b(CPI\s*\+\s*\d+%|annual increase|supplier may adjust price|price adjustment|escalation)\b", re.I)
EXPANSION_RE = re.compile(r"\b(future expansion|reserved capacity|expansion right|additional rack|additional power)\b", re.I)
CREDIT_RE = re.compile(r"\b(service credit|SLA credit|compensation|liquidated damages)\b", re.I)


def run_rule_engine(topic_key: str, evidence_pack: dict) -> dict:
    rfp_text = _join(evidence_pack.get("rfp_evidence", []))
    proposal_text = _join(evidence_pack.get("proposal_evidence", []))
    contract_text = _join(evidence_pack.get("contract_evidence", []) + evidence_pack.get("sla_evidence", []))
    rate_card_text = _join(evidence_pack.get("rate_card_evidence", []))

    if not any([rfp_text, proposal_text, contract_text, rate_card_text]):
        return _result("DOCUMENTATION_GAP", "LOW", "No evidence was found for this topic.", False)

    if topic_key == "p1_response_time" and NUMERIC_SLA_RE.search(proposal_text) and BEST_EFFORT_RE.search(contract_text):
        return _result(
            "COMMITMENT_WEAKENED",
            "HIGH",
            "Proposal contains a numeric SLA commitment while the contract evidence uses reasonable/best effort language.",
            True,
        )

    if MUST_RE.search(rfp_text) and COMMIT_RE.search(proposal_text) and not COMMIT_RE.search(contract_text):
        return _result("RFP_CONTRACT_GAP", _minimum_level(topic_key), "RFP and Proposal evidence show a requirement/commitment, but contract evidence does not show an equivalent commitment.", topic_key in HIGH_TOPICS)

    if topic_key == "price_escalation" and PRICE_RE.search(contract_text):
        return _result("PRICE_ESCALATION_RISK", "MEDIUM", "Contract evidence includes price escalation language such as CPI, annual increase, or supplier price adjustment rights.", False)

    if topic_key == "expansion_right" and EXPANSION_RE.search(rfp_text) and not EXPANSION_RE.search(contract_text):
        return _result("EXPANSION_RIGHT_GAP", "MEDIUM", "RFP evidence references future expansion or reserved capacity, but contract evidence does not show a matching expansion right.", False)

    if topic_key in {"availability_sla", "cooling_sla", "sla_credit"} and not CREDIT_RE.search(contract_text):
        return _result("SLA_CREDIT_GAP", "MEDIUM", "SLA-related evidence does not show a clear service credit or compensation clause.", False)

    if topic_key == "remote_hands" and "emergency remote hands" in _join(evidence_pack.get("other_evidence", [])).lower() and "emergency remote hands" not in rate_card_text.lower():
        return _result("BILLING_ANOMALY", "MEDIUM", "Invoice evidence references Emergency Remote Hands, but matching Rate Card evidence was not found.", False)

    return _result("NEEDS_REVIEW", _minimum_level(topic_key), "Evidence was found, but deterministic rules did not establish a concrete gap. Human review is required.", topic_key in HIGH_TOPICS)


def _join(items: list[dict]) -> str:
    return "\n".join(str(item.get("text", "")) for item in items)


def _minimum_level(topic_key: str) -> str:
    return "MEDIUM" if topic_key in HIGH_TOPICS else "LOW"


def _result(issue_type: str, risk_level: str, assessment: str, human_review_required: bool) -> dict:
    if risk_level in {"HIGH", "CRITICAL"}:
        human_review_required = True
    return {
        "issue_type": issue_type,
        "risk_level": risk_level,
        "rule_assessment": assessment,
        "human_review_required": human_review_required,
        "confidence_score": 0.75 if issue_type not in {"DOCUMENTATION_GAP", "NEEDS_REVIEW"} else 0.35,
    }
