"""Lightweight header-based role enforcement helpers."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from app.db import get_db_session
from app.db.models import User, UserRole


class RoleMiddleware(BaseHTTPMiddleware):
    """Attach the incoming role and user ID headers to the request state."""

    role_header = "x-user-role"
    user_header = "x-user-id"

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        role_value = request.headers.get(self.role_header)
        user_id = request.headers.get(self.user_header)
        request.state.user_role = None
        request.state.user_id = None
        if role_value:
            try:
                request.state.user_role = UserRole(role_value)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unsupported role header")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)


def require_roles(*roles: UserRole):
    """Dependency that validates the caller's role header against allowed roles."""

    allowed = set(roles)

    def dependency(request: Request) -> UserRole:
        role: UserRole | None = getattr(request.state, "user_role", None)
        if role is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-Role header")
        if allowed and role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return role

    return dependency


def current_user(*roles: UserRole):
    """Return a dependency that loads the current user and optionally enforces roles."""

    allowed = set(roles)

    def dependency(
        request: Request,
        role: UserRole = Depends(require_roles(*allowed)) if allowed else Depends(require_roles()),
        session: Session = Depends(get_db_session),
    ) -> User:
        user_id: str | None = getattr(request.state, "user_id", None)
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-Id header")
        user = session.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if allowed and user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        if role != user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role mismatch")
        return user

    return dependency


__all__ = ["RoleMiddleware", "require_roles", "current_user"]

