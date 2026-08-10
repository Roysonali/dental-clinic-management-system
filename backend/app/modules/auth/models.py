from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base
from app.core.constants import USER_STATUS_ACTIVE
from app.core.constants import USER_STATUS_INACTIVE
from app.core.constants import USER_STATUS_PENDING


class PasswordResetToken(Base):
    """A single-use, expiring password-reset credential.

    Only the SHA-256 digest of the raw token is stored — the raw token is
    handed to the user once (inside the reset email link) and is never
    persisted or exposed through any API response.

    Lifecycle:
        * ``used_at`` — set when the token successfully resets a password
          (single use: a used token is permanently invalid).
        * ``revoked_at`` — set on all of a user's outstanding tokens when a
          new reset is requested, invalidating older links.
        * ``expires_at`` — hard deadline; expired tokens are rejected at
          lookup time. Expired rows are additionally purged opportunistically
          when the same user requests a new token (no background jobs exist).
    """

    __tablename__ = "password_reset_tokens"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
        doc="Foreign key to the user who requested the reset",
    )

    token_hash = Column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        doc="SHA-256 hex digest of the raw reset token (raw token never stored)",
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        doc="UTC timestamp after which the token is rejected",
    )

    used_at = Column(
        DateTime(timezone=True),
        nullable=True,
        doc="UTC timestamp when the token was consumed by a successful reset",
    )

    revoked_at = Column(
        DateTime(timezone=True),
        nullable=True,
        doc="UTC timestamp when the token was superseded/revoked by a newer request",
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="UTC timestamp when the token was created",
    )

    user = relationship(
        "User",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return (
            f"<PasswordResetToken(id={self.id}, user_id={self.user_id}, "
            f"expires_at={self.expires_at!r}, used_at={self.used_at!r})>"
        )


class Role(Base):
    """User role for RBAC (e.g. Admin, Doctor, Receptionist).

    Roles are seeded at deployment and rarely modified at runtime.
    """

    __tablename__ = "roles"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(50),
        nullable=False,
        unique=True,
        doc="Role display name (e.g. Administrative Officer)",
    )

    users = relationship(
        "User",
        back_populates="role",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name={self.name!r})>"


class User(Base):
    """System user with authentication, role assignment, and account status.

    Users go through a lifecycle: ``pending`` -> ``active`` -> ``inactive``.
    New registrations start as ``pending`` and must be approved by an
    admin before they can authenticate.
    """

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    full_name = Column(
        String(100),
        nullable=False,
        doc="User's full display name",
    )

    email = Column(
        String(255),
        nullable=False,
        unique=True,
        # unique=True already creates a unique B-tree index.
        # An explicit index=True is redundant -- omitted intentionally.
        doc="Login email address (unique per user)",
    )

    password_hash = Column(
        String(255),
        nullable=False,
        doc="bcrypt hash of the user's password",
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending",
        doc="Account lifecycle status: pending | active | inactive",
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=False,
        doc="Whether the account is currently active",
    )

    role_id = Column(
        Integer,
        ForeignKey(
            "roles.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        doc="Foreign key to the assigned role (null until approved)",
    )

    role = relationship(
        "Role",
        back_populates="users",
        passive_deletes=True,
    )

    last_login_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp (UTC) of the most recent successful login",
        doc="Timestamp (UTC) of the most recent successful login. Null until first login.",
    )

    created_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        comment="Foreign key to the user who created/approved this record",
        doc="Foreign key to the user who created/approved this record (null for self-registered users).",
    )

    updated_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        comment="Foreign key to the user who last modified this record",
        doc="Foreign key to the user who last modified this record (null until first modification).",
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        remote_side=[id],
        passive_deletes=True,
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        remote_side=[id],
        passive_deletes=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp (UTC) when the record was created",
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp (UTC) of the most recent update",
    )

    __table_args__ = (
        Index("ix_users_status", "status"),
        Index(
            "ix_users_active_status",
            "is_active",
            "status",
        ),
        CheckConstraint(
            text(
                f"status IN ("
                f"'{USER_STATUS_PENDING}', "
                f"'{USER_STATUS_ACTIVE}', "
                f"'{USER_STATUS_INACTIVE}'"
                f")"
            ),
            name="ck_users_status_valid",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<User(id={self.id}, email={self.email!r}, "
            f"status={self.status!r}, is_active={self.is_active})>"
        )