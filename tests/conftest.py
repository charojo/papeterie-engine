import pytest

from src.server.database import init_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()
