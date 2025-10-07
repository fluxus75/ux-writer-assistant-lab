from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core import state
from app.db import Base, get_engine, session_scope
from app.db import models
from sqlalchemy import delete


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    try:
        yield
    finally:
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def reset_state():
    state.CONTEXT.clear()
    state.GLOSSARY.clear()
    state.STYLE.clear()
    state.RUN_LOGS.clear()
    yield
    state.CONTEXT.clear()
    state.GLOSSARY.clear()
    state.STYLE.clear()
    state.RUN_LOGS.clear()


@pytest.fixture(autouse=True)
def clean_database():
    with session_scope() as session:
        for table in (
            models.Comment,
            models.DraftVersion,
            models.Draft,
            models.Approval,
            models.ExportJob,
            models.Request,
            models.User,
            models.StyleGuideEntry,
            models.GlossaryEntry,
            models.ContextSnippet,
            models.RagIngestion,
            models.GuardrailRule,
            models.AuditLog,
        ):
            session.execute(delete(table))
    yield


@pytest.fixture
def seed_users():
    with session_scope() as session:
        designer = models.User(
            id="designer-1",
            role=models.UserRole.DESIGNER,
            name="Designer One",
            email="designer@example.com",
        )
        writer = models.User(
            id="writer-1",
            role=models.UserRole.WRITER,
            name="Writer One",
            email="writer@example.com",
        )
        session.merge(designer)
        session.merge(writer)
    return {"designer": "designer-1", "writer": "writer-1"}
