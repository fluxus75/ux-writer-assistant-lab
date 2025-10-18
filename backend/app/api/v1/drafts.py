"""Draft workflow endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db import get_db_session, models
from app.services.drafts.service import (
    DraftGenerationParams,
    clear_draft_selection,
    generate_ai_draft,
    select_draft_version,
)
from app.services.requests import service as request_service


router = APIRouter(tags=["drafts"])


class DraftGenerationPayload(BaseModel):
    request_id: str
    text: str
    source_language: str = Field(min_length=2, max_length=32)
    target_language: str = Field(min_length=2, max_length=32)
    hints: Dict[str, Any] = Field(default_factory=dict)
    glossary: Dict[str, str] = Field(default_factory=dict)
    num_candidates: int = Field(default=3, ge=1, le=5)
    use_rag: bool = True
    rag_top_k: int = Field(default=5, ge=1, le=20)
    temperature: Optional[float] = Field(default=None)


class DraftVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    version_index: int
    content: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime


class DraftResponse(BaseModel):
    id: str
    request_id: str
    llm_run_id: Optional[str]
    generation_method: models.DraftGenerationMethod
    created_by: str
    created_at: datetime
    versions: List[DraftVersionResponse]
    request_status: models.RequestStatus
    selected_version_id: Optional[str] = None


class DraftSelectionPayload(BaseModel):
    version_id: str
    comment: Optional[str] = None
    edited_content: Optional[str] = None


class DraftSelectionState(BaseModel):
    draft_id: str
    version_id: Optional[str] = None
    selected_by: Optional[str] = None
    selected_at: Optional[datetime] = None
    request_status: models.RequestStatus
    guardrail_result: Optional[Dict[str, Any]] = None
    grammar_check_result: Optional[Dict[str, Any]] = None
    comment_id: Optional[str] = None
    new_version_created: bool = False


@router.post("/drafts", response_model=DraftResponse, status_code=status.HTTP_201_CREATED)
def generate_draft(
    payload: DraftGenerationPayload,
    session: Session = Depends(get_db_session),
    actor: models.User = Depends(current_user(models.UserRole.WRITER, models.UserRole.DESIGNER)),
):
    request_obj = request_service.get_request(session, payload.request_id)
    if not request_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if actor.role == models.UserRole.WRITER and request_obj.assigned_writer_id not in {None, actor.id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Writer not assigned to this request")

    params = DraftGenerationParams(
        text=payload.text,
        source_language=payload.source_language,
        target_language=payload.target_language,
        hints=payload.hints,
        glossary=payload.glossary,
        num_candidates=payload.num_candidates,
        use_rag=payload.use_rag,
        rag_top_k=payload.rag_top_k,
        temperature=payload.temperature,
    )

    draft = generate_ai_draft(session, request=request_obj, created_by=actor, params=params)
    session.refresh(request_obj)

    return DraftResponse(
        id=draft.id,
        request_id=draft.request_id,
        llm_run_id=draft.llm_run_id,
        generation_method=draft.generation_method,
        created_by=draft.created_by,
        created_at=draft.created_at,
        versions=[
            DraftVersionResponse(
                id=version.id,
                version_index=version.version_index,
                content=version.content,
                metadata_json=version.metadata_json,
                created_at=version.created_at,
            )
            for version in draft.versions
        ],
        request_status=request_obj.status,
        selected_version_id=draft.selected_version_link.version_id if draft.selected_version_link else None,
    )


@router.post(
    "/drafts/{draft_id}/selection",
    response_model=DraftSelectionState,
    status_code=status.HTTP_200_OK,
)
def select_draft_version_endpoint(
    draft_id: str,
    payload: DraftSelectionPayload,
    session: Session = Depends(get_db_session),
    actor: models.User = Depends(current_user(models.UserRole.WRITER)),
):
    draft = session.get(models.Draft, draft_id)
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    if draft.request.assigned_writer_id not in {None, actor.id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Writer not assigned to this request")

    version = session.get(models.DraftVersion, payload.version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft version not found")

    try:
        selection, validation_metadata = select_draft_version(
            session,
            draft=draft,
            version=version,
            actor=actor,
            comment_text=payload.comment,
            edited_content=payload.edited_content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    session.refresh(draft.request)
    return DraftSelectionState(
        draft_id=draft.id,
        version_id=selection.version_id,
        selected_by=selection.selected_by,
        selected_at=selection.selected_at,
        request_status=draft.request.status,
        guardrail_result=validation_metadata.get("guardrail_result"),
        grammar_check_result=validation_metadata.get("grammar_check_result"),
        comment_id=validation_metadata.get("comment_id"),
        new_version_created=validation_metadata.get("new_version_created", False),
    )


@router.delete(
    "/drafts/{draft_id}/selection",
    response_model=DraftSelectionState,
    status_code=status.HTTP_200_OK,
)
def clear_draft_selection_endpoint(
    draft_id: str,
    session: Session = Depends(get_db_session),
    actor: models.User = Depends(current_user(models.UserRole.WRITER)),
):
    draft = session.get(models.Draft, draft_id)
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    if draft.request.assigned_writer_id not in {None, actor.id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Writer not assigned to this request")

    clear_draft_selection(session, draft=draft, actor=actor)
    session.refresh(draft.request)
    session.refresh(draft)

    selection = draft.selected_version_link
    return DraftSelectionState(
        draft_id=draft.id,
        version_id=selection.version_id if selection else None,
        selected_by=selection.selected_by if selection else None,
        selected_at=selection.selected_at if selection else None,
        request_status=draft.request.status,
    )


__all__ = ["generate_draft", "select_draft_version_endpoint", "clear_draft_selection_endpoint", "router"]

