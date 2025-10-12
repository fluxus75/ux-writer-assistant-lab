"""Draft generation and persistence helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db import models
from app.services.audit.service import record_audit_event
from app.services.translate.service import TranslateOptions, TranslateRequest, translate


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

    session.flush()
    draft.versions = versions
    session.refresh(draft)
    record_audit_event(
        session,
        entity_type="draft",
        entity_id=draft.id,
        action="generated",
        payload={
            "request_id": request.id,
            "candidate_count": len(versions),
            "novelty_mode": metadata_base.get("novelty_mode"),
        },
        actor_id=created_by.id,
    )
    return draft


def select_draft_version(
    session: Session,
    *,
    draft: models.Draft,
    version: models.DraftVersion,
    actor: models.User,
) -> models.SelectedDraftVersion:
    """Select a draft version for designer review."""

    if version.draft_id != draft.id:
        raise ValueError("Draft version does not belong to the given draft")

    selection = draft.selected_version_link
    timestamp = datetime.now(timezone.utc)
    if selection is None:
        selection = models.SelectedDraftVersion(
            draft_id=draft.id,
            version_id=version.id,
            selected_by=actor.id,
            selected_at=timestamp,
        )
        session.add(selection)
    else:
        selection.version_id = version.id
        selection.selected_by = actor.id
        selection.selected_at = timestamp
        session.add(selection)

    request = draft.request
    request.status = models.RequestStatus.IN_REVIEW
    session.add(request)
    session.flush()
    record_audit_event(
        session,
        entity_type="draft",
        entity_id=draft.id,
        action="version_selected",
        payload={"version_id": version.id},
        actor_id=actor.id,
    )
    session.refresh(selection)
    return selection


def clear_draft_selection(
    session: Session,
    *,
    draft: models.Draft,
    actor: models.User,
) -> None:
    """Clear the selected version for the draft."""

    selection = draft.selected_version_link
    if not selection:
        return

    session.delete(selection)
    session.flush()

    request = draft.request
    has_other_selection = any(
        other.selected_version_link is not None and other.id != draft.id
        for other in request.drafts
    )
    if not has_other_selection:
        request.status = models.RequestStatus.DRAFTING
        session.add(request)

    record_audit_event(
        session,
        entity_type="draft",
        entity_id=draft.id,
        action="selection_cleared",
        payload={},
        actor_id=actor.id,
    )


__all__ = [
    "DraftGenerationParams",
    "generate_ai_draft",
    "select_draft_version",
    "clear_draft_selection",
]

