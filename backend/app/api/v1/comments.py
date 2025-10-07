"""Comment endpoints for designer/writer collaboration."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db import get_db_session
from app.db import models
from app.services.comments import service as comments_service


router = APIRouter(tags=["comments"])


class CommentCreatePayload(BaseModel):
    request_id: str = Field(..., min_length=1)
    draft_version_id: Optional[str] = Field(default=None)
    body: str = Field(..., min_length=1)


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    request_id: str
    draft_version_id: Optional[str]
    author_id: str
    body: str
    status: models.CommentStatus
    created_at: datetime
    resolved_at: Optional[datetime]


class CommentListResponse(BaseModel):
    items: List[CommentResponse]


@router.post("/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    payload: CommentCreatePayload,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.WRITER, models.UserRole.ADMIN)),
):
    request_obj = session.get(models.Request, payload.request_id)
    if not request_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    draft_version = None
    if payload.draft_version_id:
        draft_version = session.get(models.DraftVersion, payload.draft_version_id)
        if not draft_version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft version not found")
    try:
        comment = comments_service.create_comment(
            session,
            request=request_obj,
            author=user,
            body=payload.body,
            draft_version=draft_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CommentResponse.model_validate(comment)


@router.get("/requests/{request_id}/comments", response_model=CommentListResponse)
def list_comments(
    request_id: str,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.WRITER, models.UserRole.ADMIN)),
):
    request_obj = session.get(models.Request, request_id)
    if not request_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    items = comments_service.list_comments(session, request=request_obj)
    return CommentListResponse(items=[CommentResponse.model_validate(item) for item in items])


@router.post("/comments/{comment_id}/resolve", response_model=CommentResponse)
def resolve_comment(
    comment_id: str = Path(..., min_length=1),
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.WRITER, models.UserRole.ADMIN)),
):
    comment = session.get(models.Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    comment = comments_service.resolve_comment(session, comment=comment, actor=user)
    return CommentResponse.model_validate(comment)


__all__ = ["router"]

