import re
from collections import defaultdict
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

# Hybrid search: weight for combining keyword score and vector similarity
KEYWORD_WEIGHT = 0.4
VECTOR_WEIGHT = 0.6


def search_chunks(
    db: Session,
    query: str,
    contract_id: int | None = None,
    document_type: str | None = None,
    limit: int = 10,
    use_vector: bool = True,
) -> list[dict]:
    """
    Hybrid search combining keyword matching and vector similarity.
    
    - Keyword search: traditional ILIKE matching with term frequency scoring
    - Vector search: semantic similarity using BAAI/bge-m3 embeddings
    - Results are merged and ranked by combined score
    """
    terms = [term.strip() for term in re.split(r"\s+|,", query) if term.strip()]
    
    # Base query
    q = db.query(DocumentChunk, Document).join(Document, Document.id == DocumentChunk.document_id)
    if contract_id is not None:
        q = q.filter(Document.contract_id == contract_id)
    if document_type:
        q = q.filter(Document.document_type == document_type)
    
    # Fetch up to 200 candidates
    rows = q.limit(200).all()
    
    if not rows:
        return []
    
    # Keyword scoring
    keyword_scored = [_score_row(chunk, document, terms) for chunk, document in rows]
    
    # Vector scoring (if enabled and embedding available)
    if use_vector:
        settings = get_settings()
        if settings.embedding_enabled:
            query_embedding = generate_embedding(query)
            if query_embedding:
                # Build chunk dicts with embeddings for vector ranking
                chunk_dicts = []
                for chunk, document in rows:
                    if chunk.embedding:
                        chunk_dicts.append({
                            "chunk_id": chunk.id,
                            "embedding": chunk.embedding,
                        })
                
                if chunk_dicts:
                    vector_ranked = rank_by_similarity(query_embedding, chunk_dicts, top_k=200)
                    # Build lookup: chunk_id -> similarity_score
                    vector_scores = {item["chunk_id"]: item["similarity_score"] for item in vector_ranked}
                    
                    # Combine scores
                    for item in keyword_scored:
                        vec_score = vector_scores.get(item["chunk_id"], 0.0)
                        # Normalize keyword score to [0, 1] range approximately
                        norm_kw = min(item["score"] / 10.0, 1.0)
                        item["combined_score"] = round(
                            KEYWORD_WEIGHT * norm_kw + VECTOR_WEIGHT * vec_score, 4
                        )
                        item["keyword_score"] = item["score"]
                        item["vector_score"] = vec_score
                    keyword_scored.sort(key=lambda x: x.get("combined_score", 0), reverse=True)
            else:
                # Fallback to keyword only
                keyword_scored.sort(key=lambda item: item["score"], reverse=True)
        else:
            keyword_scored.sort(key=lambda item: item["score"], reverse=True)
    else:
        keyword_scored.sort(key=lambda item: item["score"], reverse=True)
    
    return keyword_scored[:limit]


def search_by_topic(db: Session, topic_key: str, contract_id: int | None) -> list[dict]:
    if contract_id is None:
        raise ValueError("contract_id is required for topic evidence search")
    keywords = keywords_for_topic(topic_key)
    if not keywords:
        return []
    # 清除该合同内该 topic 之前的证据记录，避免重复累积且不影响其他合同。
    db.query(TopicEvidence).filter(
        TopicEvidence.topic_key == topic_key,
        TopicEvidence.contract_id == contract_id,
    ).delete()
    results = search_chunks(db, " ".join(keywords), contract_id=contract_id, limit=100)
    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in results:
        grouped[item["document_type"]].append(item)
    top: list[dict] = []
    for items in grouped.values():
        top.extend(items[:5])
    for item in top:
        db.add(
            TopicEvidence(
                topic_key=topic_key,
                contract_id=contract_id,
                document_id=item["document_id"],
                chunk_id=item["chunk_id"],
                evidence_text=item["text"][:2000],
                document_role=item["document_type"],
                score=item.get("combined_score", item["score"]),
            )
        )
    db.commit()
    return sorted(top, key=lambda item: item.get("combined_score", item["score"]), reverse=True)


def get_evidence_pack(db: Session, topic_key: str, contract_id: int | None) -> dict:
    if contract_id is None:
        raise ValueError("contract_id is required for evidence pack retrieval")
    evidence = search_by_topic(db, topic_key, contract_id)
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
    score = 0.0
    for term in terms:
        score += lowered.count(term.lower()) * 2.0
    if SIGNAL_RE.search(text):
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