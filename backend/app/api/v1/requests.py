"""API routes for managing UX copy requests."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db import get_db_session
from app.db import models
from app.services.requests import service as request_service
from app.services.requests.csv_validator import validate_csv_file


router = APIRouter(tags=["requests"])


class RequestCreatePayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    feature_name: str = Field(..., min_length=1, max_length=255)
    context_description: Optional[str] = None
    source_text: Optional[str] = None
    tone: Optional[str] = Field(default=None, max_length=255)
    style_preferences: Optional[str] = None
    constraints: Optional[dict] = Field(default=None)
    assigned_writer_id: Optional[str] = Field(default=None)


class DraftVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    version_index: int
    content: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime


class DraftResponse(BaseModel):
    id: str
    request_id: str
    llm_run_id: Optional[str]
    generation_method: models.DraftGenerationMethod
    created_by: str
    created_at: datetime
    versions: List[DraftVersionResponse]
    selected_version_id: Optional[str] = None


class RequestSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    status: models.RequestStatus
    source_text: Optional[str] = None
    latest_draft_content: Optional[str] = None
    assigned_writer_id: Optional[str] = None
    assigned_writer_name: Optional[str] = None
    requested_by_name: Optional[str] = None
    updated_at: datetime


class RequestDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    feature_name: str
    status: models.RequestStatus
    requested_by: str
    assigned_writer_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    context_description: Optional[str] = None
    source_text: Optional[str] = None
    tone: Optional[str] = None
    style_preferences: Optional[str] = None
    constraints_json: Optional[dict] = None
    drafts: List[DraftResponse] = []


class PaginationMeta(BaseModel):
    """Pagination metadata."""

    total_count: int
    page: int
    page_size: int
    total_pages: int


class RequestListResponse(BaseModel):
    items: List[RequestSummary]
    pagination: Optional[PaginationMeta] = None


class BatchCreateResponse(BaseModel):
    """Response for batch request creation."""

    success: bool
    created_count: int
    created_request_ids: List[str]
    errors: Optional[List[Dict[str, Any]]] = None
    validation_summary: Optional[Dict[str, Any]] = None


class DesignerStatistics(BaseModel):
    """Statistics for a single designer."""

    designer_id: str
    designer_name: str
    designer_email: str
    request_count: int


class RequestStatistics(BaseModel):
    """Aggregated request statistics."""

    total_count: int
    by_designer: List[DesignerStatistics]
    by_status: Dict[str, int]


class ApprovedRequestItem(BaseModel):
    """Approved request data for download."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    feature_name: str
    source_text: Optional[str]
    approved_draft_content: Optional[str]
    device: Optional[str]
    assigned_writer_id: Optional[str]
    assigned_writer_name: Optional[str]
    approved_at: datetime
    created_at: datetime


class ApprovedRequestListResponse(BaseModel):
    items: List[ApprovedRequestItem]
    total_count: int


class DownloadExcelPayload(BaseModel):
    request_ids: List[str] = Field(..., min_length=1)


@router.post("/requests", response_model=RequestDetail, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: RequestCreatePayload,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER)),
):
    assigned_writer = None
    if payload.assigned_writer_id:
        assigned_writer = session.get(models.User, payload.assigned_writer_id)
        if not assigned_writer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned writer not found")

    # Auto-normalize feature_norm if device is provided but feature_norm is not
    constraints = payload.constraints or {}
    if constraints.get("device") and not constraints.get("feature_norm"):
        from app.services.taxonomy import normalize_feature_name
        try:
            feature_norm = normalize_feature_name(
                payload.feature_name,
                constraints["device"],
                session,
            )
            constraints["feature_norm"] = feature_norm
        except Exception:
            # If normalization fails, continue without feature_norm
            pass

    try:
        request_obj = request_service.create_request(
            session,
            title=payload.title,
            feature_name=payload.feature_name,
            requested_by=user,
            context_description=payload.context_description,
            source_text=payload.source_text,
            tone=payload.tone,
            style_preferences=payload.style_preferences,
            constraints=constraints,
            assigned_writer=assigned_writer,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return RequestDetail(
        id=request_obj.id,
        title=request_obj.title,
        feature_name=request_obj.feature_name,
        status=request_obj.status,
        requested_by=request_obj.requested_by,
        assigned_writer_id=request_obj.assigned_writer_id,
        created_at=request_obj.created_at,
        updated_at=request_obj.updated_at,
        draft_count=len(request_obj.drafts),
        context_description=request_obj.context_description,
        source_text=request_obj.source_text,
        tone=request_obj.tone,
        style_preferences=request_obj.style_preferences,
        constraints_json=request_obj.constraints_json,
    )


@router.get("/requests", response_model=RequestListResponse)
def list_requests(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.WRITER, models.UserRole.ADMIN)),
    status_filter: Optional[models.RequestStatus] = Query(default=None, alias="status"),
    requested_by: Optional[str] = Query(default=None, description="Filter by designer ID"),
    assigned_writer_id: Optional[str] = Query(default=None, description="Filter by writer ID"),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=50, description="Items per page"),
):
    """
    List requests with pagination and filtering.

    Supports filtering by:
    - status: Request status (drafting, in_review, approved, rejected)
    - requested_by: Designer user ID
    - assigned_writer_id: Writer user ID

    Results are sorted by created_at in descending order (newest first).
    """
    # Build query with filters
    from sqlalchemy import func, select
    from sqlalchemy.orm import selectinload

    # Load request with related data
    query = select(models.Request).options(
        selectinload(models.Request.drafts).selectinload(models.Draft.versions),
        selectinload(models.Request.assigned_writer_user),
        selectinload(models.Request.requested_by_user),
    )

    # Apply filters
    if status_filter:
        query = query.where(models.Request.status == status_filter)
    if requested_by:
        query = query.where(models.Request.requested_by == requested_by)
    if assigned_writer_id:
        query = query.where(models.Request.assigned_writer_id == assigned_writer_id)

    # Order by updated_at descending (most recently updated first)
    query = query.order_by(models.Request.updated_at.desc())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.execute(count_query).scalar() or 0

    # Calculate pagination
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0
    offset = (page - 1) * page_size

    # Apply pagination
    query = query.offset(offset).limit(page_size)

    # Execute query
    records = list(session.scalars(query))

    # Build response
    summaries = []
    for record in records:
        # Get latest draft content
        latest_draft_content = None
        if record.drafts:
            # Sort drafts by created_at descending
            sorted_drafts = sorted(record.drafts, key=lambda d: d.created_at, reverse=True)
            if sorted_drafts and sorted_drafts[0].versions:
                # Get latest version from latest draft
                sorted_versions = sorted(sorted_drafts[0].versions, key=lambda v: v.version_index, reverse=True)
                if sorted_versions:
                    latest_draft_content = sorted_versions[0].content

        summaries.append(
            RequestSummary(
                id=record.id,
                title=record.title,
                status=record.status,
                source_text=record.source_text,
                latest_draft_content=latest_draft_content,
                assigned_writer_id=record.assigned_writer_id,
                assigned_writer_name=record.assigned_writer_user.name if record.assigned_writer_user else None,
                requested_by_name=record.requested_by_user.name if record.requested_by_user else None,
                updated_at=record.updated_at,
            )
        )

    pagination = PaginationMeta(
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

    return RequestListResponse(items=summaries, pagination=pagination)


@router.get("/requests/approved", response_model=ApprovedRequestListResponse)
def get_approved_requests(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER)),
    from_date: Optional[str] = Query(default=None, description="Start date filter (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(default=None, description="End date filter (YYYY-MM-DD)"),
    writer_id: Optional[str] = Query(default=None, description="Filter by writer ID"),
    device: Optional[str] = Query(default=None, description="Filter by device"),
):
    """
    Get approved requests with optional filters for download.

    Filters:
    - from_date: Filter by approval date (updated_at >= from_date)
    - to_date: Filter by approval date (updated_at <= to_date)
    - writer_id: Filter by assigned writer
    - device: Filter by device (from constraints_json)

    Only accessible by Designers.
    """
    from sqlalchemy import and_, func, select
    from sqlalchemy.orm import selectinload

    # Build query for approved requests
    query = select(models.Request).options(
        selectinload(models.Request.drafts).selectinload(models.Draft.versions),
        selectinload(models.Request.drafts).selectinload(models.Draft.selected_version_link),
        selectinload(models.Request.assigned_writer_user),
    ).where(models.Request.status == models.RequestStatus.APPROVED)

    # Apply filters
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date)
            query = query.where(models.Request.updated_at >= from_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid from_date format. Use YYYY-MM-DD",
            )

    if to_date:
        try:
            # Add 1 day to include the entire end date
            to_dt = datetime.fromisoformat(to_date)
            # Set to end of day
            from datetime import timedelta
            to_dt = to_dt + timedelta(days=1)
            query = query.where(models.Request.updated_at < to_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid to_date format. Use YYYY-MM-DD",
            )

    if writer_id:
        query = query.where(models.Request.assigned_writer_id == writer_id)

    if device:
        # Filter by device in constraints_json
        query = query.where(
            func.json_extract(models.Request.constraints_json, '$.device') == device
        )

    # Order by updated_at descending
    query = query.order_by(models.Request.updated_at.desc())

    # Execute query
    records = list(session.scalars(query))

    # Build response
    items = []
    for record in records:
        # Find approved draft content (selected version)
        approved_content = None
        for draft in record.drafts:
            if draft.selected_version_link:
                # Find the selected version
                for version in draft.versions:
                    if version.id == draft.selected_version_link.version_id:
                        approved_content = version.content
                        break
                if approved_content:
                    break

        # Extract device from constraints_json
        device_value = None
        if record.constraints_json and isinstance(record.constraints_json, dict):
            device_value = record.constraints_json.get("device")

        items.append(
            ApprovedRequestItem(
                id=record.id,
                title=record.title,
                feature_name=record.feature_name,
                source_text=record.source_text,
                approved_draft_content=approved_content,
                device=device_value,
                assigned_writer_id=record.assigned_writer_id,
                assigned_writer_name=record.assigned_writer_user.name if record.assigned_writer_user else None,
                approved_at=record.updated_at,
                created_at=record.created_at,
            )
        )

    return ApprovedRequestListResponse(
        items=items,
        total_count=len(items),
    )


@router.get("/requests/statistics", response_model=RequestStatistics)
def get_request_statistics(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.WRITER, models.UserRole.ADMIN)),
):
    """
    Get aggregated request statistics.

    Returns:
    - Total request count
    - Top 10 designers by request count
    - Request count by status

    Only accessible by Writers and Admins.
    """
    from sqlalchemy import func, select

    # Get total count
    total_count_query = select(func.count(models.Request.id))
    total_count = session.execute(total_count_query).scalar() or 0

    # Get designer statistics (top 10)
    designer_stats_query = (
        select(
            models.Request.requested_by,
            models.User.name,
            models.User.email,
            func.count(models.Request.id).label('request_count')
        )
        .join(models.User, models.Request.requested_by == models.User.id)
        .group_by(models.Request.requested_by, models.User.name, models.User.email)
        .order_by(func.count(models.Request.id).desc())
        .limit(10)
    )

    designer_stats_results = session.execute(designer_stats_query).all()
    by_designer = [
        DesignerStatistics(
            designer_id=row[0],
            designer_name=row[1],
            designer_email=row[2],
            request_count=row[3],
        )
        for row in designer_stats_results
    ]

    # Get status statistics
    status_stats_query = (
        select(
            models.Request.status,
            func.count(models.Request.id).label('count')
        )
        .group_by(models.Request.status)
    )

    status_stats_results = session.execute(status_stats_query).all()
    by_status = {
        str(row[0].value): row[1]
        for row in status_stats_results
    }

    return RequestStatistics(
        total_count=total_count,
        by_designer=by_designer,
        by_status=by_status,
    )


@router.get("/requests/{request_id}", response_model=RequestDetail)
def get_request(
    request_id: str,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER, models.UserRole.WRITER, models.UserRole.ADMIN)),
):
    record = request_service.get_request(session, request_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Build drafts with versions and selection info
    drafts_data = []
    for draft in record.drafts:
        versions_data = [
            DraftVersionResponse(
                id=version.id,
                version_index=version.version_index,
                content=version.content,
                metadata_json=version.metadata_json,
                created_at=version.created_at,
            )
            for version in draft.versions
        ]
        drafts_data.append(
            DraftResponse(
                id=draft.id,
                request_id=draft.request_id,
                llm_run_id=draft.llm_run_id,
                generation_method=draft.generation_method,
                created_by=draft.created_by,
                created_at=draft.created_at,
                versions=versions_data,
                selected_version_id=draft.selected_version_link.version_id if draft.selected_version_link else None,
            )
        )

    return RequestDetail(
        id=record.id,
        title=record.title,
        feature_name=record.feature_name,
        status=record.status,
        requested_by=record.requested_by,
        assigned_writer_id=record.assigned_writer_id,
        created_at=record.created_at,
        updated_at=record.updated_at,
        draft_count=len(record.drafts),
        context_description=record.context_description,
        source_text=record.source_text,
        tone=record.tone,
        style_preferences=record.style_preferences,
        constraints_json=record.constraints_json,
        drafts=drafts_data,
    )


@router.post("/requests/batch", response_model=BatchCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_batch_requests(
    file: UploadFile = File(...),
    assigned_writer_id: Optional[str] = Query(default=None),
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER)),
):
    """
    Create multiple requests from a CSV file upload.

    The CSV file should contain the following columns:
    - Required: title, feature_name
    - Optional: context_description, source_text, tone, style_preferences, device

    All requests will be assigned to the same writer (if specified).
    Transaction is atomic: if any request fails, all are rolled back.
    """
    # Validate file type
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file (.csv extension required)",
        )

    # Validate file size (max 1MB)
    MAX_FILE_SIZE = 1024 * 1024  # 1MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / 1024 / 1024}MB",
        )

    # Decode CSV content
    try:
        csv_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded",
        )

    # Validate CSV content
    validation_result = validate_csv_file(session, csv_content)

    if not validation_result.is_valid:
        # Return validation errors
        error_details = [
            {
                "row_number": err.row_number,
                "field": err.field,
                "error": err.error,
            }
            for err in validation_result.errors
        ]
        return BatchCreateResponse(
            success=False,
            created_count=0,
            created_request_ids=[],
            errors=error_details,
            validation_summary={
                "total_rows": validation_result.total_rows,
                "valid_rows": len(validation_result.valid_rows),
                "error_count": len(validation_result.errors),
            },
        )

    # Validate assigned writer if provided
    assigned_writer = None
    if assigned_writer_id:
        assigned_writer = session.get(models.User, assigned_writer_id)
        if not assigned_writer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned writer not found",
            )
        if assigned_writer.role != models.UserRole.WRITER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user must have writer role",
            )

    # Create all requests in a transaction
    created_ids: List[str] = []
    try:
        with session.begin_nested():  # Create a savepoint for rollback
            for csv_row in validation_result.valid_rows:
                # Build constraints with device and feature_norm
                constraints = {}
                if csv_row.device:
                    constraints["device"] = csv_row.device
                    # Auto-normalize feature_norm if device is provided
                    try:
                        from app.services.taxonomy import normalize_feature_name
                        feature_norm = normalize_feature_name(
                            csv_row.feature_name,
                            csv_row.device,
                            session,
                        )
                        constraints["feature_norm"] = feature_norm
                    except Exception:
                        # If normalization fails, continue without feature_norm
                        pass

                # Create request using service
                request_obj = request_service.create_request(
                    session,
                    title=csv_row.title,
                    feature_name=csv_row.feature_name,
                    requested_by=user,
                    context_description=csv_row.context_description,
                    source_text=csv_row.source_text,
                    tone=csv_row.tone,
                    style_preferences=csv_row.style_preferences,
                    constraints=constraints or None,
                    assigned_writer=assigned_writer,
                )
                created_ids.append(request_obj.id)

        # Commit the transaction
        session.commit()

        return BatchCreateResponse(
            success=True,
            created_count=len(created_ids),
            created_request_ids=created_ids,
            validation_summary={
                "total_rows": len(created_ids),
                "valid_rows": len(created_ids),
                "error_count": 0,
            },
        )

    except ValueError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create requests: {str(exc)}",
        ) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during batch creation: {str(exc)}",
        ) from exc


@router.get("/requests/statistics", response_model=RequestStatistics)
def get_request_statistics(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.WRITER, models.UserRole.ADMIN)),
):
    """
    Get aggregated request statistics.

    Returns:
    - Total request count
    - Top 10 designers by request count
    - Request count by status

    Only accessible by Writers and Admins.
    """
    from sqlalchemy import func, select

    # Get total count
    total_count_query = select(func.count(models.Request.id))
    total_count = session.execute(total_count_query).scalar() or 0

    # Get designer statistics (top 10)
    designer_stats_query = (
        select(
            models.Request.requested_by,
            models.User.name,
            models.User.email,
            func.count(models.Request.id).label('request_count')
        )
        .join(models.User, models.Request.requested_by == models.User.id)
        .group_by(models.Request.requested_by, models.User.name, models.User.email)
        .order_by(func.count(models.Request.id).desc())
        .limit(10)
    )

    designer_stats_results = session.execute(designer_stats_query).all()
    by_designer = [
        DesignerStatistics(
            designer_id=row[0],
            designer_name=row[1],
            designer_email=row[2],
            request_count=row[3],
        )
        for row in designer_stats_results
    ]

    # Get status statistics
    status_stats_query = (
        select(
            models.Request.status,
            func.count(models.Request.id).label('count')
        )
        .group_by(models.Request.status)
    )

    status_stats_results = session.execute(status_stats_query).all()
    by_status = {
        str(row[0].value): row[1]
        for row in status_stats_results
    }

    return RequestStatistics(
        total_count=total_count,
        by_designer=by_designer,
        by_status=by_status,
    )


class CancelRequestPayload(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class CancelRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: models.RequestStatus
    message: str


@router.post("/requests/{request_id}/cancel", response_model=CancelRequestResponse)
def cancel_request(
    request_id: str,
    payload: CancelRequestPayload,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER)),
):
    """
    Cancel a request. Only the designer who created the request can cancel it.

    Can only cancel requests in DRAFTING or NEEDS_REVISION status.
    """
    # Get the request
    request_obj = request_service.get_request(session, request_id)
    if not request_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Cancel the request
    try:
        updated_request = request_service.cancel_request(
            session,
            request=request_obj,
            cancelled_by=user,
            reason=payload.reason,
        )
        session.commit()

        return CancelRequestResponse(
            id=updated_request.id,
            status=updated_request.status,
            message="Request cancelled successfully",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


class ApprovedRequestItem(BaseModel):
    """Approved request data for download."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    feature_name: str
    source_text: Optional[str]
    approved_draft_content: Optional[str]
    device: Optional[str]
    assigned_writer_id: Optional[str]
    assigned_writer_name: Optional[str]
    approved_at: datetime
    created_at: datetime


class ApprovedRequestListResponse(BaseModel):
    items: List[ApprovedRequestItem]
    total_count: int


class DownloadExcelPayload(BaseModel):
    request_ids: List[str] = Field(..., min_length=1)


@router.get("/requests/approved", response_model=ApprovedRequestListResponse)
def get_approved_requests(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER)),
    from_date: Optional[str] = Query(default=None, description="Start date filter (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(default=None, description="End date filter (YYYY-MM-DD)"),
    writer_id: Optional[str] = Query(default=None, description="Filter by writer ID"),
    device: Optional[str] = Query(default=None, description="Filter by device"),
):
    """
    Get approved requests with optional filters for download.

    Filters:
    - from_date: Filter by approval date (updated_at >= from_date)
    - to_date: Filter by approval date (updated_at <= to_date)
    - writer_id: Filter by assigned writer
    - device: Filter by device (from constraints_json)

    Only accessible by Designers.
    """
    from sqlalchemy import and_, func, select
    from sqlalchemy.orm import selectinload

    # Build query for approved requests
    query = select(models.Request).options(
        selectinload(models.Request.drafts).selectinload(models.Draft.versions),
        selectinload(models.Request.drafts).selectinload(models.Draft.selected_version_link),
        selectinload(models.Request.assigned_writer_user),
    ).where(models.Request.status == models.RequestStatus.APPROVED)

    # Apply filters
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date)
            query = query.where(models.Request.updated_at >= from_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid from_date format. Use YYYY-MM-DD",
            )

    if to_date:
        try:
            # Add 1 day to include the entire end date
            to_dt = datetime.fromisoformat(to_date)
            # Set to end of day
            from datetime import timedelta
            to_dt = to_dt + timedelta(days=1)
            query = query.where(models.Request.updated_at < to_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid to_date format. Use YYYY-MM-DD",
            )

    if writer_id:
        query = query.where(models.Request.assigned_writer_id == writer_id)

    if device:
        # Filter by device in constraints_json
        query = query.where(
            func.json_extract(models.Request.constraints_json, '$.device') == device
        )

    # Order by updated_at descending
    query = query.order_by(models.Request.updated_at.desc())

    # Execute query
    records = list(session.scalars(query))

    # Build response
    items = []
    for record in records:
        # Find approved draft content (selected version)
        approved_content = None
        for draft in record.drafts:
            if draft.selected_version_link:
                # Find the selected version
                for version in draft.versions:
                    if version.id == draft.selected_version_link.version_id:
                        approved_content = version.content
                        break
                if approved_content:
                    break

        # Extract device from constraints_json
        device_value = None
        if record.constraints_json and isinstance(record.constraints_json, dict):
            device_value = record.constraints_json.get("device")

        items.append(
            ApprovedRequestItem(
                id=record.id,
                title=record.title,
                feature_name=record.feature_name,
                source_text=record.source_text,
                approved_draft_content=approved_content,
                device=device_value,
                assigned_writer_id=record.assigned_writer_id,
                assigned_writer_name=record.assigned_writer_user.name if record.assigned_writer_user else None,
                approved_at=record.updated_at,
                created_at=record.created_at,
            )
        )

    return ApprovedRequestListResponse(
        items=items,
        total_count=len(items),
    )


@router.post("/requests/download/excel")
def download_requests_excel(
    payload: DownloadExcelPayload,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.DESIGNER)),
):
    """
    Download selected approved requests as Excel file.

    Requires a list of request IDs in the payload.
    Only accessible by Designers.
    """
    from io import BytesIO
    from openpyxl import Workbook
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    # Fetch requests
    query = select(models.Request).options(
        selectinload(models.Request.drafts).selectinload(models.Draft.versions),
        selectinload(models.Request.drafts).selectinload(models.Draft.selected_version_link),
        selectinload(models.Request.assigned_writer_user),
    ).where(models.Request.id.in_(payload.request_ids))

    records = list(session.scalars(query))

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No requests found for the provided IDs",
        )

    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Approved Requests"

    # Define headers
    headers = [
        "Device",
        "제목",
        "원문 (KO)",
        "영문안",
        "Feature Name",
        "Writer",
        "승인일자",
        "요청일자",
    ]
    ws.append(headers)

    # Add data rows
    for record in records:
        # Find approved draft content
        approved_content = None
        for draft in record.drafts:
            if draft.selected_version_link:
                for version in draft.versions:
                    if version.id == draft.selected_version_link.version_id:
                        approved_content = version.content
                        break
                if approved_content:
                    break

        # Extract device
        device_value = None
        if record.constraints_json and isinstance(record.constraints_json, dict):
            device_value = record.constraints_json.get("device")

        # Format dates
        approved_date = record.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        created_date = record.created_at.strftime("%Y-%m-%d %H:%M:%S")

        row = [
            device_value or "",
            record.title,
            record.source_text or "",
            approved_content or "",
            record.feature_name,
            record.assigned_writer_user.name if record.assigned_writer_user else "",
            approved_date,
            created_date,
        ]
        ws.append(row)

    # Adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if cell.value and len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width

    # Save to bytes
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # Return as streaming response
    from datetime import datetime as dt
    filename = f"approved_requests_{dt.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


__all__ = [
    "create_request",
    "create_batch_requests",
    "list_requests",
    "get_request",
    "get_request_statistics",
    "cancel_request",
    "get_approved_requests",
    "download_requests_excel",
    "router",
]

