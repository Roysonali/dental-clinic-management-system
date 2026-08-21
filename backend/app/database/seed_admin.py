"""
Seed the database with roles and an initial admin user.

This script is safe to run multiple times (idempotent):
- Roles that already exist are skipped.
- An admin user is created only if none exists yet.

Set environment variables to control the admin credentials:

    ADMIN_EMAIL    — login email   (default: admin@denscare.com)
    ADMIN_PASSWORD — login password (default: Admin@12345)
    ADMIN_NAME     — display name   (default: Admin User)

Usage:
    python -m app.database.seed_admin
"""

import os
import sys

from app.core.constants import ROLE_ADMIN
from app.core.security import hash_password
from app.database.seed_roles import seed_roles
from app.database.session import SessionLocal
from app.modules.auth.models import User


def seed_admin() -> None:
    """Create the initial admin user if none exists."""

    # Step 1: Ensure all roles exist
    seed_roles()

    # Step 2: Create admin user if needed
    db = SessionLocal()

    try:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@denscare.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "Admin@12345")
        admin_name = os.getenv("ADMIN_NAME", "Admin User")

        existing_admin = db.query(User).filter(User.email == admin_email).first()

        if existing_admin:
            print(f"Admin user '{admin_email}' already exists (id={existing_admin.id}). Skipping.")
            return

        from app.modules.auth.models import Role

        admin_role = db.query(Role).filter(Role.name == ROLE_ADMIN).first()

        if not admin_role:
            print("ERROR: ADMIN role not found after seeding roles. Aborting.")
            sys.exit(1)

        admin_user = User(
            full_name=admin_name,
            email=admin_email,
            password_hash=hash_password(admin_password),
            status="active",
            is_active=True,
            role_id=admin_role.id,
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print(f"Admin user created successfully:")
        print(f"  Email:    {admin_email}")
        print(f"  Password: {admin_password}")
        print(f"  User ID:  {admin_user.id}")
        print(f"  Role:     {admin_role.name}")
        print()
        print("WARNING: Change this password after first login!")

    except Exception as e:
        db.rollback()
        print(f"ERROR: Failed to seed admin user: {e}")
        sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
