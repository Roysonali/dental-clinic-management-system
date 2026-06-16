from app.database.session import SessionLocal
from app.modules.auth.models import Role


ROLES = [
    "Administrative Officer",
    "Chief Doctor",
    "General Doctor",
    "Specialist Doctor",
    "Consulting Doctor",
    "Receptionist",
    "Dental Assistant"
]


def seed_roles():

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
                    name=role_name
                )

                db.add(role)

        db.commit()

        print("Roles seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()