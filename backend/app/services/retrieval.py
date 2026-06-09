import re
from collections import defaultdict

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.domain import Document, DocumentChunk, TopicEvidence
from app.services.embedding import generate_embedding, rank_by_similarity
from app.services.topic_dictionary import keywords_for_topic


DOCUMENT_WEIGHTS = {
    "RFP": 1.0,
    "PROPOSAL": 1.0,
    "CONTRACT": 1.2,
    "SLA": 1.3,
    "AMENDMENT": 1.4,
    "RATE_CARD": 1.1,
}

SIGNAL_RE = re.compile(r"\b(\d+(?:\.\d+)?%?|\d+\s*minutes?|shall|must|required|mandatory|committed|included|excluded|best effort|reasonable effort|commercially reasonable)\b|必须|应当|应提供|承诺|保证|不低于|不超过", re.I)

# Hybrid search weights. Cosine similarity is the stronger semantic signal.
KEYWORD_WEIGHT = 0.4
COSINE_WEIGHT = 0.6


def search_chunks(
    db: Session,
    query: str,
    contract_id: int | None = None,
    document_type: str | None = None,
    limit: int = 10,
    use_vector: bool = True,
) -> list[dict]:
    """Rank chunks using a weighted keyword score plus cosine similarity."""
    terms = [term.strip() for term in re.split(r"[\s,，;；]+", query) if term.strip()]
    if not terms:
        return []

    settings = get_settings()
    q = _base_chunk_query(db, contract_id, document_type)

    keyword_filter = _keyword_filter(terms)
    # Do not apply search_candidate_limit to keyword matches. SQL can find exact
    # matches anywhere in long documents, while the candidate limit is only a
    # guardrail for broad vector scans that must be scored in Python.
    rows = q.filter(keyword_filter).all()

    cosine_scores: dict[int, float] = {}
    if use_vector and settings.embedding_enabled:
        query_embedding = generate_embedding(query)
        if query_embedding:
            vector_rows = _base_chunk_query(db, contract_id, document_type).filter(
                DocumentChunk.embedding.isnot(None)
            ).limit(settings.search_candidate_limit).all()
            rows_by_chunk_id = {chunk.id: (chunk, document) for chunk, document in rows}
            rows_by_chunk_id.update({chunk.id: (chunk, document) for chunk, document in vector_rows})
            rows = list(rows_by_chunk_id.values())
            chunks_with_embeddings = [
                {"chunk_id": chunk.id, "embedding": chunk.embedding}
                for chunk, _ in rows
                if chunk.embedding
            ]
            cosine_scores = {
                item["chunk_id"]: item["similarity_score"]
                for item in rank_by_similarity(
                    query_embedding,
                    chunks_with_embeddings,
                    top_k=len(chunks_with_embeddings),
                )
            }

    if not rows:
        return []

    scored = [_score_row(chunk, document, terms) for chunk, document in rows]

    for item in scored:
        cosine_score = cosine_scores.get(item["chunk_id"], 0.0)
        # Keyword score is open-ended; cap it before combining with cosine similarity.
        normalized_keyword_score = min(item["score"] / 10.0, 1.0)
        # Cosine may be negative. Negative similarity must not lower an exact keyword match.
        normalized_cosine_score = max(cosine_score, 0.0)
        item["keyword_score"] = item["score"]
        item["cosine_score"] = round(cosine_score, 4)
        item["vector_score"] = item["cosine_score"]  # Backward-compatible API field.
        item["combined_score"] = round(
            KEYWORD_WEIGHT * normalized_keyword_score + COSINE_WEIGHT * normalized_cosine_score,
            4,
        )

    # Exclude chunks with neither a keyword match nor positive cosine similarity.
    scored = [item for item in scored if item["combined_score"] > 0]
    scored.sort(key=lambda item: item["combined_score"], reverse=True)
    return scored[:limit]


def _base_chunk_query(db: Session, contract_id: int | None, document_type: str | None):
    q = db.query(DocumentChunk, Document).join(Document, Document.id == DocumentChunk.document_id)
    if contract_id is not None:
        q = q.filter(Document.contract_id == contract_id)
    if document_type:
        q = q.filter(Document.document_type == document_type)
    return q


def _keyword_filter(terms: list[str]):
    return or_(*(func.lower(DocumentChunk.text).contains(term.lower()) for term in terms))


def search_by_topic(db: Session, topic_key: str, contract_id: int | None) -> list[dict]:
    if contract_id is None:
        raise ValueError("contract_id is required for topic evidence search")
    keywords = keywords_for_topic(topic_key)
    if not keywords:
        return []
    db.query(TopicEvidence).filter(
        TopicEvidence.topic_key == topic_key,
        TopicEvidence.contract_id == contract_id,
    ).delete()
    results = search_chunks(db, " ".join(keywords), contract_id=contract_id, limit=100)
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
    """Build an evidence pack for ad-hoc user keywords without mutating saved topic evidence."""
    query = keywords.strip()
    if not query:
        return _build_evidence_pack("custom", contract_id, [])
    evidence = _top_per_document_type(search_chunks(db, query, contract_id=contract_id, limit=limit))
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


def _score_row(chunk: DocumentChunk, document: Document, terms: list[str]) -> dict:
    text = chunk.text or ""
    lowered = text.lower()
    score = sum(lowered.count(term.lower()) * 2.0 for term in terms)
    # Contractual signal words are a boost, not a match by themselves.
    if score > 0 and SIGNAL_RE.search(text):
        score += 2.0
    score *= DOCUMENT_WEIGHTS.get(document.document_type, 1.0)
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
        "text": text,
        "score": round(score, 4),
    }
