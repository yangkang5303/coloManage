from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.domain import User
from app.schemas.domain import SearchChunksRequest, TopicRequest
from app.services.retrieval import get_evidence_pack, search_by_topic, search_chunks
from app.services.topic_dictionary import get_all_topics


router = APIRouter(tags=["Search"])


@router.get("/search/topics")
def api_list_topics(_: User = Depends(get_current_user)):
    """获取所有可用的话题列表。"""
    return get_all_topics()


@router.post("/search/chunks")
def api_search_chunks(payload: SearchChunksRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return search_chunks(db, payload.query, payload.contract_id, payload.document_type, payload.limit)


@router.post("/search/topic")
def api_search_topic(payload: TopicRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if payload.contract_id is None:
        raise HTTPException(status_code=400, detail="contract_id is required")
    return search_by_topic(db, payload.topic_key, payload.contract_id)


@router.post("/search/evidence-pack")
def api_evidence_pack(payload: TopicRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if payload.contract_id is None:
        raise HTTPException(status_code=400, detail="contract_id is required")
    return get_evidence_pack(db, payload.topic_key, payload.contract_id)
