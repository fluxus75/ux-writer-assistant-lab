"""add_device_taxonomy_table"""

revision = 'cc3ae3a3cd18'
down_revision = 'c6f2ba53b4c1'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Create device_taxonomy table
    op.create_table(
        'device_taxonomy',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('display_name_ko', sa.String(255), nullable=False),
        sa.Column('display_name_en', sa.String(255), nullable=False),
        sa.Column('category', sa.String(64)),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Insert initial devices from existing data
    op.execute("""
        INSERT INTO device_taxonomy (id, display_name_ko, display_name_en, category)
        VALUES
            ('robot_vacuum', '로봇 청소기', 'Robot Vacuum', 'home_appliance'),
            ('air_purifier', '공기청정기', 'Air Purifier', 'home_appliance')
    """)


def downgrade() -> None:
    op.drop_table('device_taxonomy')
