import subprocess

import pytest


@pytest.fixture(scope="module", autouse=True)
def setup_logs():
    """Clear the static analysis log at start of module."""
    import os

    if os.path.exists("logs/static_analysis.log"):
        os.remove("logs/static_analysis.log")
    yield


def run_script(script_path):
    """Run a python script and fail if it errors."""
    command = f"./{script_path}"
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    # Write output to log file for analyze.sh (append mode since multiple tests use this)
    import os

    project_root = os.getcwd()  # Assumption: run from root
    logs_dir = os.path.join(project_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)

    with open(os.path.join(logs_dir, "static_analysis.log"), "a") as f:
        f.write(f"\n--- {script_path} ---\n")
        f.write(result.stdout)
        f.write("\n")
        f.write(result.stderr)

    if result.returncode != 0:
        pytest.fail(
            f"Script failed: {script_path}\n\nOUTPUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )
    return result


def test_contrast_compliance():
    """Ensure contrast standards are met."""
    # We output to a log file but also capture stdout for failure reporting
    run_script("scripts/check_contrast.py")


def test_path_integrity():
    """Ensure no absolute paths are used in docs."""
    run_script("scripts/enforce_relative_paths.py")


def test_css_compliance():
    """Ensure CSS compliance."""
    run_script("scripts/check_css_compliance.py")
