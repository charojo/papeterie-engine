import os
import subprocess

import pytest


def test_frontend_coverage():
    """Run frontend unit tests with coverage."""
    project_root = os.getcwd()
    frontend_dir = os.path.join(project_root, "src/web")

    # Ensure logs directory exists
    logs_dir = os.path.join(project_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)
    log_file = os.path.join(logs_dir, "frontend_unit.log")

    # Use tee to stream to stdout AND file
    # We use explicit pipe to avoid shell=True complexity with pipe if possible,
    # but shell=True is easiest for piping.
    # Note: 'npm run test:coverage' might output colors, which we want in console
    # but maybe not in log, but having colors in log is usually fine for analyze.sh.

    cmd_str = f"npm run test:coverage 2>&1 | tee {log_file}"

    print(f"Executing: {cmd_str}")
    result = subprocess.run(cmd_str, shell=True, cwd=frontend_dir, text=True)

    if result.returncode != 0:
        pytest.fail(f"Frontend tests failed. See {log_file} for details.")
