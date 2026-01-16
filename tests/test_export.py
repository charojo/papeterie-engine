import sys
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Mock moviepy globally for this test file to avoid import errors
# But we won't mess with pygame here, we'll let fixtures handle it.
mock_moviepy = MagicMock()
sys.modules["moviepy"] = mock_moviepy
sys.modules["moviepy.video"] = MagicMock()
sys.modules["moviepy.video.io"] = MagicMock()
sys.modules["moviepy.video.io.ImageSequenceClip"] = MagicMock()


@pytest.fixture
def mock_theatre():
    with patch("src.server.routers.export.Theatre") as MockTheatre:
        instance = MockTheatre.return_value
        instance.screen = MagicMock()
        instance.screen.get_size.return_value = (1280, 720)
        instance.layers = []

        # Mock surfarray return
        mock_array = np.zeros((1280, 720, 3), dtype=np.uint8)
        with patch("pygame.surfarray.array3d", return_value=mock_array):
            yield MockTheatre


def test_export_video_endpoint(mock_theatre):
    # Import router here
    from src.server.routers.export import router

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    with (
        patch("src.server.routers.export.ImageSequenceClip") as MockClip,
        patch("pathlib.Path.exists", return_value=True),
        patch("pathlib.Path.mkdir"),
        patch("src.server.routers.export.Theatre.load_scene"),
    ):
        mock_clip_instance = MockClip.return_value
        mock_clip_instance.write_videofile = MagicMock()

        response = client.post(
            "/api/export",
            json={
                "user_id": "test_user",
                "scene_name": "test_scene",
                "duration": 1.0,
                "fps": 10,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        # Verify Theatre were called
        instance = mock_theatre.return_value
        assert instance.render_frame.call_count == 10

        # Verify clip creation
        MockClip.assert_called()
        mock_clip_instance.write_videofile.assert_called()
