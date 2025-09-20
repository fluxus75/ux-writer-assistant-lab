from fastapi import APIRouter, HTTPException, status

from app.services.translate.service import (
    TranslateRequest,
    TranslateResponse,
    TranslationServiceError,
    translate as svc,
)

router = APIRouter(tags=["translate"])

@router.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest):
    try:
        response = svc(req)
    except TranslationServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return response.model_dump()
