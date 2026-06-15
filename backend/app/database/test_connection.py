from sqlalchemy import text

from app.database.session import engine

try:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    print("Database Connected Successfully")

except Exception as e:
    print("Database Connection Failed")
    print(e)