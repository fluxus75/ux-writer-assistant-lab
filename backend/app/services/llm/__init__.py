"""Factory utilities for obtaining LLM clients."""

from __future__ import annotations

from threading import Lock
from typing import Optional

from app.core.settings import settings

from .client import LLMClient, LLMClientError, OpenAIChatClient

_CLIENT_LOCK = Lock()
_CLIENT: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """Return a singleton LLM client configured via environment settings."""

    global _CLIENT
    if _CLIENT is None:
        with _CLIENT_LOCK:
            if _CLIENT is None:
                _CLIENT = _build_client()
    return _CLIENT


def _build_client() -> LLMClient:
    if settings.llm_provider == "openai":
        return OpenAIChatClient(
            model=settings.llm_model,
            api_key=settings.llm_api_key or "",
            base_url=settings.llm_base_url,
            default_temperature=settings.llm_temperature,
            timeout_seconds=settings.llm_timeout_seconds,
        )

    raise LLMClientError(f"Unsupported LLM provider: {settings.llm_provider}")

