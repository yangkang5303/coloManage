"""
Embedding service using sentence-transformers with BAAI/bge-m3 model.
Supports both Chinese and English text for semantic search.

The model is loaded lazily and cached for reuse.
Embeddings are stored as JSON arrays in SQLite for compatibility.
"""
from functools import lru_cache
from typing import Any

import numpy as np
from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load the embedding model once and cache it."""
    try:
        from sentence_transformers import SentenceTransformer
        settings = get_settings()
        model = SentenceTransformer(settings.embedding_model)
        return model
    except ImportError:
        return None
    except Exception:
        return None


def generate_embedding(text: str) -> list[float] | None:
    """
    Generate embedding vector for the given text.
    Returns None if the model is not available.
    """
    model = get_embedding_model()
    if model is None:
        return None
    try:
        embedding = model.encode([text], normalize_embeddings=True)
        return embedding[0].tolist()
    except Exception:
        return None


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Calculate cosine similarity between two normalized vectors (dot product)."""
    return float(np.dot(np.array(vec_a, dtype=np.float32), np.array(vec_b, dtype=np.float32)))


def batch_cosine_similarity(query_vec: list[float], doc_vecs: list[list[float]]) -> list[float]:
    """
    Vectorized cosine similarity: one matmul instead of a Python loop.
    Assumes all vectors are already L2-normalized (bge-m3 outputs are).
    """
    if not doc_vecs:
        return []
    q = np.array(query_vec, dtype=np.float32)          # (dim,)
    D = np.array(doc_vecs, dtype=np.float32)            # (n, dim)
    return (D @ q).tolist()                              # (n,)


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

    indices, valid_chunks = zip(*valid)
    doc_vecs = [c["embedding"] for c in valid_chunks]
    scores = batch_cosine_similarity(query_embedding, doc_vecs)

    scored = []
    for chunk, sim in zip(valid_chunks, scores):
        chunk_copy = dict(chunk)
        chunk_copy["similarity_score"] = round(float(sim), 4)
        scored.append(chunk_copy)

    scored.sort(key=lambda x: x["similarity_score"], reverse=True)
    return scored[:top_k]