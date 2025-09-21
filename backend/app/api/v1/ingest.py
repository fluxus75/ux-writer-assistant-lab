from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.services.ingest.service import do_ingest

router = APIRouter(tags=["ingest"])

@router.post("/ingest")
def ingest(db: Session = Depends(get_db_session)):
    return do_ingest(db)
