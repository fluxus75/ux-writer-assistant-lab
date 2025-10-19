"""Admin API endpoints for managing taxonomy and system configuration."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db import get_db_session, models


router = APIRouter(prefix="/admin", tags=["admin"])


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class DeviceResponse(BaseModel):
    id: str
    display_name_ko: str
    display_name_en: str
    category: Optional[str]
    active: bool

    class Config:
        from_attributes = True


class DeviceCreatePayload(BaseModel):
    id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    display_name_ko: str = Field(..., min_length=1, max_length=255)
    display_name_en: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, max_length=64)


class DeviceUpdatePayload(BaseModel):
    display_name_ko: Optional[str] = Field(default=None, min_length=1, max_length=255)
    display_name_en: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, max_length=64)
    active: Optional[bool] = None


@router.get("/users", response_model=List[UserResponse])
def list_users(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.ADMIN, models.UserRole.DESIGNER, models.UserRole.WRITER)),
):
    """Get all users."""
    stmt = select(models.User).order_by(models.User.name)
    users = list(session.scalars(stmt))
    return users


@router.get("/devices", response_model=List[DeviceResponse])
def list_devices(
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.ADMIN, models.UserRole.DESIGNER, models.UserRole.WRITER)),
    include_inactive: bool = False,
):
    """Get all device taxonomy entries."""
    stmt = select(models.DeviceTaxonomy)
    if not include_inactive:
        stmt = stmt.where(models.DeviceTaxonomy.active == True)
    stmt = stmt.order_by(models.DeviceTaxonomy.id)
    devices = list(session.scalars(stmt))
    return devices


@router.post("/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreatePayload,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.ADMIN)),
):
    """Create a new device taxonomy entry."""
    # Check if device already exists
    existing = session.get(models.DeviceTaxonomy, payload.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device with id '{payload.id}' already exists",
        )

    device = models.DeviceTaxonomy(
        id=payload.id,
        display_name_ko=payload.display_name_ko,
        display_name_en=payload.display_name_en,
        category=payload.category,
        active=True,
    )
    session.add(device)
    session.commit()
    session.refresh(device)
    return device


@router.put("/devices/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: str,
    payload: DeviceUpdatePayload,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.ADMIN)),
):
    """Update an existing device taxonomy entry."""
    device = session.get(models.DeviceTaxonomy, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )

    if payload.display_name_ko is not None:
        device.display_name_ko = payload.display_name_ko
    if payload.display_name_en is not None:
        device.display_name_en = payload.display_name_en
    if payload.category is not None:
        device.category = payload.category
    if payload.active is not None:
        device.active = payload.active

    session.commit()
    session.refresh(device)
    return device


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: str,
    session: Session = Depends(get_db_session),
    user: models.User = Depends(current_user(models.UserRole.ADMIN)),
    hard_delete: bool = False,
):
    """Delete or deactivate a device taxonomy entry."""
    device = session.get(models.DeviceTaxonomy, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )

    if hard_delete:
        session.delete(device)
    else:
        device.active = False

    session.commit()


__all__ = ["router"]
