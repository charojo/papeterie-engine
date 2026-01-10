import uuid

import pytest
from fastapi.testclient import TestClient

from src.server.database import get_db_connection
from src.server.main import app

client = TestClient(app)


@pytest.fixture
def test_user():
    """Fixture to ensure a test user exists and cleanup after."""
    user_email = f"test_{uuid.uuid4()}@example.com"
    user_data = {"username": "testuser_auth", "email": user_email, "password": "testpassword123"}
    yield user_data

    # Cleanup
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE email = ?", (user_email,))
    conn.commit()
    conn.close()


def test_register_success(test_user):
    response = client.post("/api/auth/register", json=test_user)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == test_user["username"]
    assert data["email"] == test_user["email"]
    assert "id" in data


def test_register_duplicate(test_user):
    # First registration
    client.post("/api/auth/register", json=test_user)

    # Duplicate registration
    response = client.post("/api/auth/register", json=test_user)
    assert response.status_code == 400
    assert response.json()["detail"] == "User already exists"


def test_login_success(test_user):
    # Register first
    client.post("/api/auth/register", json=test_user)

    # Login
    login_data = {"email": test_user["email"], "password": test_user["password"]}
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == test_user["email"]


def test_login_wrong_password(test_user):
    # Register first
    client.post("/api/auth/register", json=test_user)

    # Login with wrong password
    login_data = {"email": test_user["email"], "password": "wrongpassword"}
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_nonexistent_user():
    login_data = {"email": "nonexistent@example.com", "password": "password123"}
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_get_me_local():
    # In LOCAL mode (default for tests unless STORAGE_MODE env is set)
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "LocalUser"
