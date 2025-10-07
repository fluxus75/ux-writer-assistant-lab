"""Approval workflow helpers."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy.orm import Session

from app.db import models


def record_decision(
    session: Session,
    *,
    request: models.Request,
    actor: models.User,
    decision: models.ApprovalDecision,
    comment: str | None = None,
) -> models.Approval:
    if actor.role not in {models.UserRole.DESIGNER, models.UserRole.ADMIN}:
        raise ValueError("Only designers or admins may record approvals")

    approval = models.Approval(
        id=str(uuid4()),
        request_id=request.id,
        decision=decision,
        comment=comment,
        decided_by=actor.id,
    )
    session.add(approval)

    if decision == models.ApprovalDecision.APPROVED:
        request.status = models.RequestStatus.APPROVED
    else:
        request.status = models.RequestStatus.REJECTED
    session.add(request)
    session.flush()
    session.refresh(approval)
    return approval


__all__ = ["record_decision"]

