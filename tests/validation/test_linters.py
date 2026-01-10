import os
import subprocess

import pytest


def run_command(command, cwd=None):
    """Run a shell command and fail the test if it exits with non-zero code."""
    result = subprocess.run(command, shell=True, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        pytest.fail(
            f"Command failed: {command}\n\nSTDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )
    return result


def test_frontend_lint():
    """Run npm lint on the frontend."""
    project_root = os.getcwd()
    frontend_dir = os.path.join(project_root, "src/web")
    run_command("npm run lint", cwd=frontend_dir)


def test_backend_lint():
    """Run Ruff check and format check on the backend."""
    # Check for lint errors
    run_command("uv run ruff check .")
    # Check for formatting issues
    run_command("uv run ruff format --check .")
