"""create doctor_applications table

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7a8b9
Create Date: 2026-09-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the doctor_applications table
    op.create_table(
        'doctor_applications',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('qualification', sa.String(500), nullable=True),
        sa.Column(
            'registration_number',
            sa.String(100),
            nullable=True,
            unique=True,
        ),
        sa.Column('years_of_experience', sa.Integer(), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('gender', sa.String(10), nullable=True),
        sa.Column('primary_phone', sa.String(20), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('profile_photo_url', sa.String(500), nullable=True),
        sa.Column(
            'requested_specialization_ids',
            postgresql.JSONB(none_as_null=True),
            nullable=True,
            comment='List of specialization IDs requested by the applicant',
        ),
        sa.Column(
            'primary_specialization_id',
            sa.Integer(),
            nullable=True,
            comment='ID of the requested primary specialization',
        ),
        sa.Column(
            'status',
            sa.String(20),
            nullable=False,
            server_default='pending',
            index=True,
        ),
        sa.Column(
            'submitted_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'reviewed_by',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column(
            'approved_role_id',
            sa.Integer(),
            sa.ForeignKey('roles.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column(
            'doctor_id',
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey('doctors.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Create composite index for efficient pending-application lookups
    op.create_index(
        'ix_doctor_applications_user_status',
        'doctor_applications',
        ['user_id', 'status'],
    )

    # Create check constraint for valid status values
    op.create_check_constraint(
        'ck_doctor_applications_status_valid',
        'doctor_applications',
        "status IN ('pending', 'approved', 'rejected')",
    )

    # Create check constraint for years_of_experience
    op.create_check_constraint(
        'ck_doctor_app_years_experience',
        'doctor_applications',
        'years_of_experience >= 0',
    )


def downgrade() -> None:
    op.drop_table('doctor_applications')
