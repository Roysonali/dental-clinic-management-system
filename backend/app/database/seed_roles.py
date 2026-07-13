"""
Seed the roles table with the RBAC role identifiers used by the authorization system.

The ``name`` column stores the exact constant value that ``require_admin``
and ``require_roles`` compare against (e.g. ``"ADMIN"``, ``"CHIEF_DOCTOR"``).

Display-friendly labels should be handled in the API layer or frontend,
not here.
"""

from app.core.constants import (
    ROLE_ADMIN,
    ROLE_CHIEF_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
    ROLE_DENTAL_ASSISTANT,
    ROLE_GENERAL_DOCTOR,
    ROLE_RECEPTIONIST,
    ROLE_SPECIALIST_DOCTOR,
)
from app.database.session import SessionLocal
from app.modules.auth.models import Role

# The role identifier values stored here MUST match the constants
# used in rbac/permissions.py and checked at runtime.
# Using display names here would break every authorization check.

ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_CHIEF_DOCTOR,
    ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
]


def seed_roles() -> None:
    """Insert each role into the database if it does not already exist."""
    db = SessionLocal()

    try:

        for role_name in ROLES:

            existing_role = (
                db.query(Role)
                .filter(Role.name == role_name)
                .first()
            )

            if not existing_role:

                role = Role(
                    name=role_name,
                )

                db.add(role)

        db.commit()

        print("Roles seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()