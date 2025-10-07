"""Business logic for UX copy requests."""

from __future__ import annotations

from typing import List
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models
from app.services.audit.service import record_audit_event


def create_request(
    session: Session,
    *,
    title: str,
    feature_name: str,
    requested_by: models.User,
    context_description: str | None = None,
    tone: str | None = None,
    style_preferences: str | None = None,
    constraints: dict | None = None,
    assigned_writer: models.User | None = None,
) -> models.Request:
    """Persist a new request record with default drafting status."""

    if assigned_writer and assigned_writer.role != models.UserRole.WRITER:
        raise ValueError("Assigned user must have writer role")

    request = models.Request(
        id=str(uuid4()),
        title=title,
        feature_name=feature_name,
        context_description=context_description,
        tone=tone,
        style_preferences=style_preferences,
        constraints_json=constraints,
        requested_by=requested_by.id,
        assigned_writer_id=assigned_writer.id if assigned_writer else None,
        status=models.RequestStatus.DRAFTING,
    )
    session.add(request)
    session.flush()
    session.refresh(request)
    record_audit_event(
        session,
        entity_type="request",
        entity_id=request.id,
        action="created",
        payload={
            "feature_name": feature_name,
            "tone": tone,
            "constraints": constraints or {},
        },
        actor_id=requested_by.id,
    )
    return request


def list_requests(
    session: Session,
    *,
    status: models.RequestStatus | None = None,
    limit: int = 50,
) -> List[models.Request]:
    query = select(models.Request).order_by(models.Request.created_at.desc())
    if status:
        query = query.where(models.Request.status == status)
    query = query.limit(max(1, min(limit, 200)))
    return list(session.scalars(query))


def get_request(session: Session, request_id: str) -> models.Request | None:
    return session.get(models.Request, request_id)


def reassign_writer(
    session: Session,
    request: models.Request,
    writer: models.User | None,
) -> None:
    if writer and writer.role != models.UserRole.WRITER:
        raise ValueError("Assigned user must have writer role")
    request.assigned_writer_id = writer.id if writer else None
    session.add(request)


__all__ = ["create_request", "list_requests", "get_request", "reassign_writer"]

