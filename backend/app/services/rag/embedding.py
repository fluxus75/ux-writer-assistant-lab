"""Embedding client abstractions for RAG pipelines."""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from typing import Iterable, List, Sequence

import numpy as np

try:  # pragma: no cover - optional dependency
    import onnxruntime as ort
except Exception:  # pragma: no cover - optional dependency
    ort = None  # type: ignore

from app.core.settings import settings

logger = logging.getLogger(__name__)


def _pseudo_embedding(text: str, dimension: int) -> List[float]:
    """Return a deterministic embedding for environments without ONNX runtime."""

    if not text:
        return [0.0] * dimension
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    base_values = np.frombuffer(digest, dtype=np.uint8).astype(np.float32) / 255.0
    if dimension <= base_values.size:
        return base_values[:dimension].tolist()
    tiled = np.resize(base_values, dimension)
    return tiled.tolist()


@dataclass
class EmbeddingRequest:
    texts: Sequence[str]


class EmbeddingClient:
    """Load and execute bge-m3 embeddings via ONNXRuntime or stub fallback."""

    def __init__(self, model_path: str | None = None, dimension: int = 1024, backend: str | None = None):
        self.dimension = dimension
        self.backend = backend or settings.embedding_backend
        self._session = None
        self._tokenizer = None
        resolved_path = model_path or settings.embedding_onnx_path
        if self.backend == "onnx":
            if ort is None:
                raise RuntimeError("onnxruntime is required for the ONNX embedding backend")
            if not resolved_path or not os.path.exists(resolved_path):
                raise FileNotFoundError(
                    "EMBEDDING_ONNX_PATH must point to a local bge-m3 ONNX model when EMBEDDING_BACKEND=onnx"
                )
            session_opts = ort.SessionOptions()
            session_opts.enable_mem_pattern = False
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if ort.get_device().lower() == "gpu" else ["CPUExecutionProvider"]
            self._session = ort.InferenceSession(resolved_path, sess_options=session_opts, providers=providers)
            tokenizer_path = os.path.join(os.path.dirname(resolved_path), "tokenizer.json")
            if not os.path.exists(tokenizer_path):
                raise FileNotFoundError(
                    "Tokenizer JSON not found next to the ONNX model. See docs/day3-dev-environment.md for export steps."
                )
            try:  # pragma: no cover - heavy dependency
                from tokenizers import Tokenizer
            except Exception as exc:  # pragma: no cover
                raise RuntimeError("tokenizers package is required for ONNX embedding backend") from exc
            self._tokenizer = Tokenizer.from_file(tokenizer_path)
            logger.info("Loaded ONNX embedding model from %s", resolved_path)

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        inputs = list(texts)
        if not inputs:
            return []
        if self.backend != "onnx" or self._session is None or self._tokenizer is None:
            return [_pseudo_embedding(text, self.dimension) for text in inputs]

        encoded = self._tokenizer.encode_batch(inputs)
        input_ids = [item.ids for item in encoded]
        attention_mask = [[1] * len(ids) for ids in input_ids]
        max_len = max(len(ids) for ids in input_ids)
        padded_ids = [ids + [0] * (max_len - len(ids)) for ids in input_ids]
        padded_mask = [mask + [0] * (max_len - len(mask)) for mask in attention_mask]

        ort_inputs = {
            "input_ids": np.array(padded_ids, dtype=np.int64),
            "attention_mask": np.array(padded_mask, dtype=np.int64),
        }
        outputs = self._session.run(None, ort_inputs)
        if not outputs:
            raise RuntimeError("ONNX embedding session returned no outputs")
        embeddings = np.asarray(outputs[0])

        # BGE-M3 ONNX emits multi-vector tensors shaped (batch, num_vector_types, dim).
        # Collapse to the first (dense) vector so Qdrant always receives a flat embedding.
        if embeddings.ndim == 3:
            embeddings = embeddings[:, 0, :]

        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)
        elif embeddings.ndim != 2:
            squeezed = np.squeeze(embeddings)
            if squeezed.ndim == 1:
                embeddings = squeezed.reshape(1, -1)
            elif squeezed.ndim == 2:
                embeddings = squeezed
            else:
                raise RuntimeError(f"Unexpected embedding tensor shape: {embeddings.shape}")

        if embeddings.shape[1] != self.dimension:
            raise RuntimeError(
                f"Embedding dimension mismatch: expected {self.dimension}, got {embeddings.shape[1]}"
            )

        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        normalized = embeddings / norms
        return normalized.astype(np.float32).tolist()


def get_embedding_client() -> EmbeddingClient:
    """Factory that caches embedding clients for reuse."""

    global _EMBEDDING_CLIENT  # type: ignore
    try:
        client = _EMBEDDING_CLIENT
    except NameError:
        client = EmbeddingClient()
        _EMBEDDING_CLIENT = client  # type: ignore
    return client


__all__ = ["EmbeddingClient", "EmbeddingRequest", "get_embedding_client"]

