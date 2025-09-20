from fastapi import APIRouter
from app.services.ingest.service import do_ingest

router = APIRouter(tags=["ingest"])

@router.post("/ingest")
def ingest():
    return do_ingest()
