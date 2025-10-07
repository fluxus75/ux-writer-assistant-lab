"""Draft workflow endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db import get_db_session, models
from app.services.drafts.service import DraftGenerationParams, generate_ai_draft
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
    )


__all__ = ["generate_draft", "router"]

