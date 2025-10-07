"""Audit logging helpers for workflow actions."""

from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.db import models


def record_audit_event(
    session: Session,
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    payload: Optional[Dict[str, Any]] = None,
    actor_id: Optional[str] = None,
) -> models.AuditLog:
    log = models.AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        payload_json=payload or {},
        actor_id=actor_id,
    )
    session.add(log)
    session.flush()
    session.refresh(log)
    return log


__all__ = ["record_audit_event"]

