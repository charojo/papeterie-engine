import pytest
import pygame

@pytest.fixture(scope="session", autouse=True)
def pygame_init():
    """Initialize pygame for all tests."""
    pygame.init()
    # Create a minimal display surface for tests that need it.
    pygame.display.set_mode((1, 1))
