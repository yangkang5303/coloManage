"""Vector retrieval helpers for RAG over document chunks."""

from sqlalchemy.orm import Session

from app.models.domain import Document, DocumentChunk
from app.services.embedding import rank_by_similarity


def vector_search_chunks(
    db: Session,
    query_embedding: list[float],
    contract_id: int | None = None,
    document_type: str | None = None,
    limit: int = 10,
    candidate_limit: int = 200,
    score_threshold: float = 0.0,
) -> list[tuple[DocumentChunk, Document, float]]:
    """
    Retrieve chunks by vector similarity from the persisted embedding store.

    The current development implementation stores vectors in DocumentChunk.embedding
    for SQLite compatibility, then performs a batched in-process similarity rank.
    The function isolates vector retrieval so a pgvector/Milvus/Qdrant adapter can
    replace the internals without changing topic search or RAG callers.
    """
    q = db.query(DocumentChunk, Document).join(Document, Document.id == DocumentChunk.document_id)
    if contract_id is not None:
        q = q.filter(Document.contract_id == contract_id)
    if document_type:
        q = q.filter(Document.document_type == document_type)

    rows = q.filter(DocumentChunk.embedding.isnot(None)).limit(candidate_limit).all()
    if not rows:
        return []

    row_by_chunk_id = {chunk.id: (chunk, document) for chunk, document in rows}
    ranked = rank_by_similarity(
        query_embedding,
        [{"chunk_id": chunk.id, "embedding": chunk.embedding} for chunk, _ in rows if chunk.embedding],
        top_k=min(limit, len(rows)),
    )

    results: list[tuple[DocumentChunk, Document, float]] = []
    for item in ranked:
        score = float(item["similarity_score"])
        if score < score_threshold:
            continue
        chunk, document = row_by_chunk_id[item["chunk_id"]]
        results.append((chunk, document, score))
    return results
