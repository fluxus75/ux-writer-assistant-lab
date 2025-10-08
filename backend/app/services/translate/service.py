"""Translation service orchestrating retrieval, prompting, and guardrails."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import state
from app.core.settings import settings
from app.services.guardrails.loader import load_guardrail_rules
from app.services.guardrails.service import apply_guardrails
from app.services.llm import get_llm_client
from app.services.llm.client import LLMClientError
from app.services.retrieve.service import retrieve

from app.db import models

from .prompting import TranslationPromptParams, build_prompt


class TranslateOptions(BaseModel):
    tone: Optional[str] = None
    style_guides: List[str] = Field(default_factory=list)
    use_rag: bool = False
    rag_top_k: int = 3
    guardrails: bool = True
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None
    num_candidates: int = 1
    device: Optional[str] = None
    feature_norm: Optional[str] = None
    style_tag: Optional[str] = None


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
    guardrail: Optional[Dict[str, Any]] = None


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


def translate(
    request: TranslateRequest,
    *,
    session: Session | None = None,
    request_context: models.Request | None = None,
) -> TranslateResponse:
    options = request.options

    retrieval_debug: Dict[str, Any] = {"items": [], "latency_ms": 0, "mode": None, "feature_confidence": 0.0, "novelty_mode": False}
    retrieval_examples: List[str] = []
    if options.use_rag:
        rag_filters: Dict[str, Any] = {}
        if options.device:
            rag_filters["device"] = options.device
        if options.feature_norm:
            rag_filters["feature_norm"] = options.feature_norm
        if options.style_tag:
            rag_filters["style_tag"] = options.style_tag
        if not rag_filters and request_context and request_context.constraints_json:
            constraints = request_context.constraints_json or {}
            for key in ("device", "feature_norm", "style_tag"):
                value = constraints.get(key)
                if value:
                    rag_filters[key] = value
        if session is not None:
            retrieval_debug = retrieve(
                session,
                query=request.text,
                filters=rag_filters,
                top_k=max(1, options.rag_top_k),
            )
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

    base_text = llm_result.text.strip() or request.text.strip()
    num_candidates = max(1, min(options.num_candidates, 5))
    candidate_texts: List[str] = []
    for idx in range(num_candidates):
        if idx == 0:
            candidate_texts.append(base_text)
        elif idx == 1 and base_text.endswith("."):
            candidate_texts.append(base_text)
        else:
            candidate_texts.append(base_text)

    rules: Dict[str, Any] = {}
    if options.guardrails:
        state_rules = _collect_rules(request.run_id)
        db_rules: Dict[str, Any] = {}
        if session is not None:
            db_rules = load_guardrail_rules(session, request=request_context, extra_sources=[state_rules])
        else:
            db_rules = state_rules
        rules = db_rules
    candidates: List[TranslationCandidate] = []
    selected = base_text
    selected_guardrail = None
    for text in candidate_texts:
        guardrail_result = None
        if options.guardrails:
            guardrail_result = apply_guardrails(text, rules, request.hints)
            fixed = guardrail_result.get("fixed", text)
        else:
            fixed = text
        candidate_model = TranslationCandidate(text=fixed, guardrail=guardrail_result)
        candidates.append(candidate_model)
        if options.guardrails:
            passes = guardrail_result.get("passes", True) if guardrail_result else True
            if passes and selected_guardrail is None:
                selected = fixed
                selected_guardrail = guardrail_result
        else:
            selected = fixed
    if selected_guardrail is None and candidates:
        selected = candidates[0].text
        selected_guardrail = candidates[0].guardrail

    metadata = {
        "llm": {
            "latency_ms": llm_result.latency_ms,
            "model": settings.llm_model,
        },
        "retrieval": retrieval_debug,
        "guardrails": selected_guardrail,
        "novelty_mode": retrieval_debug.get("novelty_mode", False),
    }

    return TranslateResponse(
        selected=selected,
        candidates=candidates,
        rationale="LLM-first translation with optional guardrail adjustments",
        metadata=metadata,
    )

