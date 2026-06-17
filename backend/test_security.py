from app.core.security import (
    hash_password,
    verify_password
)

password = "Admin123"

hashed = hash_password(password)

print("Original:", password)
print("Hash:", hashed)

print(
    "Valid:",
    verify_password(password, hashed)
)