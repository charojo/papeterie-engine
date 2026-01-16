"""Tests for the sounds router."""

import pytest
from fastapi.testclient import TestClient

from src.server.dependencies import get_user_sounds
from src.server.main import app

client = TestClient(app)


class TestListSounds:
    """Tests for GET /api/sounds endpoint."""

    @pytest.fixture(autouse=True)
    def clean_overrides(self):
        """Reset dependency overrides after each test."""
        yield
        app.dependency_overrides = {}

    def test_returns_empty_list_when_no_sounds_dir(self, tmp_path):
        """Should return empty list if sounds directory doesn't exist."""
        sounds_dir = tmp_path / "non_existent"

        app.dependency_overrides[get_user_sounds] = lambda: sounds_dir
        response = client.get("/api/sounds")

        assert response.status_code == 200
        assert response.json() == {"sounds": []}

    def test_returns_sound_files(self, tmp_path):
        """Should return list of sound files."""
        # Create mock sound files
        sounds_dir = tmp_path / "sounds"
        sounds_dir.mkdir()
        (sounds_dir / "splash.mp3").touch()
        (sounds_dir / "wave.wav").touch()
        (sounds_dir / "ambient.ogg").touch()
        (sounds_dir / "not_sound.txt").touch()

        app.dependency_overrides[get_user_sounds] = lambda: sounds_dir
        response = client.get("/api/sounds")

        assert response.status_code == 200
        data = response.json()
        assert len(data["sounds"]) == 3

        # Check sound entries
        names = [s["name"] for s in data["sounds"]]
        assert "splash" in names
        assert "wave" in names
        assert "ambient" in names
        assert "not_sound" not in names

    def test_excludes_non_audio_files(self, tmp_path):
        """Should only include audio files."""
        sounds_dir = tmp_path / "sounds"
        sounds_dir.mkdir()
        (sounds_dir / "readme.txt").touch()
        (sounds_dir / "image.png").touch()
        (sounds_dir / "script.py").touch()

        app.dependency_overrides[get_user_sounds] = lambda: sounds_dir
        response = client.get("/api/sounds")

        assert response.status_code == 200
        assert response.json()["sounds"] == []

    def test_returns_correct_structure(self, tmp_path):
        """Should return proper structure for each sound."""
        sounds_dir = tmp_path / "sounds"
        sounds_dir.mkdir()
        (sounds_dir / "test.mp3").touch()

        app.dependency_overrides[get_user_sounds] = lambda: sounds_dir
        response = client.get("/api/sounds")

        sound = response.json()["sounds"][0]
        assert sound["name"] == "test"
        assert sound["filename"] == "test.mp3"
        # Due to tmp_path not being in ASSETS_DIR, the router falls back to relative
        # "sounds/test.mp3"

        assert sound["path"] == "sounds/test.mp3"

    def test_sounds_are_sorted_by_name(self, tmp_path):
        """Should return sounds sorted alphabetically."""
        sounds_dir = tmp_path / "sounds"
        sounds_dir.mkdir()
        (sounds_dir / "zebra.mp3").touch()
        (sounds_dir / "alpha.wav").touch()
        (sounds_dir / "beta.ogg").touch()

        app.dependency_overrides[get_user_sounds] = lambda: sounds_dir
        response = client.get("/api/sounds")

        names = [s["name"] for s in response.json()["sounds"]]
        assert names == ["alpha", "beta", "zebra"]

    def test_supports_m4a_extension(self, tmp_path):
        """Should support .m4a files."""
        sounds_dir = tmp_path / "sounds"
        sounds_dir.mkdir()
        (sounds_dir / "music.m4a").touch()

        app.dependency_overrides[get_user_sounds] = lambda: sounds_dir
        response = client.get("/api/sounds")

        assert len(response.json()["sounds"]) == 1
        assert response.json()["sounds"][0]["name"] == "music"

    def test_handles_subdirectories(self, tmp_path):
        """Should not recurse into subdirectories."""
        sounds_dir = tmp_path / "sounds"
        sounds_dir.mkdir()
        (sounds_dir / "top_level.mp3").touch()

        subdir = sounds_dir / "subdir"
        subdir.mkdir()
        (subdir / "nested.mp3").touch()

        app.dependency_overrides[get_user_sounds] = lambda: sounds_dir
        response = client.get("/api/sounds")

        # Should only include top level
        names = [s["name"] for s in response.json()["sounds"]]
        assert names == ["top_level"]
