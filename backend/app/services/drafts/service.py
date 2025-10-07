"""Draft generation and persistence helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db import models
from app.services.translate.service import TranslateRequest, TranslateOptions, translate


@dataclass
class DraftGenerationParams:
    text: str
    source_language: str
    target_language: str
    hints: Dict[str, Any] = field(default_factory=dict)
    glossary: Dict[str, str] = field(default_factory=dict)
    num_candidates: int = 3
    use_rag: bool = True
    rag_top_k: int = 5
    temperature: Optional[float] = None


def generate_ai_draft(
    session: Session,
    *,
    request: models.Request,
    created_by: models.User,
    params: DraftGenerationParams,
) -> models.Draft:
    """Generate AI-backed draft candidates and persist versions."""

    llm_run_id = str(uuid4())
    translate_response = translate(
        TranslateRequest(
            text=params.text,
            source_language=params.source_language,
            target_language=params.target_language,
            hints=params.hints,
            glossary=params.glossary,
            options=TranslateOptions(
                tone=request.tone,
                use_rag=params.use_rag,
                rag_top_k=params.rag_top_k,
                guardrails=True,
                temperature=params.temperature,
                num_candidates=params.num_candidates,
                device=(request.constraints_json or {}).get("device") if request.constraints_json else None,
                feature_norm=(request.constraints_json or {}).get("feature_norm") if request.constraints_json else None,
                style_tag=(request.constraints_json or {}).get("style_tag") if request.constraints_json else None,
            ),
        ),
        session=session,
        request_context=request,
    )

    draft = models.Draft(
        id=str(uuid4()),
        request_id=request.id,
        llm_run_id=llm_run_id,
        generation_method=models.DraftGenerationMethod.AI,
        created_by=created_by.id,
    )
    session.add(draft)
    session.flush()

    metadata_base = {
        "retrieval": translate_response.metadata.get("retrieval"),
        "novelty_mode": translate_response.metadata.get("novelty_mode"),
    }

    versions: List[models.DraftVersion] = []
    for idx, candidate in enumerate(translate_response.candidates, start=1):
        guardrail_result = candidate.guardrail or translate_response.metadata.get("guardrails")
        content = guardrail_result.get("fixed", candidate.text) if guardrail_result else candidate.text
        version = models.DraftVersion(
            id=str(uuid4()),
            draft_id=draft.id,
            version_index=idx,
            content=content,
            metadata_json={
                **metadata_base,
                "candidate_index": idx,
                "original_text": candidate.text,
                "guardrail_result": guardrail_result,
            },
            created_by=created_by.id,
        )
        session.add(version)
        versions.append(version)

    request.status = models.RequestStatus.IN_REVIEW
    session.add(request)
    session.flush()
    draft.versions = versions
    session.refresh(draft)
    return draft


__all__ = ["DraftGenerationParams", "generate_ai_draft"]

