import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.services.ingest.service import do_ingest

router = APIRouter(tags=["ingest"])
logger = logging.getLogger(__name__)


class IngestPayload(BaseModel):
    data_path: str = Field(default="input", description="Relative path from data/ directory (e.g., 'input' or 'mock/day6')")


@router.post("/ingest")
def ingest(payload: IngestPayload, db: Session = Depends(get_db_session)):
    logger.info(f"Ingest API called with payload: {payload}")
    logger.info(f"data_path value: {payload.data_path}")
    return do_ingest(db, data_path=payload.data_path)
