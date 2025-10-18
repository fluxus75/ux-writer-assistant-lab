"""add needs_revision status to RequestStatus enum"""

revision = 'ec4e19fdeafb'
down_revision = 'cc3ae3a3cd18'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Add 'NEEDS_REVISION' to the RequestStatus enum (uppercase to match existing values)
    op.execute("ALTER TYPE request_status ADD VALUE 'NEEDS_REVISION'")


def downgrade() -> None:
    # Note: PostgreSQL does not support removing enum values directly.
    # This would require recreating the enum type, which is complex.
    # For now, we'll leave this as a no-op.
    pass
