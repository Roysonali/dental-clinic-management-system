"""
add attachment upload fields

Revision ID: f6a7b8c9d0e1
Revises: c1d2e3f4a5b6
Create Date: 2026-08-11 00:00:00.000000

Adds the columns required for real file uploads on
``patient_record_attachments``:

* ``storage_key`` — opaque server-generated reference to the stored file
  (NULL for legacy rows that only carry a client-supplied ``file_path``).
* ``uploaded_by`` — id of the user who uploaded the file (NULL for legacy
  rows).

Existing rows are preserved untouched; no data migration is required.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patient_record_attachments",
        sa.Column("storage_key", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "patient_record_attachments",
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
    )

    op.create_index(
        "ix_patient_record_attachments_storage_key",
        "patient_record_attachments",
        ["storage_key"],
        unique=True,
    )
    op.create_index(
        "ix_patient_record_attachments_uploaded_by",
        "patient_record_attachments",
        ["uploaded_by"],
    )

    op.create_foreign_key(
        "fk_patient_record_attachments_uploaded_by_users",
        "patient_record_attachments",
        "users",
        ["uploaded_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_patient_record_attachments_uploaded_by_users",
        "patient_record_attachments",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_patient_record_attachments_uploaded_by",
        table_name="patient_record_attachments",
    )
    op.drop_index(
        "ix_patient_record_attachments_storage_key",
        table_name="patient_record_attachments",
    )
    op.drop_column("patient_record_attachments", "uploaded_by")
    op.drop_column("patient_record_attachments", "storage_key")
