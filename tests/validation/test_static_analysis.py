import fcntl
import os
import subprocess

import pytest


@pytest.fixture(scope="session", autouse=True)
def setup_logs():
    """Ensure logs directory exists for static analysis output.

    Note: Log clearing is handled by validate.sh before tests run,
    not by this fixture, to avoid race conditions with pytest-xdist.
    """
    os.makedirs("logs", exist_ok=True)
    yield


def run_script(script_path):
    """Run a python script and fail if it errors."""
    command = f"./{script_path}"
    result = subprocess.run(command, shell=True, capture_output=True, text=True)

    # Write output to log file for analyze.sh (append mode since multiple tests use this)
    project_root = os.getcwd()  # Assumption: run from root
    logs_dir = os.path.join(project_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)

    log_path = os.path.join(logs_dir, "static_analysis.log")

    # Use file locking to prevent race conditions in parallel execution
    with open(log_path, "a") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)  # Exclusive lock
        try:
            f.write(f"\n--- {script_path} ---\n")
            f.write(result.stdout)
            f.write("\n")
            f.write(result.stderr)
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)  # Release lock

    if result.returncode != 0:
        pytest.fail(
            f"Script failed: {script_path}\n\nOUTPUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )
    return result


@pytest.mark.xdist_group("serial")
def test_contrast_compliance():
    """Ensure contrast standards are met."""
    # We output to a log file but also capture stdout for failure reporting
    run_script("scripts/check_contrast.py")


@pytest.mark.xdist_group("serial")
def test_path_integrity():
    """Ensure no absolute paths are used in docs."""
    run_script("scripts/enforce_relative_paths.py")


@pytest.mark.xdist_group("serial")
def test_css_compliance():
    """Ensure CSS compliance."""
    run_script("scripts/check_css_compliance.py")
