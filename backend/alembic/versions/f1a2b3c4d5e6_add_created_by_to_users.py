"""add created_by column to users table

Revision ID: f1a2b3c4d5e6
Revises: d4e5f6a7b8c9
Create Date: 2026-06-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add created_by column to users table with self-referential FK."""
    op.add_column(
        "users",
        sa.Column(
            "created_by",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the user who created/approved this record",
        ),
    )
    op.create_foreign_key(
        "fk_users_created_by",
        "users",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Remove created_by column and its FK constraint from users table."""
    op.drop_constraint(
        "fk_users_created_by",
        "users",
        type_="foreignkey",
    )
    op.drop_column("users", "created_by")
