"""
Embedding service for document chunk vectorization.

Supports two embedding backends:
- local: a sentence-transformers compatible model such as Qwen/Qwen3-Embedding-0.6B
- openai: an OpenAI-compatible /embeddings endpoint such as text-embedding-3-small/large

Returned vectors are L2-normalized so the vector store can use cosine similarity
(or dot product on normalized vectors) consistently across providers.
"""
import importlib.util
import logging
from functools import lru_cache
from typing import Any

import math

import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)

LOCAL_PROVIDER = "local"
OPENAI_PROVIDER = "openai"


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load the local sentence-transformers embedding model once and cache it."""
    settings = get_settings()
    if not settings.embedding_enabled or settings.embedding_provider != LOCAL_PROVIDER:
        return None
    if importlib.util.find_spec("sentence_transformers") is None:
        logger.info("sentence-transformers is not installed; local embeddings are disabled")
        return None

    from sentence_transformers import SentenceTransformer

    try:
        return SentenceTransformer(
            settings.embedding_model,
            local_files_only=settings.embedding_local_files_only,
        )
    except Exception as exc:
        logger.warning("Local embedding model unavailable; continuing without vector embeddings: %s", exc)
        return None


def generate_embedding(text: str) -> list[float] | None:
    """
    Generate one normalized embedding vector for text.

    Returns None when embeddings are disabled or the configured provider cannot
    produce a vector.
    """
    vectors = generate_embeddings([text])
    return vectors[0] if vectors else None


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate normalized embedding vectors for a batch of texts."""
    settings = get_settings()
    clean_texts = [text.strip() for text in texts if text and text.strip()]
    if not settings.embedding_enabled or not clean_texts:
        return []

    if settings.embedding_provider == OPENAI_PROVIDER:
        return _generate_openai_embeddings(clean_texts)
    if settings.embedding_provider == LOCAL_PROVIDER:
        return _generate_local_embeddings(clean_texts)

    logger.warning("Unknown embedding provider '%s'; embeddings are disabled", settings.embedding_provider)
    return []


def _generate_local_embeddings(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    if model is None:
        return []
    try:
        embeddings = model.encode(texts, normalize_embeddings=True)
        return [_normalize_embedding(vector) for vector in embeddings]
    except Exception as exc:
        logger.warning("Local embedding generation failed; continuing without vector embedding: %s", exc)
        return []


def _generate_openai_embeddings(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    if not settings.embedding_api_key:
        logger.warning("OpenAI-compatible embeddings require EMBEDDING_API_KEY")
        return []

    url = f"{settings.embedding_base_url.rstrip('/')}/embeddings"
    headers = {"Authorization": f"Bearer {settings.embedding_api_key}"}
    payload: dict[str, Any] = {"model": settings.embedding_model, "input": texts}
    try:
        with httpx.Client(timeout=settings.embedding_timeout_seconds) as client:
            response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        data = response.json().get("data", [])
        ordered = sorted(data, key=lambda item: item.get("index", 0))
        return [_normalize_embedding(item["embedding"]) for item in ordered if item.get("embedding")]
    except Exception as exc:
        logger.warning("OpenAI-compatible embedding generation failed; continuing without vector embedding: %s", exc)
        return []


def _normalize_embedding(vector: Any) -> list[float]:
    values = [float(item) for item in vector]
    norm = math.sqrt(sum(item * item for item in values))
    if norm > 0:
        return [item / norm for item in values]
    return values


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Calculate cosine similarity between two normalized vectors (dot product)."""
    return float(sum(a * b for a, b in zip(vec_a, vec_b)))


def batch_cosine_similarity(query_vec: list[float], doc_vecs: list[list[float]]) -> list[float]:
    """
    Calculate cosine similarity for each document vector.
    Assumes vectors are L2-normalized by generate_embedding(s).
    """
    return [cosine_similarity(query_vec, doc_vec) for doc_vec in doc_vecs]


def rank_by_similarity(
    query_embedding: list[float],
    chunks: list[dict[str, Any]],
    top_k: int = 10,
) -> list[dict[str, Any]]:
    """
    Rank chunks by cosine similarity using a single batched matmul.
    Adds 'similarity_score' field to each chunk.
    """
    valid = [(i, chunk) for i, chunk in enumerate(chunks) if chunk.get("embedding") is not None]
    if not valid:
        return []

    _, valid_chunks = zip(*valid)
    doc_vecs = [c["embedding"] for c in valid_chunks]
    scores = batch_cosine_similarity(query_embedding, doc_vecs)

    scored = []
    for chunk, sim in zip(valid_chunks, scores):
        chunk_copy = dict(chunk)
        chunk_copy["similarity_score"] = round(float(sim), 4)
        scored.append(chunk_copy)

    scored.sort(key=lambda x: x["similarity_score"], reverse=True)
    return scored[:top_k]
