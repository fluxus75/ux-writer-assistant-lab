"""Hybrid retrieval service that consults Postgres metadata and Qdrant."""

from __future__ import annotations

import math
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models
from app.services.rag.config import vector_store_config
from app.services.rag.embedding import get_embedding_client


FUSION_ALPHA = 0.3
STYLE_MMR_LAMBDA = 0.5
STYLE_RERANK_WEIGHT = 0.65


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
    vector: Sequence[float],
    top_k: int,
    filters: Optional[Dict[str, Any]] = None,
    with_vectors: bool = False,
) -> List[Tuple[str, float, Optional[List[float]], Dict[str, Any]]]:
    if not vector:
        return []

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
            query_vector=list(vector),
            limit=top_k,
            with_payload=True,
            with_vectors=with_vectors,
            query_filter=search_filter,
        )
    except Exception:
        return []

    records: List[Tuple[str, float, Optional[List[float]], Dict[str, Any]]] = []
    for item in result:
        payload = item.payload or {}
        sid = payload.get("sid") or payload.get("id")
        if not sid:
            continue
        vector_payload = None
        if with_vectors:
            raw_vector = getattr(item, "vector", None)
            if isinstance(raw_vector, (list, tuple)):
                vector_payload = list(raw_vector)
        records.append((str(sid), float(item.score or 0.0), vector_payload, payload))
    return records


def _normalize_list(values: Iterable[Tuple[str, float]]) -> Dict[str, float]:
    return _normalize({key: score for key, score in values})


def _style_rule_score(entry: models.StyleGuideEntry, filters: Dict[str, Any]) -> float:
    score = 0.2
    if filters.get("style_tag") and entry.style_tag == filters["style_tag"]:
        score += 0.3
    if filters.get("device") and entry.device == filters["device"]:
        score += 0.2
    if filters.get("tone") and entry.tone and entry.tone == filters["tone"]:
        score += 0.1
    if filters.get("feature_norm") and entry.feature_norm == filters["feature_norm"]:
        score += 0.1
    return score


def _mmr(
    candidates: List[Tuple[str, float, Optional[List[float]], Dict[str, Any]]],
    *,
    top_k: int,
    diversity_lambda: float = STYLE_MMR_LAMBDA,
) -> List[Tuple[str, float, Optional[List[float]], Dict[str, Any]]]:
    if not candidates:
        return []
    selected: List[Tuple[str, float, Optional[List[float]], Dict[str, Any]]] = []
    remaining = candidates.copy()
    while remaining and len(selected) < top_k:
        if not selected:
            selected.append(remaining.pop(0))
            continue
        best_idx = 0
        best_score = float("-inf")
        for idx, candidate in enumerate(remaining):
            _, cand_score, cand_vec, _ = candidate
            relevance = cand_score
            diversity = 0.0
            if cand_vec:
                for _, _, selected_vec, _ in selected:
                    if selected_vec:
                        diversity = max(
                            diversity,
                            _cosine_similarity(cand_vec, selected_vec),
                        )
            mmr_score = diversity_lambda * relevance - (1 - diversity_lambda) * diversity
            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = idx
        selected.append(remaining.pop(best_idx))
    return selected


def _cosine_similarity(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    if len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


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
    """
    Tiered retrieval with graceful filter degradation.

    Tier 1: Full filters (device + feature_norm)
    Tier 2: Device only
    Tier 3: No filters (semantic only)
    """
    start = time.time()
    normalized_filters = filters.copy() if filters else {}
    feature_conf = _feature_confidence(session, normalized_filters.get("feature_norm"))
    if mode is None:
        mode = "feature" if feature_conf >= 0.6 else "style"

    # Try Tier 1: Full filters
    entries = _base_style_query(session, normalized_filters)
    tier = 1

    # Tier 2: If no results and feature_norm was specified, try device-only
    if not entries and normalized_filters.get("feature_norm"):
        tier = 2
        relaxed_filters = {"device": normalized_filters.get("device")} if normalized_filters.get("device") else {}
        entries = _base_style_query(session, relaxed_filters)

    # Tier 3: If still no results, remove all filters
    if not entries:
        tier = 3
        entries = _base_style_query(session, {})

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
                vector_results = _vector_search(
                    client,
                    collection="style_guides",
                    vector=embedding,
                    top_k=max(top_k * 4, 20),
                    filters={
                        "device": normalized_filters.get("device"),
                        "feature_norm": normalized_filters.get("feature_norm"),
                    },
                )
                vector_scores = {sid: score for sid, score, _, _ in vector_results}
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
        query_text = query.strip()
        if not query_text:
            query_text = " ".join(
                str(v)
                for v in (
                    normalized_filters.get("style_tag"),
                    normalized_filters.get("tone"),
                    normalized_filters.get("device"),
                )
                if v
            )

        candidate_vector_results: List[Tuple[str, float, Optional[List[float]], Dict[str, Any]]] = []
        client = _vector_client()
        if client is not None and query_text:
            embedding = get_embedding_client().embed([query_text])[0]
            candidate_vector_results = _vector_search(
                client,
                collection="style_guides",
                vector=embedding,
                top_k=max(top_k * 5, 40),
                filters={
                    "device": normalized_filters.get("device"),
                },
                with_vectors=True,
            )

        # Fall back to database rows when vector search yields nothing.
        if not candidate_vector_results:
            if not entries:
                stmt = select(models.StyleGuideEntry).limit(200)
                entries = list(session.scalars(stmt))
            candidate_vector_results = [(entry.id, 0.5, None, {}) for entry in entries]

        entry_lookup: Dict[str, models.StyleGuideEntry] = {entry.id: entry for entry in entries}
        if len(entry_lookup) < len(candidate_vector_results):
            # ensure all referenced SIDs are loaded
            missing_ids = [sid for sid, _, _, _ in candidate_vector_results if sid not in entry_lookup]
            if missing_ids:
                extra_stmt = select(models.StyleGuideEntry).where(models.StyleGuideEntry.id.in_(missing_ids))
                for extra in session.scalars(extra_stmt):
                    entry_lookup[extra.id] = extra

        mmr_candidates = _mmr(candidate_vector_results, top_k=top_k * 2)
        norm_scores = _normalize_list((sid, score) for sid, score, _, _ in mmr_candidates)

        reranked: List[Tuple[str, float]] = []
        for sid, raw_score, _, _ in mmr_candidates:
            entry = entry_lookup.get(sid)
            if not entry:
                continue
            style_score = _style_rule_score(entry, normalized_filters)
            combined_score = STYLE_RERANK_WEIGHT * norm_scores.get(sid, raw_score) + (1 - STYLE_RERANK_WEIGHT) * style_score
            reranked.append((sid, combined_score))

        reranked.sort(key=lambda item: item[1], reverse=True)
        for sid, score in reranked[: max(1, top_k)]:
            entry = entry_lookup.get(sid)
            if not entry:
                continue
            results.append(
                {
                    "sid": entry.id,
                    "en_line": entry.text,
                    "score": float(score),
                    "metadata": {
                        "device": entry.device,
                        "feature_norm": entry.feature_norm,
                        "style_tag": entry.style_tag,
                        "tone": entry.tone,
                    },
                }
            )

    latency_ms = int((time.time() - start) * 1000)
    return {
        "items": results[: max(1, top_k)],
        "latency_ms": latency_ms,
        "mode": mode,
        "feature_confidence": feature_conf,
        "novelty_mode": mode != "feature",
        "candidate_count": len(results),
        "tier": tier,  # Include tier information for debugging
    }


__all__ = ["retrieve"]

