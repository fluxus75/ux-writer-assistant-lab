"""Comment workflow helpers."""

from __future__ import annotations

from typing import List
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.sql import func
from sqlalchemy.orm import Session

from app.db import models
from app.services.audit.service import record_audit_event


def create_comment(
    session: Session,
    *,
    request: models.Request,
    author: models.User,
    body: str,
    draft_version: models.DraftVersion | None = None,
) -> models.Comment:
    if not body.strip():
        raise ValueError("Comment body must not be empty")

    comment = models.Comment(
        id=str(uuid4()),
        request_id=request.id,
        draft_version_id=draft_version.id if draft_version else None,
        author_id=author.id,
        body=body.strip(),
    )
    session.add(comment)
    session.flush()
    session.refresh(comment)
    record_audit_event(
        session,
        entity_type="comment",
        entity_id=comment.id,
        action="created",
        payload={"request_id": request.id, "draft_version_id": comment.draft_version_id},
        actor_id=author.id,
    )
    return comment


def resolve_comment(
    session: Session,
    *,
    comment: models.Comment,
    actor: models.User,
) -> models.Comment:
    if comment.status == models.CommentStatus.RESOLVED:
        return comment
    comment.status = models.CommentStatus.RESOLVED
    comment.resolved_at = func.now()
    session.add(comment)
    session.flush()
    session.refresh(comment)
    record_audit_event(
        session,
        entity_type="comment",
        entity_id=comment.id,
        action="resolved",
        payload={"request_id": comment.request_id},
        actor_id=actor.id,
    )
    return comment


def list_comments(session: Session, *, request: models.Request) -> List[models.Comment]:
    stmt = select(models.Comment).where(models.Comment.request_id == request.id).order_by(models.Comment.created_at.asc())
    return list(session.scalars(stmt))


__all__ = ["create_comment", "resolve_comment", "list_comments"]

