"""
add patient records module

Revision ID: 43f93a7e590e
Revises: b8d407be5e45
Create Date: 2026-07-02 00:55:58.428442
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "43f93a7e590e"
down_revision: Union[str, Sequence[str], None] = "b8d407be5e45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # =====================================================
    # PATIENT RECORDS
    # =====================================================
    op.create_table(
        "patient_records",

        sa.Column("id", sa.UUID(), nullable=False),

        sa.Column(
            "patient_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "appointment_id",
            sa.UUID(),
            nullable=False,
        ),

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

        sa.Column(
            "is_finalized",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
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
    )

    op.create_index(
        "ix_patient_records_is_deleted",
        "patient_records",
        ["is_deleted"],
    )

    # =====================================================
    # ATTACHMENTS
    # =====================================================
    op.create_table(
        "patient_record_attachments",

        sa.Column("id", sa.UUID(), nullable=False),

        sa.Column(
            "patient_record_id",
            sa.UUID(),
            nullable=False,
        ),

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

        sa.Column(
            "file_name",
            sa.String(255),
            nullable=False,
        ),

        sa.Column(
            "file_path",
            sa.String(1000),
            nullable=False,
        ),

        sa.Column(
            "mime_type",
            sa.String(100),
            nullable=True,
        ),

        sa.Column(
            "file_size",
            sa.BigInteger(),
            nullable=True,
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

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
    )

    op.create_index(
        "ix_patient_record_attachments_type",
        "patient_record_attachments",
        ["attachment_type"],
    )

    op.create_index(
        "ix_patient_record_attachments_is_deleted",
        "patient_record_attachments",
        ["is_deleted"],
    )

    # =====================================================
    # AUDIT LOGS
    # =====================================================
    op.create_table(
        "patient_record_audit_logs",

        sa.Column("id", sa.UUID(), nullable=False),

        sa.Column(
            "patient_record_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "action",
            sa.String(100),
            nullable=False,
        ),

        sa.Column(
            "old_value",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "new_value",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "performed_by",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "performed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

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
    )

    op.create_index(
        "ix_patient_record_audit_logs_performed_by",
        "patient_record_audit_logs",
        ["performed_by"],
    )

    op.create_index(
        "ix_patient_record_audit_logs_action",
        "patient_record_audit_logs",
        ["action"],
    )

    # =====================================================
    # DIAGNOSES
    # =====================================================
    op.create_table(
        "patient_record_diagnoses",

        sa.Column("id", sa.UUID(), nullable=False),

        sa.Column(
            "patient_record_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "diagnosis_type",
            sa.Enum(
                "PROVISIONAL",
                "CONFIRMED",
                name="diagnosistype",
            ),
            nullable=False,
        ),

        sa.Column(
            "diagnosis",
            sa.Text(),
            nullable=False,
        ),

        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

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
    )

    op.create_index(
        "ix_patient_record_diagnoses_is_deleted",
        "patient_record_diagnoses",
        ["is_deleted"],
    )

    # =====================================================
    # FOLLOWUPS
    # =====================================================
    op.create_table(
        "patient_record_followups",

        sa.Column("id", sa.UUID(), nullable=False),

        sa.Column(
            "patient_record_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "followup_date",
            sa.Date(),
            nullable=False,
        ),

        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

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
    )

    op.create_index(
        "ix_patient_record_followups_followup_date",
        "patient_record_followups",
        ["followup_date"],
    )

    op.create_index(
        "ix_patient_record_followups_is_deleted",
        "patient_record_followups",
        ["is_deleted"],
    )

    # =====================================================
    # PRESCRIPTIONS
    # =====================================================
    op.create_table(
        "patient_record_prescriptions",

        sa.Column("id", sa.UUID(), nullable=False),

        sa.Column(
            "patient_record_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "prescribed_by",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "prescribed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.ForeignKeyConstraint(
            ["patient_record_id"],
            ["patient_records.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["prescribed_by"],
            ["users.id"],
            ondelete="RESTRICT",
        ),

        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_record_prescriptions_patient_record_id",
        "patient_record_prescriptions",
        ["patient_record_id"],
    )

    op.create_index(
        "ix_patient_record_prescriptions_prescribed_by",
        "patient_record_prescriptions",
        ["prescribed_by"],
    )

    op.create_index(
        "ix_patient_record_prescriptions_is_deleted",
        "patient_record_prescriptions",
        ["is_deleted"],
    )

    # =====================================================
    # PRESCRIPTION ITEMS
    # =====================================================
    op.create_table(
        "patient_record_prescription_items",

        sa.Column("id", sa.UUID(), nullable=False),

        sa.Column(
            "prescription_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "medicine_name",
            sa.String(255),
            nullable=False,
        ),

        sa.Column(
            "dosage",
            sa.String(100),
            nullable=False,
        ),

        sa.Column(
            "frequency",
            sa.String(100),
            nullable=False,
        ),

        sa.Column(
            "duration",
            sa.String(100),
            nullable=False,
        ),

        sa.Column(
            "instructions",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.ForeignKeyConstraint(
            ["prescription_id"],
            ["patient_record_prescriptions.id"],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_patient_record_prescription_items_prescription_id",
        "patient_record_prescription_items",
        ["prescription_id"],
    )

    op.create_index(
        "ix_patient_record_prescription_items_is_deleted",
        "patient_record_prescription_items",
        ["is_deleted"],
    )


def downgrade() -> None:
    op.drop_index("ix_patient_record_prescription_items_is_deleted", table_name="patient_record_prescription_items")
    op.drop_index("ix_patient_record_prescription_items_prescription_id", table_name="patient_record_prescription_items")
    op.drop_table("patient_record_prescription_items")

    op.drop_index("ix_patient_record_prescriptions_is_deleted", table_name="patient_record_prescriptions")
    op.drop_index("ix_patient_record_prescriptions_prescribed_by", table_name="patient_record_prescriptions")
    op.drop_index("ix_patient_record_prescriptions_patient_record_id", table_name="patient_record_prescriptions")
    op.drop_table("patient_record_prescriptions")

    op.drop_index("ix_patient_record_followups_is_deleted", table_name="patient_record_followups")
    op.drop_index("ix_patient_record_followups_followup_date", table_name="patient_record_followups")
    op.drop_index("ix_patient_record_followups_patient_record_id", table_name="patient_record_followups")
    op.drop_table("patient_record_followups")

    op.drop_index("ix_patient_record_diagnoses_is_deleted", table_name="patient_record_diagnoses")
    op.drop_index("ix_patient_record_diagnoses_patient_record_id", table_name="patient_record_diagnoses")
    op.drop_table("patient_record_diagnoses")

    op.drop_index("ix_patient_record_audit_logs_action", table_name="patient_record_audit_logs")
    op.drop_index("ix_patient_record_audit_logs_performed_by", table_name="patient_record_audit_logs")
    op.drop_index("ix_patient_record_audit_logs_patient_record_id", table_name="patient_record_audit_logs")
    op.drop_table("patient_record_audit_logs")

    op.drop_index("ix_patient_record_attachments_is_deleted", table_name="patient_record_attachments")
    op.drop_index("ix_patient_record_attachments_type", table_name="patient_record_attachments")
    op.drop_index("ix_patient_record_attachments_patient_record_id", table_name="patient_record_attachments")
    op.drop_table("patient_record_attachments")

    op.drop_index("ix_patient_records_is_deleted", table_name="patient_records")
    op.drop_index("ix_patient_records_status", table_name="patient_records")
    op.drop_index("ix_patient_records_patient_id", table_name="patient_records")
    op.drop_index("ix_patient_records_appointment_id", table_name="patient_records")
    op.drop_table("patient_records")