from fastapi.testclient import TestClient

from src.server.main import app

client = TestClient(app)


def test_list_behaviors():
    response = client.get("/api/behaviors")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_and_delete_behavior():
    behavior_name = "test_behavior_tmp"
    behavior_data = {
        "name": behavior_name,
        "behavior": {
            "type": "oscillate",
            "frequency": 1.0,
            "amplitude": 10.0,
            "coordinate": "y",
            "phase_offset": 0.0,
        },
    }

    # Create
    response = client.post("/api/behaviors", json=behavior_data)
    assert response.status_code == 200
    assert response.json()["name"] == behavior_name

    # List and verify
    response = client.get("/api/behaviors")
    names = [b["name"] for b in response.json()]
    assert behavior_name in names

    # Delete
    response = client.delete(f"/api/behaviors/{behavior_name}")
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"

    # Verify deleted
    response = client.get("/api/behaviors")
    names = [b["name"] for b in response.json()]
    assert behavior_name not in names


def test_delete_nonexistent_behavior():
    response = client.delete("/api/behaviors/nonexistent_behavior_123")
    assert response.status_code == 404
