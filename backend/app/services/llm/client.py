"""LLM client abstractions and provider-specific implementations."""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import List, Optional, Protocol

from openai import APIError, OpenAI, OpenAIError


class LLMClientError(RuntimeError):
    """Base exception for LLM client issues."""


@dataclass(slots=True)
class PromptMessage:
    role: str
    content: str


@dataclass(slots=True)
class PromptRequest:
    messages: List[PromptMessage]
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None
    n: Optional[int] = None


@dataclass(slots=True)
class LLMResult:
    text: str
    latency_ms: float
    raw: object
    candidates: List[str] = None  # Multiple candidates when n > 1

    def __post_init__(self):
        # If candidates not provided, use text as single candidate
        if self.candidates is None:
            object.__setattr__(self, 'candidates', [self.text])


class LLMClient(Protocol):
    """Minimal protocol for chat-capable LLM clients."""

    def generate(self, prompt: PromptRequest) -> LLMResult:  # pragma: no cover - interface definition
        raise NotImplementedError


class OpenAIChatClient:
    """OpenAI chat completion client wrapper."""

    def __init__(
        self,
        model: str,
        api_key: str,
        *,
        base_url: Optional[str] = None,
        default_temperature: float = 0.3,
        timeout_seconds: float = 30.0,
    ) -> None:
        if not api_key:
            raise LLMClientError("Missing OpenAI API key; set LLM_API_KEY in environment")

        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        if timeout_seconds:
            client_kwargs["timeout"] = timeout_seconds

        self._client = OpenAI(**client_kwargs)
        self._model = model
        self._default_temperature = default_temperature

    def generate(self, prompt: PromptRequest) -> LLMResult:
        try:
            start = perf_counter()
            completion = self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": m.role, "content": m.content} for m in prompt.messages],
                temperature=prompt.temperature if prompt.temperature is not None else self._default_temperature,
                max_tokens=prompt.max_output_tokens,
                n=prompt.n if prompt.n is not None else 1,
            )
        except (APIError, OpenAIError) as exc:  # pragma: no cover - network error path
            raise LLMClientError(str(exc)) from exc
        except Exception as exc:  # pragma: no cover - defensive programming
            raise LLMClientError(str(exc)) from exc

        elapsed_ms = (perf_counter() - start) * 1000.0

        # Extract all candidates from choices
        candidates = []
        for choice in completion.choices:
            if choice.message.content:
                candidates.append(choice.message.content)

        # First candidate as primary text (for backward compatibility)
        text = candidates[0] if candidates else ""

        return LLMResult(text=text, latency_ms=elapsed_ms, raw=completion, candidates=candidates)
