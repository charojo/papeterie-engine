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

    print("Executing: npm run test:coverage")
    print(f"Working Directory: {frontend_dir}")

    # Use subprocess.run for simpler execution if we don't need to parse line-by-line
    # Inheriting stdout/stderr ensures we see output in 'pytest -s' and avoids pipe deadlocks.
    try:
        # Note: We run with CI=true to ensure no interactive prompts
        result = subprocess.run(
            ["npm", "run", "test:coverage"],
            cwd=frontend_dir,
            env={**os.environ, "CI": "true"},
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )

        # Write to log file for analyze.sh
        with open(log_file, "w") as f:
            f.write(result.stdout)
            f.write(result.stderr)

        print(f"Frontend coverage execution completed with exit code: {result.returncode}")

        if result.returncode != 0:
            msg = f"Frontend tests failed (Exit Code: {result.returncode}). See {log_file}."
            pytest.fail(msg)

    except subprocess.TimeoutExpired:
        pytest.fail("Frontend coverage test timed out after 5 minutes.")
    except Exception as e:
        pytest.fail(f"Frontend coverage test encountered an error: {e}")
