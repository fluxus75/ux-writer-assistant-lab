"""Ingestion pipeline that loads seed data into Postgres and Qdrant."""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core import io_utils, state
from app.db import models
from app.services.rag.config import default_collections, embedding_config, vector_store_config

DATA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..", "data"))
logger = logging.getLogger(__name__)


def _pseudo_embedding(text: str, dimension: int) -> List[float]:
    """Return a deterministic pseudo-embedding for the provided text."""

    if not text:
        return [0.0] * dimension
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    base_values = [byte / 255.0 for byte in digest]
    size = len(base_values)
    return [base_values[i % size] for i in range(dimension)]


def _ensure_collections(client: QdrantClient) -> None:
    existing = {collection.name for collection in client.get_collections().collections or []}
    for cfg in default_collections:
        if cfg.name in existing:
            continue
        distance = getattr(qmodels.Distance, cfg.distance.upper(), qmodels.Distance.COSINE)
        logger.info("Creating Qdrant collection %s (dim=%s)", cfg.name, cfg.dimension)
        client.recreate_collection(
            collection_name=cfg.name,
            vectors_config=qmodels.VectorParams(size=cfg.dimension, distance=distance),
            shard_number=cfg.shard_number,
            on_disk_payload=cfg.on_disk,
        )


def _upsert_vectors(
    client: QdrantClient,
    collection_name: str,
    points: Iterable[qmodels.PointStruct],
) -> int:
    points_list = list(points)
    if not points_list:
        return 0
    client.upsert(collection_name=collection_name, points=points_list)
    return len(points_list)


def _collect_style_vectors(style_rows: List[Dict[str, Any]]) -> List[qmodels.PointStruct]:
    points: List[qmodels.PointStruct] = []
    for row in style_rows:
        text = str(row.get("en_line", "")).strip()
        if not text:
            continue
        payload = {
            "sid": row.get("sid"),
            "language": "en",
            "device": row.get("device"),
            "feature_norm": row.get("feature_norm"),
            "style_tag": row.get("style_tag"),
            "notes": row.get("notes"),
        }
        vector = _pseudo_embedding(text, embedding_config.dimension)
        points.append(
            qmodels.PointStruct(id=str(uuid4()), vector=vector, payload=payload)
        )
    return points


def _collect_context_vectors(context_rows: List[Dict[str, Any]]) -> List[qmodels.PointStruct]:
    points: List[qmodels.PointStruct] = []
    for row in context_rows:
        text = str(row.get("ko_response") or row.get("en_line") or "").strip()
        if not text:
            continue
        payload = {
            "context_id": row.get("id"),
            "device": row.get("device"),
            "feature_norm": row.get("feature_norm"),
            "style_tag": row.get("style_tag"),
            "tags": row.get("response_case_tags", []),
        }
        vector = _pseudo_embedding(text, embedding_config.dimension)
        points.append(
            qmodels.PointStruct(id=str(uuid4()), vector=vector, payload=payload)
        )
    return points


def _collect_glossary_vectors(glossary_rows: List[Dict[str, Any]]) -> List[qmodels.PointStruct]:
    points: List[qmodels.PointStruct] = []
    for row in glossary_rows:
        text = str(row.get("en_term") or row.get("ko_term") or "").strip()
        if not text:
            continue
        payload = {
            "term": row.get("ko_term"),
            "translation": row.get("en_term"),
            "language_pair": "ko-en",
            "device": row.get("device"),
            "must_use": str(row.get("must_use", "")).lower() in {"true", "1", "yes"},
        }
        vector = _pseudo_embedding(text, embedding_config.dimension)
        points.append(
            qmodels.PointStruct(id=str(uuid4()), vector=vector, payload=payload)
        )
    return points


def do_ingest(session: Session, vector_client: Optional[QdrantClient] = None) -> Dict[str, Any]:
    """Load seed data from `data/input` into Postgres and Qdrant."""

    inp = os.path.join(DATA_ROOT, "input")
    context_rows = io_utils.read_jsonl(os.path.join(inp, "context.jsonl"))
    glossary_rows = io_utils.read_csv(os.path.join(inp, "glossary.csv"))
    style_rows = io_utils.read_csv(os.path.join(inp, "style_corpus.csv"))
    rules = io_utils.read_yaml(os.path.join(inp, "style_rules.yaml"))

    # Persist to Postgres
    session.execute(delete(models.ContextSnippet))
    session.execute(delete(models.StyleGuideEntry))
    session.execute(delete(models.GlossaryEntry))

    session.add_all(
        [
            models.ContextSnippet(
                id=row.get("id", str(uuid4())),
                device=row.get("device"),
                feature=row.get("feature"),
                feature_norm=row.get("feature_norm"),
                style_tag=row.get("style_tag"),
                user_utterance=row.get("user_utterance"),
                response_case_raw=row.get("response_case_raw"),
                response_case_norm=row.get("response_case_norm"),
                response_case_tags=row.get("response_case_tags"),
                response_text=row.get("ko_response"),
                notes=row.get("notes"),
            )
            for row in context_rows
        ]
    )

    session.add_all(
        [
            models.StyleGuideEntry(
                id=row.get("sid", str(uuid4())),
                language="en",
                device=row.get("device"),
                feature_norm=row.get("feature_norm"),
                style_tag=row.get("style_tag"),
                text=row.get("en_line", ""),
                notes=row.get("notes"),
            )
            for row in style_rows
        ]
    )

    session.add_all(
        [
            models.GlossaryEntry(
                id=str(uuid4()),
                source_language="ko",
                target_language="en",
                source_term=row.get("ko_term", ""),
                target_term=row.get("en_term", ""),
                device=row.get("device"),
                must_use=str(row.get("must_use", "")).lower() in {"true", "1", "yes"},
                part_of_speech=row.get("pos"),
                synonyms=row.get("synonyms_ko"),
                notes=row.get("notes"),
            )
            for row in glossary_rows
        ]
    )

    ingestion_records = [
        models.RagIngestion(
            id=str(uuid4()),
            source_type=models.RagSourceType.CONTEXT,
            source_id="context.jsonl",
            version="dev",
            metadata_json={"count": len(context_rows)},
        ),
        models.RagIngestion(
            id=str(uuid4()),
            source_type=models.RagSourceType.GLOSSARY,
            source_id="glossary.csv",
            version="dev",
            metadata_json={"count": len(glossary_rows)},
        ),
        models.RagIngestion(
            id=str(uuid4()),
            source_type=models.RagSourceType.STYLE_GUIDE,
            source_id="style_corpus.csv",
            version="dev",
            metadata_json={"count": len(style_rows)},
        ),
    ]
    session.add_all(ingestion_records)
    session.flush()

    counts = {"context": len(context_rows), "glossary": len(glossary_rows), "style": len(style_rows)}

    run_id = io_utils.new_run_id()
    state.CONTEXT[:] = context_rows
    state.GLOSSARY[:] = glossary_rows
    state.STYLE[:] = style_rows
    state.RUN_LOGS[run_id] = {"counts": counts, "rules": rules}

    vector_summary: Dict[str, Any] = {"collections": {}, "status": "skipped"}

    if vector_client is None:
        try:
            vector_client = vector_store_config.create_client()
        except Exception as exc:  # pragma: no cover - network/connection issues
            logger.warning("Unable to create Qdrant client: %s", exc)
            vector_client = None

    if vector_client is not None:
        try:
            _ensure_collections(vector_client)
            inserted_counts = {}
            inserted_counts["style_guides"] = _upsert_vectors(
                vector_client, "style_guides", _collect_style_vectors(style_rows)
            )
            inserted_counts["glossary_terms"] = _upsert_vectors(
                vector_client, "glossary_terms", _collect_glossary_vectors(glossary_rows)
            )
            inserted_counts["context_snippets"] = _upsert_vectors(
                vector_client, "context_snippets", _collect_context_vectors(context_rows)
            )
            vector_summary = {"status": "completed", "collections": inserted_counts}
        except Exception as exc:  # pragma: no cover - depends on external service
            logger.warning("Vector store ingestion failed: %s", exc)
            vector_summary = {"status": "failed", "error": str(exc)}

    return {"run_id": run_id, "counts": counts, "vector_store": vector_summary}


__all__ = ["do_ingest"]
