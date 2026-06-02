from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.domain import User
from app.schemas.domain import ChatRequest, GapRunRequest, TopicRequest
from app.services.gap_analysis import run_topic_gap_analysis
from app.services.llm_gateway import LLMGateway
from app.services.retrieval import get_evidence_pack, search_chunks


router = APIRouter(tags=["AI"])


@router.post("/ai/classify-document")
def classify_document(payload: dict, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return LLMGateway(db).run("classify_document", payload)


@router.post("/ai/chat-with-sources")
def chat_with_sources(payload: ChatRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = payload.question
    if payload.topic_key:
        query = f"{query} {payload.topic_key}"
    chunks = search_chunks(db, query, contract_id=payload.contract_id, limit=8)
    if not chunks:
        return {"answer": "evidence_not_found", "answer_type": "evidence_not_found", "citations": [], "confidence_score": 0.0, "human_review_required": True}
    cited = [item["chunk_id"] for item in chunks]
    return LLMGateway(db).run("chat_with_sources", {"question": payload.question, "evidence": chunks}, cited_chunk_ids=cited)


@router.post("/ai/extract-obligations")
def extract_obligations(payload: TopicRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    pack = get_evidence_pack(db, payload.topic_key, payload.contract_id) if payload.contract_id else {"topic_key": payload.topic_key}
    cited = [item["chunk_id"] for key, values in pack.items() if key.endswith("_evidence") for item in values]
    return LLMGateway(db).run("extract_obligations_from_evidence", pack, cited_chunk_ids=cited)


@router.post("/ai/compare-topic-evidence")
def compare_topic_evidence(payload: GapRunRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    pack = get_evidence_pack(db, payload.topic_key, payload.contract_id)
    cited = [item["chunk_id"] for key, values in pack.items() if key.endswith("_evidence") for item in values]
    return LLMGateway(db).run("compare_topic_evidence", pack, cited_chunk_ids=cited)


@router.post("/ai/generate-risk-issue")
def generate_risk_issue(payload: GapRunRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return run_topic_gap_analysis(db, payload.contract_id, payload.topic_key)


@router.post("/ai/generate-ceo-brief")
def ai_generate_ceo_brief(payload: dict, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return LLMGateway(db).run("generate_ceo_brief", payload)
