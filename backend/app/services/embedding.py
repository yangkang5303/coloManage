"""
Embedding service using sentence-transformers with BAAI/bge-m3 model.
Supports both Chinese and English text for semantic search.

The model is loaded lazily and cached for reuse.
Embeddings are stored as JSON arrays in SQLite for compatibility.
"""
import json
import math
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
    """Calculate cosine similarity between two vectors."""
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    # Vectors are already normalized, so dot product = cosine similarity
    return float(np.dot(a, b))


def batch_cosine_similarity(query_vec: list[float], doc_vecs: list[list[float]]) -> list[float]:
    """Calculate cosine similarity between query and multiple document vectors."""
    q = np.array(query_vec, dtype=np.float32)
    similarities = []
    for dv in doc_vecs:
        d = np.array(dv, dtype=np.float32)
        sim = float(np.dot(q, d))
        similarities.append(sim)
    return similarities


def rank_by_similarity(
    query_embedding: list[float],
    chunks: list[dict[str, Any]],
    top_k: int = 10,
) -> list[dict[str, Any]]:
    """
    Rank chunks by cosine similarity to the query embedding.
    Adds 'similarity_score' field to each chunk.
    """
    scored = []
    for chunk in chunks:
        emb = chunk.get("embedding")
        if emb is None:
            continue
        sim = cosine_similarity(query_embedding, emb)
        chunk_copy = dict(chunk)
        chunk_copy["similarity_score"] = round(sim, 4)
        scored.append(chunk_copy)

    scored.sort(key=lambda x: x["similarity_score"], reverse=True)
    return scored[:top_k]