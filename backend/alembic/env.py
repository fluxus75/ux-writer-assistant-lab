"""Alembic environment configuration for the UX Writer backend."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from alembic import context

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.settings import settings  # noqa: E402
from app.db import Base, get_engine  # noqa: E402
from app.db import models  # noqa: F401,E402  # ensure models are imported

config = context.config

if config.config_file_name is not None:
    file_config = context.config.get_section(context.config.config_ini_section)
    if file_config is not None:
        file_config["sqlalchemy.url"] = settings.database_url

target_metadata = Base.metadata
logger = logging.getLogger("alembic.env")


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

