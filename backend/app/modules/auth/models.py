from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String

from app.database.base import Base
from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.orm import relationship

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(50),
        nullable=False,
        unique=True
    )

    users = relationship(
        "User",
        back_populates="role"
    )

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(255),
        nullable=False,
        unique=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending"
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=False
    )

    role_id = Column(
        Integer,
        ForeignKey("roles.id"),
        nullable=True
    )

    role = relationship(
        "Role",
        back_populates="users"
    )