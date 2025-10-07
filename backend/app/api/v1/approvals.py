"""Approval endpoints for closing the workflow."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db import get_db_session, models
from app.services.approvals.service import record_decision
from app.services.requests import service as request_service


router = APIRouter(tags=["approvals"])


class ApprovalPayload(BaseModel):
    request_id: str
    decision: models.ApprovalDecision
    comment: Optional[str] = Field(default=None, max_length=2000)


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    request_id: str
    decision: models.ApprovalDecision
    comment: Optional[str]
    decided_by: str
    decided_at: datetime
    request_status: models.RequestStatus


@router.post("/approvals", response_model=ApprovalResponse, status_code=status.HTTP_201_CREATED)
def create_approval(
    payload: ApprovalPayload,
    session: Session = Depends(get_db_session),
    actor: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.ADMIN)),
):
    request_obj = request_service.get_request(session, payload.request_id)
    if not request_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    approval = record_decision(
        session,
        request=request_obj,
        actor=actor,
        decision=payload.decision,
        comment=payload.comment,
    )
    session.refresh(request_obj)

    return ApprovalResponse(
        id=approval.id,
        request_id=approval.request_id,
        decision=approval.decision,
        comment=approval.comment,
        decided_by=approval.decided_by,
        decided_at=approval.decided_at,
        request_status=request_obj.status,
    )


__all__ = ["create_approval", "router"]

