import psycopg2

DATABASE_URL = "postgresql://denscare_user:kKrKFa73sjDxaPHW8PSviTJRdDECoeCg@dpg-da3ktbrbc2fs73a8jubg-a.oregon-postgres.render.com/denscare"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Roles table ka structure dekhne ke liye (columns confirm karne ke liye)
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'roles';
""")
print("Roles table columns:")
for row in cur.fetchall():
    print(row)

cur.close()
conn.close()