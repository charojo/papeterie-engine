import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from src.config import STORAGE_MODE
from src.server.auth import create_access_token, hash_password, verify_password
from src.server.database import get_db_connection

router = APIRouter(prefix="/auth", tags=["auth"])


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str


@router.post("/register", response_model=UserResponse)
async def register(user: UserRegister):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if user exists
    cursor.execute(
        "SELECT id FROM users WHERE email = ? OR username = ?", (user.email, user.username)
    )
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="User already exists")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(user.password)

    try:
        cursor.execute(
            "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
            (user_id, user.username, user.email, password_hash),
        )
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    conn.close()
    return UserResponse(id=user_id, username=user.username, email=user.email)


@router.post("/login")
async def login(credentials: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE email = ?", (credentials.email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user["id"])
    return {"access_token": token, "token_type": "bearer", "user": dict(user)}


@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = "default"):
    # This will be replaced by a real dependency soon
    if STORAGE_MODE == "LOCAL":
        return UserResponse(id="default", username="LocalUser", email="local@example.com")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(id=user["id"], username=user["username"], email=user["email"])
