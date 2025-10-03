"""SQLAlchemy session and engine configuration."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.settings import settings


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


_engine = create_engine(settings.database_url, future=True, echo=False)
SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


def get_engine():
    """Return the shared SQLAlchemy engine.

    Exposed for Alembic and future integrations without importing module globals.
    """

    return _engine


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a transactional scope for session usage."""

    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_session() -> Iterator[Session]:
    """FastAPI dependency that yields a database session."""

    with session_scope() as session:
        yield session
