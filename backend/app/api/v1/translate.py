from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.services.translate.service import (
    TranslateRequest,
    TranslateResponse,
    TranslationServiceError,
    translate as svc,
)

router = APIRouter(tags=["translate"])

@router.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest, session: Session = Depends(get_db_session)):
    try:
        response = svc(req, session=session)
    except TranslationServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return response.model_dump()
