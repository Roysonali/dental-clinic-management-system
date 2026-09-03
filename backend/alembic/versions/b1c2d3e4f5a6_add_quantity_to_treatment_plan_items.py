"""add quantity to treatment_plan_items

Revision ID: b1c2d3e4f5a6
Revises: f0b1c2d3e4f5
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "f0b1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col(bind, table: str, column: str) -> bool:
    """Check information_schema for a column."""
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).fetchone()
    )


def _chk(bind, table: str, name: str) -> bool:
    """Check information_schema for a check constraint."""
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE table_name = :t AND constraint_name = :n "
                "AND constraint_type = 'CHECK'"
            ),
            {"t": table, "n": name},
        ).fetchone()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Add quantity column (NOT NULL, default 1 — existing rows get 1)
    if not _col(bind, "treatment_plan_items", "quantity"):
        op.add_column(
            "treatment_plan_items",
            sa.Column(
                "quantity",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("1"),
            ),
        )
        # Drop the server_default after migration so the ORM default takes over
        op.alter_column(
            "treatment_plan_items",
            "quantity",
            server_default=None,
        )

    # 2. Add quantity CHECK constraint (1–999)
    if not _chk(bind, "treatment_plan_items", "ck_tpi_quantity"):
        op.create_check_constraint(
            "ck_tpi_quantity",
            "treatment_plan_items",
            "quantity >= 1 AND quantity <= 999",
        )

    # 3. Replace discount <= estimated_cost with discount <= estimated_cost * quantity
    if _chk(bind, "treatment_plan_items", "ck_tpi_discount_le_cost"):
        op.drop_constraint(
            "ck_tpi_discount_le_cost",
            "treatment_plan_items",
            type_="check",
        )
    if not _chk(bind, "treatment_plan_items", "ck_tpi_discount_le_cost"):
        op.create_check_constraint(
            "ck_tpi_discount_le_cost",
            "treatment_plan_items",
            "discount <= estimated_cost * quantity",
        )


def downgrade() -> None:
    bind = op.get_bind()

    # Restore original discount constraint (without quantity)
    if _chk(bind, "treatment_plan_items", "ck_tpi_discount_le_cost"):
        op.drop_constraint(
            "ck_tpi_discount_le_cost",
            "treatment_plan_items",
            type_="check",
        )
        op.create_check_constraint(
            "ck_tpi_discount_le_cost",
            "treatment_plan_items",
            "discount <= estimated_cost",
        )

    # Drop quantity CHECK constraint
    if _chk(bind, "treatment_plan_items", "ck_tpi_quantity"):
        op.drop_constraint(
            "ck_tpi_quantity",
            "treatment_plan_items",
            type_="check",
        )

    # Drop quantity column
    if _col(bind, "treatment_plan_items", "quantity"):
        op.drop_column("treatment_plan_items", "quantity")
