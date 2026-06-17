from app.database.session import SessionLocal
from app.modules.auth.models import User

db = SessionLocal()

user = db.query(User).first()

print(user.role)