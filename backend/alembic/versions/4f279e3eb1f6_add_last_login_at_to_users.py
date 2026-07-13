"""add last_login_at column to users table

Revision ID: 4f279e3eb1f6
Revises: 9a8b7c6d5e4f
Create Date: 2026-06-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f279e3eb1f6"
down_revision: Union[str, Sequence[str], None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add last_login_at column to users table."""
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp (UTC) of the most recent successful login",
        ),
    )


def downgrade() -> None:
    """Remove last_login_at column from users table."""
    op.drop_column("users", "last_login_at")
