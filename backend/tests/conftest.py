from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core import state
from app.db import Base, get_engine


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
