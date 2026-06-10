import re
from collections import defaultdict

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.domain import Document, DocumentChunk, TopicEvidence
from app.services.embedding import generate_embedding
from app.services.topic_dictionary import topic_search_text
from app.services.vector_store import vector_search_chunks


DOCUMENT_WEIGHTS = {
    "RFP": 1.0,
    "PROPOSAL": 1.0,
    "CONTRACT": 1.2,
    "SLA": 1.3,
    "AMENDMENT": 1.4,
    "RATE_CARD": 1.1,
}

SIGNAL_RE = re.compile(r"\b(\d+(?:\.\d+)?%?|\d+\s*minutes?|shall|must|required|mandatory|committed|included|excluded|best effort|reasonable effort|commercially reasonable)\b|必须|应当|应提供|承诺|保证|不低于|不超过", re.I)


def search_chunks(
    db: Session,
    query: str,
    contract_id: int | None = None,
    document_type: str | None = None,
    limit: int = 10,
    use_vector: bool = True,
) -> list[dict]:
    """Retrieve chunks with vector search for RAG, falling back to keywords only if embeddings are unavailable."""
    query = query.strip()
    if not query:
        return []

    settings = get_settings()
    if use_vector and settings.embedding_enabled:
        query_embedding = generate_embedding(query)
        if query_embedding:
            vector_rows = vector_search_chunks(
                db,
                query_embedding,
                contract_id=contract_id,
                document_type=document_type,
                limit=limit,
                candidate_limit=settings.search_candidate_limit,
                score_threshold=settings.vector_score_threshold,
            )
            return [_vector_result(chunk, document, score) for chunk, document, score in vector_rows]

    terms = _query_terms(query)
    if not terms:
        return []
    rows = _base_chunk_query(db, contract_id, document_type).filter(_keyword_filter(terms)).all()
    scored = [_keyword_result(chunk, document, terms) for chunk, document in rows]
    scored.sort(key=lambda item: item["combined_score"], reverse=True)
    return scored[:limit]


def _base_chunk_query(db: Session, contract_id: int | None, document_type: str | None):
    q = db.query(DocumentChunk, Document).join(Document, Document.id == DocumentChunk.document_id)
    if contract_id is not None:
        q = q.filter(Document.contract_id == contract_id)
    if document_type:
        q = q.filter(Document.document_type == document_type)
    return q


def _query_terms(query: str) -> list[str]:
    return [term.strip() for term in re.split(r"[\s,，;；]+", query) if term.strip()]


def _keyword_filter(terms: list[str]):
    return or_(*(func.lower(DocumentChunk.text).contains(term.lower()) for term in terms))


def search_by_topic(db: Session, topic_key: str, contract_id: int | None) -> list[dict]:
    """Use topic text as an embedding query and persist top RAG evidence for the contract."""
    if contract_id is None:
        raise ValueError("contract_id is required for topic evidence search")
    query = topic_search_text(topic_key)
    if not query:
        return []
    db.query(TopicEvidence).filter(
        TopicEvidence.topic_key == topic_key,
        TopicEvidence.contract_id == contract_id,
    ).delete()
    results = search_chunks(db, query, contract_id=contract_id, limit=100, use_vector=True)
    top = _top_per_document_type(results)
    for item in top:
        db.add(
            TopicEvidence(
                topic_key=topic_key,
                contract_id=contract_id,
                document_id=item["document_id"],
                chunk_id=item["chunk_id"],
                evidence_text=item["text"][:2000],
                document_role=item["document_type"],
                score=item["combined_score"],
            )
        )
    db.commit()
    return sorted(top, key=lambda item: item["combined_score"], reverse=True)


def get_evidence_pack(db: Session, topic_key: str, contract_id: int | None) -> dict:
    if contract_id is None:
        raise ValueError("contract_id is required for evidence pack retrieval")
    return _build_evidence_pack(topic_key, contract_id, search_by_topic(db, topic_key, contract_id))


def get_keyword_evidence_pack(db: Session, keywords: str, contract_id: int, limit: int = 50) -> dict:
    """Build an evidence pack for ad-hoc user semantic queries without mutating saved topic evidence."""
    query = keywords.strip()
    if not query:
        return _build_evidence_pack("custom", contract_id, [])
    evidence = _top_per_document_type(search_chunks(db, query, contract_id=contract_id, limit=limit, use_vector=True))
    return _build_evidence_pack(query, contract_id, evidence)


def _top_per_document_type(results: list[dict], per_type: int = 5) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in results:
        grouped[item["document_type"]].append(item)
    top: list[dict] = []
    for items in grouped.values():
        top.extend(items[:per_type])
    return sorted(top, key=lambda item: item["combined_score"], reverse=True)


def _build_evidence_pack(topic_key: str, contract_id: int, evidence: list[dict]) -> dict:
    pack = {
        "topic_key": topic_key,
        "contract_id": contract_id,
        "rfp_evidence": [],
        "proposal_evidence": [],
        "contract_evidence": [],
        "sla_evidence": [],
        "rate_card_evidence": [],
        "other_evidence": [],
    }
    mapping = {
        "RFP": "rfp_evidence",
        "PROPOSAL": "proposal_evidence",
        "CONTRACT": "contract_evidence",
        "SLA": "sla_evidence",
        "RATE_CARD": "rate_card_evidence",
    }
    for item in evidence:
        pack[mapping.get(item["document_type"], "other_evidence")].append(item)
    return pack


def _vector_result(chunk: DocumentChunk, document: Document, score: float) -> dict:
    base = _base_result(chunk, document)
    weighted_score = score * DOCUMENT_WEIGHTS.get(document.document_type, 1.0)
    base.update(
        {
            "score": round(weighted_score, 4),
            "vector_score": round(score, 4),
            "cosine_score": round(score, 4),
            "combined_score": round(weighted_score, 4),
            "retrieval_mode": "vector",
        }
    )
    return base


def _keyword_result(chunk: DocumentChunk, document: Document, terms: list[str]) -> dict:
    base = _base_result(chunk, document)
    text = chunk.text or ""
    lowered = text.lower()
    score = sum(lowered.count(term.lower()) * 2.0 for term in terms)
    if score > 0 and SIGNAL_RE.search(text):
        score += 2.0
    score *= DOCUMENT_WEIGHTS.get(document.document_type, 1.0)
    base.update(
        {
            "score": round(score, 4),
            "keyword_score": round(score, 4),
            "vector_score": 0.0,
            "cosine_score": 0.0,
            "combined_score": round(score, 4),
            "retrieval_mode": "keyword_fallback",
        }
    )
    return base


def _base_result(chunk: DocumentChunk, document: Document) -> dict:
    return {
        "chunk_id": chunk.id,
        "document_id": document.id,
        "contract_id": document.contract_id,
        "document_title": document.title,
        "document_type": document.document_type,
        "chunk_index": chunk.chunk_index,
        "page_number": chunk.page_number,
        "sheet_name": chunk.sheet_name,
        "section_title": chunk.section_title,
        "clause_reference": chunk.clause_reference,
        "text": chunk.text or "",
    }
