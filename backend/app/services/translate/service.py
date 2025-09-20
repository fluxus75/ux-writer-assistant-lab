"""Translation service orchestrating retrieval, prompting, and guardrails."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.core import state
from app.core.settings import settings
from app.services.guardrails.service import apply_guardrails
from app.services.llm import get_llm_client
from app.services.llm.client import LLMClientError
from app.services.retrieve.service import retrieve

from .prompting import TranslationPromptParams, build_prompt


class TranslateOptions(BaseModel):
    tone: Optional[str] = None
    style_guides: List[str] = Field(default_factory=list)
    use_rag: bool = False
    rag_top_k: int = 3
    guardrails: bool = True
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None


class TranslateRequest(BaseModel):
    text: str
    source_language: str = Field(min_length=2, max_length=32)
    target_language: str = Field(min_length=2, max_length=32)
    run_id: Optional[str] = None
    context_ids: List[str] = Field(default_factory=list)
    hints: Dict[str, Any] = Field(default_factory=dict)
    glossary: Dict[str, str] = Field(default_factory=dict)
    options: TranslateOptions = Field(default_factory=TranslateOptions)


class TranslationCandidate(BaseModel):
    text: str


class TranslateResponse(BaseModel):
    selected: str
    candidates: List[TranslationCandidate]
    rationale: str
    metadata: Dict[str, Any]


class TranslationServiceError(RuntimeError):
    """Raised when the translation pipeline cannot complete."""


def _collect_rules(run_id: Optional[str]) -> Dict[str, Any]:
    if run_id:
        return state.RUN_LOGS.get(run_id, {}).get("rules", {})
    if state.RUN_LOGS:
        first_key = next(iter(state.RUN_LOGS))
        return state.RUN_LOGS.get(first_key, {}).get("rules", {})
    return {}


def _context_examples(ids: List[str]) -> List[str]:
    if not ids:
        return []
    lookup = set(ids)
    examples: List[str] = []
    for row in state.CONTEXT:
        if row.get("id") in lookup:
            candidate = row.get("en_line") or row.get("ko_response")
            if candidate:
                examples.append(str(candidate))
    return examples


def translate(request: TranslateRequest) -> TranslateResponse:
    options = request.options

    retrieval_debug = {"items": [], "latency_ms": 0}
    retrieval_examples: List[str] = []
    if options.use_rag:
        retrieval_debug = retrieve(query=request.text, filters={}, topK=max(1, options.rag_top_k))
        retrieval_examples = [item.get("en_line", "") for item in retrieval_debug.get("items", []) if item.get("en_line")]

    # Include explicit context examples even when RAG is disabled.
    retrieval_examples.extend(_context_examples(request.context_ids))

    prompt = build_prompt(
        TranslationPromptParams(
            text=request.text,
            source_language=request.source_language,
            target_language=request.target_language,
            tone=options.tone,
            style_guides=options.style_guides,
            glossary_hints=request.glossary,
            retrieval_examples=retrieval_examples,
            max_output_tokens=options.max_output_tokens,
            temperature=options.temperature,
        )
    )

    client = get_llm_client()
    try:
        llm_result = client.generate(prompt)
    except LLMClientError as exc:  # pragma: no cover - network error path exercised via tests mocks
        raise TranslationServiceError(str(exc)) from exc

    candidate_text = llm_result.text.strip()
    if not candidate_text:
        candidate_text = request.text.strip()

    candidates = [TranslationCandidate(text=candidate_text)]

    guardrail_result = {
        "passes": True,
        "violations": [],
        "fixed": candidate_text,
    }
    if options.guardrails:
        rules = _collect_rules(request.run_id)
        guardrail_result = apply_guardrails(candidate_text, rules, request.hints)

    selected = guardrail_result.get("fixed", candidate_text)

    metadata = {
        "llm": {
            "latency_ms": llm_result.latency_ms,
            "model": settings.llm_model,
        },
        "retrieval": retrieval_debug,
        "guardrails": guardrail_result,
    }

    return TranslateResponse(
        selected=selected,
        candidates=candidates,
        rationale="LLM-first translation with optional guardrail adjustments",
        metadata=metadata,
    )

