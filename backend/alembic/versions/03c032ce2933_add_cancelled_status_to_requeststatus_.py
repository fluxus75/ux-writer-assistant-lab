"""add cancelled status to RequestStatus enum"""

revision = '03c032ce2933'
down_revision = 'ec4e19fdeafb'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Add 'CANCELLED' to the RequestStatus enum (uppercase to match existing values)
    op.execute("ALTER TYPE request_status ADD VALUE 'CANCELLED'")


def downgrade() -> None:
    # Note: PostgreSQL does not support removing enum values directly.
    # This would require recreating the enum type, which is complex.
    # For now, we'll leave this as a no-op.
    pass
