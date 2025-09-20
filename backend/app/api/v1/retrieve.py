from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict
from app.services.retrieve.service import retrieve as svc

class RetrieveReq(BaseModel):
    query: str = ""
    filters: Optional[Dict[str, str]] = None
    topK: int = 3

router = APIRouter(tags=["retrieve"])

@router.post("/retrieve")
def retrieve(req: RetrieveReq):
    return svc(req.query, req.filters, req.topK)
