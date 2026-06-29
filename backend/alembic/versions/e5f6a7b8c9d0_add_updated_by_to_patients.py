"""add updated_by column to patients table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add updated_by column to patients table with self-referential FK."""
    op.add_column(
        "patients",
        sa.Column(
            "updated_by",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the user who last modified this record",
        ),
    )
    op.create_foreign_key(
        "fk_patients_updated_by",
        "patients",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Drop updated_by column and its FK constraint."""
    op.drop_constraint(
        "fk_patients_updated_by",
        "patients",
        type_="foreignkey",
    )
    op.drop_column(
        "patients",
        "updated_by",
    )
