"""add source_text to requests"""

revision = 'ef45aa7f9f2f'
down_revision = '86b9c9dfbea1'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('requests', sa.Column('source_text', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('requests', 'source_text')
