"""Retrieve API exposing hybrid search results for RAG."""

from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.services.retrieve.service import retrieve as retrieve_service


class RetrievePayload(BaseModel):
    query: str = ""
    filters: Dict[str, str] = Field(default_factory=dict)
    topK: int = Field(default=5, ge=1, le=20)
    mode: Optional[str] = Field(default=None, pattern="^(feature|style)$")


router = APIRouter(tags=["retrieve"])


@router.post("/retrieve", status_code=status.HTTP_200_OK)
def retrieve(payload: RetrievePayload, session: Session = Depends(get_db_session)):
    return retrieve_service(
        session,
        query=payload.query,
        filters=payload.filters,
        top_k=payload.topK,
        mode=payload.mode,
    )
