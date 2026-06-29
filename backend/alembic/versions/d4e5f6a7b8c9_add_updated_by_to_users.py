"""add updated_by column to users table

Revision ID: d4e5f6a7b8c9
Revises: 4f279e3eb1f6
Create Date: 2026-06-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "4f279e3eb1f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add updated_by column to users table with self-referential FK."""
    op.add_column(
        "users",
        sa.Column(
            "updated_by",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the user who last modified this record",
        ),
    )
    op.create_foreign_key(
        "fk_users_updated_by",
        "users",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Remove updated_by column and its FK constraint from users table."""
    op.drop_constraint(
        "fk_users_updated_by",
        "users",
        type_="foreignkey",
    )
    op.drop_column("users", "updated_by")
