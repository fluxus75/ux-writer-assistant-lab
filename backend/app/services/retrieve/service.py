"""Hybrid retrieval service that consults Postgres metadata and Qdrant."""

from __future__ import annotations

import math
import time
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models
from app.services.rag.config import vector_store_config
from app.services.rag.embedding import get_embedding_client


FUSION_ALPHA = 0.3


def _keyword_score(text: str, query: str) -> float:
    if not text or not query:
        return 0.0
    tokens = [tok for tok in query.lower().split() if tok]
    target = text.lower()
    if not tokens:
        return 0.0
    return sum(1.0 for tok in tokens if tok in target)


def _normalize(scores: Dict[str, float]) -> Dict[str, float]:
    if not scores:
        return {}
    values = list(scores.values())
    max_val = max(values)
    min_val = min(values)
    if math.isclose(max_val, min_val):
        return {key: 1.0 for key in scores}
    return {key: (val - min_val) / (max_val - min_val) for key, val in scores.items()}


def _vector_client() -> Optional[QdrantClient]:
    try:
        return vector_store_config.create_client()
    except Exception:
        return None


def _vector_search(
    client: QdrantClient,
    *,
    collection: str,
    vector: List[float],
    top_k: int,
    filters: Optional[Dict[str, Any]] = None,
) -> Dict[str, float]:
    if not vector:
        return {}
    search_filter = None
    if filters:
        must: List[qmodels.FieldCondition] = []
        for key, value in filters.items():
            if value is None:
                continue
            must.append(qmodels.FieldCondition(key=key, match=qmodels.MatchValue(value=value)))
        if must:
            search_filter = qmodels.Filter(must=must)
    try:
        result = client.search(
            collection_name=collection,
            query_vector=vector,
            limit=top_k,
            with_payload=True,
            query_filter=search_filter,
        )
    except Exception:
        return {}
    scores: Dict[str, float] = {}
    for item in result:
        payload = item.payload or {}
        sid = payload.get("sid") or payload.get("id")
        if sid:
            scores[str(sid)] = float(item.score or 0.0)
    return scores


def _base_style_query(session: Session, filters: Dict[str, Any]) -> List[models.StyleGuideEntry]:
    stmt = select(models.StyleGuideEntry)
    if filters.get("device"):
        stmt = stmt.where(models.StyleGuideEntry.device == filters["device"])
    if filters.get("feature_norm"):
        stmt = stmt.where(models.StyleGuideEntry.feature_norm == filters["feature_norm"])
    if filters.get("style_tag"):
        stmt = stmt.where(models.StyleGuideEntry.style_tag == filters["style_tag"])
    stmt = stmt.limit(200)
    return list(session.scalars(stmt))


def _feature_confidence(session: Session, feature_norm: Optional[str]) -> float:
    if not feature_norm:
        return 0.0
    stmt = select(models.StyleGuideEntry.id).where(models.StyleGuideEntry.feature_norm == feature_norm)
    result = session.execute(stmt).first()
    return 0.8 if result else 0.2


def retrieve(
    session: Session,
    *,
    query: str,
    filters: Optional[Dict[str, Any]] = None,
    top_k: int = 5,
    mode: Optional[str] = None,
) -> Dict[str, Any]:
    start = time.time()
    normalized_filters = filters.copy() if filters else {}
    feature_conf = _feature_confidence(session, normalized_filters.get("feature_norm"))
    if mode is None:
        mode = "feature" if feature_conf >= 0.6 else "style"

    entries = _base_style_query(session, normalized_filters)

    if mode == "feature" and not entries:
        mode = "style"

    results: List[Dict[str, Any]] = []

    if mode == "feature":
        keyword_scores = {entry.id: _keyword_score(entry.text, query) for entry in entries}
        keyword_norm = _normalize(keyword_scores)

        vector_scores: Dict[str, float] = {}
        if query.strip():
            client = _vector_client()
            if client is not None:
                embedding = get_embedding_client().embed([query])[0]
                vector_scores = _vector_search(
                    client,
                    collection="style_guides",
                    vector=embedding,
                    top_k=top_k * 2,
                    filters={
                        "device": normalized_filters.get("device"),
                        "feature_norm": normalized_filters.get("feature_norm"),
                        "style_tag": normalized_filters.get("style_tag"),
                    },
                )
        vector_norm = _normalize(vector_scores)

        combined: Dict[str, float] = {}
        for entry in entries:
            bm25_val = keyword_norm.get(entry.id, 0.0)
            vector_val = vector_norm.get(entry.id, 0.0)
            if vector_norm:
                score = FUSION_ALPHA * bm25_val + (1 - FUSION_ALPHA) * vector_val
            else:
                score = bm25_val
            combined[entry.id] = score

        sorted_entries = sorted(entries, key=lambda e: combined.get(e.id, 0.0), reverse=True)[: max(1, top_k)]
        for entry in sorted_entries:
            results.append(
                {
                    "sid": entry.id,
                    "en_line": entry.text,
                    "score": float(combined.get(entry.id, 0.0)),
                    "metadata": {
                        "device": entry.device,
                        "feature_norm": entry.feature_norm,
                        "style_tag": entry.style_tag,
                        "tone": entry.tone,
                    },
                }
            )
    else:
        # Style prior mode emphasises stylistic similarity when feature confidence is low.
        if not entries:
            stmt = select(models.StyleGuideEntry).limit(200)
            entries = list(session.scalars(stmt))
        for entry in entries:
            base = 0.4
            if normalized_filters.get("style_tag") and entry.style_tag == normalized_filters.get("style_tag"):
                base += 0.3
            if normalized_filters.get("device") and entry.device == normalized_filters.get("device"):
                base += 0.2
            results.append(
                {
                    "sid": entry.id,
                    "en_line": entry.text,
                    "score": float(base),
                    "metadata": {
                        "device": entry.device,
                        "feature_norm": entry.feature_norm,
                        "style_tag": entry.style_tag,
                        "tone": entry.tone,
                    },
                }
            )
            if len(results) >= top_k:
                break

    latency_ms = int((time.time() - start) * 1000)
    return {
        "items": results[: max(1, top_k)],
        "latency_ms": latency_ms,
        "mode": mode,
        "feature_confidence": feature_conf,
        "novelty_mode": mode != "feature",
    }


__all__ = ["retrieve"]

