"""add patient records module

Revision ID: 0405394486b7
Revises: b8d407be5e45
Create Date: 2026-07-01 19:15:53.952687
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0405394486b7"
down_revision: Union[str, Sequence[str], None] = "b8d407be5e45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ------------------------------------------------------------------
    # PATIENT RECORDS
    # ------------------------------------------------------------------
    op.create_table(
        "patient_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "IN_PROGRESS",
                "COMPLETED",
                "LOCKED",
                name="recordstatus",
            ),
            nullable=False,
        ),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("clinical_notes", sa.Text(), nullable=True),
        sa.Column("doctor_remarks", sa.Text(), nullable=True),
        sa.Column("treatment_recommendation", sa.Text(), nullable=True),
        sa.Column("systemic_diseases", sa.Text(), nullable=True),
        sa.Column("surgeries", sa.Text(), nullable=True),
        sa.Column("medications", sa.Text(), nullable=True),
        sa.Column("habits", sa.Text(), nullable=True),
        sa.Column("medical_alerts", sa.Text(), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("dental_history", sa.Text(), nullable=True),
        sa.Column("is_finalized", sa.Boolean(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_records_patient_id",
        "patient_records",
        ["patient_id"],
        unique=False,
    )

    op.create_index(
        "ix_patient_records_appointment_id",
        "patient_records",
        ["appointment_id"],
        unique=True,
    )

    op.create_index(
        "ix_patient_records_status",
        "patient_records",
        ["status"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # ATTACHMENTS
    # ------------------------------------------------------------------
    op.create_table(
        "patient_record_attachments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patient_record_id", sa.UUID(), nullable=False),
        sa.Column(
            "attachment_type",
            sa.Enum(
                "IMAGE",
                "PDF",
                "REPORT",
                "SCAN",
                "DOCUMENT",
                name="attachmenttype",
            ),
            nullable=False,
        ),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.ForeignKeyConstraint(
            ["patient_record_id"],
            ["patient_records.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_record_attachments_patient_record_id",
        "patient_record_attachments",
        ["patient_record_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # AUDIT LOGS
    # ------------------------------------------------------------------
    op.create_table(
        "patient_record_audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patient_record_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("performed_by", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["patient_record_id"],
            ["patient_records.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["performed_by"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_record_audit_logs_patient_record_id",
        "patient_record_audit_logs",
        ["patient_record_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # DIAGNOSES
    # ------------------------------------------------------------------
    op.create_table(
        "patient_record_diagnoses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patient_record_id", sa.UUID(), nullable=False),
        sa.Column(
            "diagnosis_type",
            sa.Enum(
                "PROVISIONAL",
                "CONFIRMED",
                name="diagnosistype",
            ),
            nullable=False,
        ),
        sa.Column("diagnosis", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_record_id"],
            ["patient_records.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_record_diagnoses_patient_record_id",
        "patient_record_diagnoses",
        ["patient_record_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # FOLLOWUPS
    # ------------------------------------------------------------------
    op.create_table(
        "patient_record_followups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patient_record_id", sa.UUID(), nullable=False),
        sa.Column("followup_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_record_id"],
            ["patient_records.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_record_followups_patient_record_id",
        "patient_record_followups",
        ["patient_record_id"],
        unique=False,
    )

    op.create_index(
        "ix_patient_record_followups_date",
        "patient_record_followups",
        ["followup_date"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # PRESCRIPTIONS
    # ------------------------------------------------------------------
    op.create_table(
        "patient_record_prescriptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patient_record_id", sa.UUID(), nullable=False),
        sa.Column("medicine_name", sa.String(length=255), nullable=False),
        sa.Column("dosage", sa.String(length=100), nullable=False),
        sa.Column("frequency", sa.String(length=100), nullable=False),
        sa.Column("duration", sa.String(length=100), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_record_id"],
            ["patient_records.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_record_prescriptions_patient_record_id",
        "patient_record_prescriptions",
        ["patient_record_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        "ix_patient_record_prescriptions_patient_record_id",
        table_name="patient_record_prescriptions",
    )
    op.drop_table("patient_record_prescriptions")

    op.drop_index(
        "ix_patient_record_followups_date",
        table_name="patient_record_followups",
    )
    op.drop_index(
        "ix_patient_record_followups_patient_record_id",
        table_name="patient_record_followups",
    )
    op.drop_table("patient_record_followups")

    op.drop_index(
        "ix_patient_record_diagnoses_patient_record_id",
        table_name="patient_record_diagnoses",
    )
    op.drop_table("patient_record_diagnoses")

    op.drop_index(
        "ix_patient_record_audit_logs_patient_record_id",
        table_name="patient_record_audit_logs",
    )
    op.drop_table("patient_record_audit_logs")

    op.drop_index(
        "ix_patient_record_attachments_patient_record_id",
        table_name="patient_record_attachments",
    )
    op.drop_table("patient_record_attachments")

    op.drop_index(
        "ix_patient_records_status",
        table_name="patient_records",
    )
    op.drop_index(
        "ix_patient_records_patient_id",
        table_name="patient_records",
    )
    op.drop_index(
        "ix_patient_records_appointment_id",
        table_name="patient_records",
    )
    op.drop_table("patient_records")