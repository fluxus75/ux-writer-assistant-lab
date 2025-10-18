"""Prompt construction helpers for translation tasks."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

from app.services.llm.client import PromptMessage, PromptRequest


@dataclass(slots=True)
class TranslationPromptParams:
    text: str
    source_language: str
    target_language: str
    tone: Optional[str] = None
    style_guides: Iterable[str] = field(default_factory=tuple)
    glossary_hints: Dict[str, str] = field(default_factory=dict)
    retrieval_examples: Iterable[str] = field(default_factory=tuple)
    retrieval_examples_with_context: Iterable[Dict[str, str]] = field(default_factory=tuple)
    max_output_tokens: Optional[int] = None
    temperature: Optional[float] = None
    num_candidates: int = 1


def build_prompt(params: TranslationPromptParams) -> PromptRequest:
    """Create chat messages instructing the LLM to translate with style guidance."""

    system_parts: List[str] = [
        "You are an expert UX writer who translates product copy with precision.",
        "Always return polished UX strings ready for end users.",
        "Keep responses concise unless specifically asked to expand.",
    ]

    if params.num_candidates > 1:
        system_parts.append(
            "Each response will be generated independently. "
            "Use distinctly different vocabulary, sentence structures, and phrasings while maintaining the same meaning."
        )

    if params.tone:
        system_parts.append(f"Adhere to the requested tone: {params.tone}.")
    if params.style_guides:
        guides = "; ".join(params.style_guides)
        system_parts.append(f"Style notes: {guides}.")

    if params.glossary_hints:
        glossary_lines = [f"{src} -> {tgt}" for src, tgt in sorted(params.glossary_hints.items())]
        system_parts.append("Use glossary terms when applicable:" + "\n" + "\n".join(glossary_lines))

    if params.retrieval_examples_with_context:
        context_lines = []
        for idx, ex in enumerate(params.retrieval_examples_with_context, 1):
            context_lines.append(f"\nExample {idx}:")
            if ex.get("user_utterance"):
                context_lines.append(f"  User said: \"{ex['user_utterance']}\"")
            if ex.get("response_case"):
                context_lines.append(f"  Context: {ex['response_case']}")
            context_lines.append(f"  Response: {ex['text']}")
        system_parts.append("Reference these contextual examples for consistency:" + "".join(context_lines))
    elif params.retrieval_examples:
        example_lines = "\n".join(f"- {ex}" for ex in params.retrieval_examples)
        system_parts.append("Reference these examples for consistency:\n" + example_lines)

    system_message = PromptMessage(role="system", content="\n".join(system_parts))

    user_lines = [
        f"Source language: {params.source_language}",
        f"Target language: {params.target_language}",
        "Translate the following text:",
        params.text,
        "Respond with the translation only.",
    ]

    user_message = PromptMessage(role="user", content="\n".join(user_lines))

    return PromptRequest(
        messages=[system_message, user_message],
        temperature=params.temperature,
        max_output_tokens=params.max_output_tokens,
    )

