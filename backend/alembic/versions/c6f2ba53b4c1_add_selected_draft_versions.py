"""Add selected draft versions association table."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c6f2ba53b4c1"
down_revision: Union[str, Sequence[str], None] = "ef45aa7f9f2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create selected_draft_versions table."""
    op.create_table(
        "selected_draft_versions",
        sa.Column("draft_id", sa.String(length=36), nullable=False),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("selected_by", sa.String(length=36), nullable=False),
        sa.Column("selected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["draft_id"], ["drafts.id"], ),
        sa.ForeignKeyConstraint(["selected_by"], ["users.id"], ),
        sa.ForeignKeyConstraint(["version_id"], ["draft_versions.id"], ),
        sa.PrimaryKeyConstraint("draft_id"),
    )


def downgrade() -> None:
    """Drop selected_draft_versions table."""
    op.drop_table("selected_draft_versions")

