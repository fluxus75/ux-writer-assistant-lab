"""API routes for managing UX copy requests."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db import get_db_session
from app.db import models
from app.services.requests import service as request_service


router = APIRouter(tags=["requests"])


class RequestCreatePayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    feature_name: str = Field(..., min_length=1, max_length=255)
    context_description: Optional[str] = None
    source_text: Optional[str] = None
    tone: Optional[str] = Field(default=None, max_length=255)
    style_preferences: Optional[str] = None
    constraints: Optional[dict] = Field(default=None)
    assigned_writer_id: Optional[str] = Field(default=None)


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
    selected_version_id: Optional[str] = None


class RequestSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    feature_name: str
    status: models.RequestStatus
    assigned_writer_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    draft_count: int = 0


class RequestDetail(RequestSummary):
    context_description: Optional[str] = None
    source_text: Optional[str] = None
    tone: Optional[str] = None
    style_preferences: Optional[str] = None
    constraints_json: Optional[dict] = None
    drafts: List[DraftResponse] = []


class RequestListResponse(BaseModel):
    items: List[RequestSummary]


@router.post("/requests", response_model=RequestDetail, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: RequestCreatePayload,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER)),
):
    assigned_writer = None
    if payload.assigned_writer_id:
        assigned_writer = session.get(models.User, payload.assigned_writer_id)
        if not assigned_writer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned writer not found")
    try:
        request_obj = request_service.create_request(
            session,
            title=payload.title,
            feature_name=payload.feature_name,
            requested_by=user,
            context_description=payload.context_description,
            source_text=payload.source_text,
            tone=payload.tone,
            style_preferences=payload.style_preferences,
            constraints=payload.constraints,
            assigned_writer=assigned_writer,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return RequestDetail(
        id=request_obj.id,
        title=request_obj.title,
        feature_name=request_obj.feature_name,
        status=request_obj.status,
        assigned_writer_id=request_obj.assigned_writer_id,
        created_at=request_obj.created_at,
        updated_at=request_obj.updated_at,
        draft_count=len(request_obj.drafts),
        context_description=request_obj.context_description,
        source_text=request_obj.source_text,
        tone=request_obj.tone,
        style_preferences=request_obj.style_preferences,
        constraints_json=request_obj.constraints_json,
    )


@router.get("/requests", response_model=RequestListResponse)
def list_requests(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.WRITER, models.UserRole.ADMIN)),
    status_filter: Optional[models.RequestStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
):
    records = request_service.list_requests(session, status=status_filter, limit=limit)
    summaries = []
    for record in records:
        summaries.append(
            RequestSummary(
                id=record.id,
                title=record.title,
                feature_name=record.feature_name,
                status=record.status,
                assigned_writer_id=record.assigned_writer_id,
                created_at=record.created_at,
                updated_at=record.updated_at,
                draft_count=len(record.drafts),
            )
        )
    return RequestListResponse(items=summaries)


@router.get("/requests/{request_id}", response_model=RequestDetail)
def get_request(
    request_id: str,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.WRITER, models.UserRole.ADMIN)),
):
    record = request_service.get_request(session, request_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Build drafts with versions and selection info
    drafts_data = []
    for draft in record.drafts:
        versions_data = [
            DraftVersionResponse(
                id=version.id,
                version_index=version.version_index,
                content=version.content,
                metadata_json=version.metadata_json,
                created_at=version.created_at,
            )
            for version in draft.versions
        ]
        drafts_data.append(
            DraftResponse(
                id=draft.id,
                request_id=draft.request_id,
                llm_run_id=draft.llm_run_id,
                generation_method=draft.generation_method,
                created_by=draft.created_by,
                created_at=draft.created_at,
                versions=versions_data,
                selected_version_id=draft.selected_version_link.version_id if draft.selected_version_link else None,
            )
        )

    return RequestDetail(
        id=record.id,
        title=record.title,
        feature_name=record.feature_name,
        status=record.status,
        assigned_writer_id=record.assigned_writer_id,
        created_at=record.created_at,
        updated_at=record.updated_at,
        draft_count=len(record.drafts),
        context_description=record.context_description,
        source_text=record.source_text,
        tone=record.tone,
        style_preferences=record.style_preferences,
        constraints_json=record.constraints_json,
        drafts=drafts_data,
    )


__all__ = [
    "create_request",
    "list_requests",
    "get_request",
    "router",
]

