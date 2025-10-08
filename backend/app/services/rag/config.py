"""Configuration helpers for the retrieval-augmented generation stack."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from qdrant_client import QdrantClient

from app.core.settings import settings


@dataclass(frozen=True)
class EmbeddingModelConfig:
    """Metadata describing the embedding model used for retrieval."""

    name: str
    dimension: int
    precision: str = "fp16"
    provider: str = "local"


@dataclass(frozen=True)
class VectorCollectionConfig:
    """Per-collection configuration for Qdrant."""

    name: str
    dimension: int
    distance: str = "cosine"
    shard_number: int = 1
    on_disk: bool = True
    metadata_schema: Dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class VectorStoreConfig:
    """Connection settings for the vector database."""

    host: str
    port: int
    api_key: Optional[str] = None
    prefer_grpc: bool = False
    https: bool = False

    def create_client(self) -> QdrantClient:
        # For local development, don't pass api_key if it's empty to avoid insecure connection warnings
        kwargs = {
            "host": self.host,
            "port": self.port,
            "prefer_grpc": self.prefer_grpc,
            "https": self.https,
        }
        if self.api_key:
            kwargs["api_key"] = self.api_key
        return QdrantClient(**kwargs)


embedding_config = EmbeddingModelConfig(name=settings.embedding_model, dimension=1024, precision=settings.embedding_precision)

vector_store_config = VectorStoreConfig(
    host=settings.qdrant_host,
    port=settings.qdrant_port,
    api_key=settings.qdrant_api_key,
    prefer_grpc=settings.qdrant_use_grpc,
    https=settings.qdrant_use_https,
)


default_collections: List[VectorCollectionConfig] = [
    VectorCollectionConfig(
        name="style_guides",
        dimension=embedding_config.dimension,
        metadata_schema={
            "language": "string",
            "feature_norm": "string",
            "tone": "string",
            "style_tag": "string",
            "device": "string",
            "version": "string",
            "source_id": "string",
        },
    ),
    VectorCollectionConfig(
        name="approved_strings",
        dimension=embedding_config.dimension,
        metadata_schema={
            "request_id": "string",
            "draft_version_id": "string",
            "language": "string",
            "feature_norm": "string",
            "device": "string",
            "status": "string",
        },
    ),
    VectorCollectionConfig(
        name="glossary_terms",
        dimension=embedding_config.dimension,
        metadata_schema={
            "term": "string",
            "translation": "string",
            "language_pair": "string",
            "device": "string",
            "must_use": "bool",
        },
    ),
    VectorCollectionConfig(
        name="context_snippets",
        dimension=embedding_config.dimension,
        metadata_schema={
            "context_id": "string",
            "product_area": "string",
            "locale": "string",
            "tags": "string[]",
        },
    ),
]

__all__ = [
    "EmbeddingModelConfig",
    "VectorCollectionConfig",
    "VectorStoreConfig",
    "embedding_config",
    "vector_store_config",
    "default_collections",
]
