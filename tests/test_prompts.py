import os
from pathlib import Path

from fastapi.testclient import TestClient

from src.server.main import app

client = TestClient(app)


def test_list_prompts():
    response = client.get("/api/prompts/")
    assert response.status_code == 200
    data = response.json()
    assert "prompts" in data
    assert isinstance(data["prompts"], list)
    # Check for some expected prompts
    assert "SceneDescriptiveAnalysis" in data["prompts"]


def test_read_prompt():
    response = client.get("/api/prompts/SceneDescriptiveAnalysis")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "SceneDescriptiveAnalysis"
    assert "content" in data
    assert len(data["content"]) > 0


def test_read_nonexistent_prompt():
    response = client.get("/api/prompts/nonexistent_prompt_123")
    assert response.status_code == 404


def test_update_prompt():
    test_name = "test_verification_prompt"
    test_content = "This is a test prompt content."

    # Update/Create
    response = client.post(
        f"/api/prompts/{test_name}", json={"name": test_name, "content": test_content}
    )
    assert response.status_code == 200

    # Read back
    response = client.get(f"/api/prompts/{test_name}")
    assert response.status_code == 200
    assert response.json()["content"] == test_content

    # Cleanup
    prompt_path = Path("assets/prompts") / f"{test_name}.prompt"
    if prompt_path.exists():
        os.remove(prompt_path)


def test_invalid_prompt_name():
    # Using '..dangerous' avoids path normalization by the client
    response = client.post(
        "/api/prompts/..dangerous", json={"name": "..dangerous", "content": "evil"}
    )
    assert response.status_code == 400
