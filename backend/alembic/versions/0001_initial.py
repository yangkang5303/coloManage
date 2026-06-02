"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # The MVP uses SQLAlchemy metadata creation for local startup. For managed
    # environments, generate a full migration with:
    # alembic revision --autogenerate -m "initial schema"
    pass


def downgrade():
    pass
