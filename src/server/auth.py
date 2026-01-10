import hashlib
import os
import secrets


# Using standard library for hashing to avoid new dependencies for now,
# although Argon2 is recommended in the design.
def hash_password(password: str) -> str:
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}${key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, key_hex = hashed.split("$")
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return secrets.compare_digest(key, new_key)
    except Exception:
        return False


# JWT-like session token (simplified for now)
def create_access_token(user_id: str) -> str:
    # In a real app, use PyJWT. Here we'll use a simple signed string or just a random token.
    return secrets.token_urlsafe(32)


# Dependency to get current user would go here
