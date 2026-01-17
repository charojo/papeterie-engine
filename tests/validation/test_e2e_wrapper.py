import os
import signal
import subprocess
import sys
import time

import pytest
import requests


def is_port_in_use(port):
    """Check if a port is in use."""
    # A simple way is to try to connect to it
    try:
        # We can simulate this by trying to grab the port via socket,
        # but calling lsof or curl is also fine for this environment.
        # Let's use lsof as in the original script if possible, or python socket.
        import socket

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(("localhost", port)) == 0
    except OSError:
        return False


def wait_for_servers(timeout=30):
    """Wait for backend and frontend to be responsive."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            b_resp = requests.get("http://localhost:8000/docs")
            f_resp = requests.get("http://localhost:5173")
            if b_resp.status_code == 200 and f_resp.status_code == 200:
                return True
        except requests.ConnectionError:
            pass
        time.sleep(1)
    return False


@pytest.fixture(scope="module")
def ensure_servers_running():
    """
    Fixture that ensures backend (8000) and frontend (5173) are running.
    If not, it starts them and tears them down after the module finishes.
    """
    backend_p = None
    frontend_p = None

    backend_running = is_port_in_use(8000)
    frontend_running = is_port_in_use(5173)

    started_backend = False
    started_frontend = False

    project_root = os.getcwd()
    logs_dir = os.path.join(project_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)

    try:
        if not backend_running:
            print("Starting Backend for E2E...")
            backend_log = open(os.path.join(logs_dir, "backend_e2e.log"), "w")
            backend_p = subprocess.Popen(
                ["uv", "run", "uvicorn", "src.server.main:app", "--reload", "--port", "8000"],
                stdout=backend_log,
                stderr=backend_log,
                cwd=project_root,
                preexec_fn=os.setsid,
            )
            started_backend = True

        if not frontend_running:
            print("Starting Frontend for E2E...")
            frontend_dir = os.path.join(project_root, "src/web")
            frontend_log = open(os.path.join(logs_dir, "frontend_e2e.log"), "w")
            frontend_p = subprocess.Popen(
                ["npm", "run", "dev", "--", "--port", "5173"],
                stdout=frontend_log,
                stderr=frontend_log,
                cwd=frontend_dir,
                preexec_fn=os.setsid,
            )
            started_frontend = True

        if started_backend or started_frontend:
            print("Message: Auto-started servers. Waiting for responsiveness...")

        # ALWAYS verify servers are responsive, even if they were already running.
        if not wait_for_servers():
            raise RuntimeError(
                "Servers (Backend:8000, Frontend:5173) failed to be responsive. "
                "Please stop any zombie processes and try again."
            )

        yield

    finally:
        # Teardown
        if started_backend and backend_p:
            print("Stopping Auto-started Backend...")
            os.killpg(os.getpgid(backend_p.pid), signal.SIGTERM)
        if started_frontend and frontend_p:
            print("Stopping Auto-started Frontend...")
            os.killpg(os.getpgid(frontend_p.pid), signal.SIGTERM)


@pytest.mark.e2e
def test_e2e_playwright(ensure_servers_running):
    """Run Playwright E2E tests with process monitoring."""
    project_root = os.getcwd()
    frontend_dir = os.path.join(project_root, "src/web")

    # Determine scope from environment variable
    e2e_scope = os.environ.get("E2E_SCOPE", "full")
    e2e_filter = os.environ.get("E2E_FILTER")
    update_snapshots = os.environ.get("UPDATE_SNAPSHOTS", "false").lower() == "true"

    if e2e_scope == "skip":
        pytest.skip("E2E_SCOPE is set to skip")
        return

    base_cmd = ["npx", "playwright", "test"]
    if update_snapshots:
        base_cmd.append("--update-snapshots")

    if e2e_scope == "smoke":
        print("Running E2E Smoke Tests...")
        base_cmd.extend(["smoke_test", "--reporter=list", "--workers=1"])
    else:
        print("Running Full E2E Suite...")
        base_cmd.extend(["--reporter=list", "--workers=1"])

    if e2e_filter:
        target_filter = e2e_filter
        if e2e_filter.isdigit():
            # Resolve numeric filter by listing tests
            print(f"Resolving E2E test #{e2e_filter}...")
            try:
                list_proc = subprocess.run(
                    ["npx", "playwright", "test", "--list"],
                    cwd=frontend_dir,
                    capture_output=True,
                    text=True,
                )
                if list_proc.returncode == 0:
                    lines = list_proc.stdout.splitlines()
                    test_lines = []
                    for line in lines:
                        stripped = line.strip()
                        if stripped.startswith("["):  # e.g. [chromium] › ...
                            test_lines.append(stripped)

                    idx = int(e2e_filter) - 1  # 1-based index
                    if 0 <= idx < len(test_lines):
                        # Extract the test title, usually the last part after ›
                        # Example: [chromium] › file.js › Suite › Test Name
                        # We can just grep the whole line content effectively, or the last segment.
                        # Playwright -g matches against the full title.
                        # Let's use the full line but escape special regex chars if needed?
                        # Actually -g takes a regex. The list output puts it nicely.
                        # Let's try to grab the unique title at the end.
                        found_line = test_lines[idx]
                        # Clean up the listing format to get a usable grep string
                        # Listing: [chromium] › file.spec.js:25:5 › Suite › Test Name
                        # We just want "Test Name" or a reliable substring.
                        # Splitting by ' › ' seems robust for Playwright default reporter.
                        parts = found_line.split(" › ")
                        if len(parts) > 0:
                            target_filter = parts[-1]
                            print(f"Resolved #{e2e_filter} to: '{target_filter}'")
                        else:
                            print(f"Could not parse test name from: {found_line}")
                    else:
                        print(f"Test #{e2e_filter} out of range (Found {len(test_lines)} tests)")
            except Exception as e:
                print(f"Error resolving test list: {e}")

        print(f"Applying E2E Filter: {target_filter}")
        base_cmd.extend(["-g", target_filter])

    print(f"Executing: {' '.join(base_cmd)}")

    # Start Playwright process (non-blocking)
    # We use valid Popen args list instead of shell=True for better control
    pw_process = subprocess.Popen(base_cmd, cwd=frontend_dir, stdout=sys.stdout, stderr=sys.stderr)

    # Monitor Loop
    # We check:
    # 1. Is Playwright done?
    # 2. Are Backend/Frontend ports still listening?
    #    (Note: Checking the actual PID from ensure_servers_running is harder due to fixture scope,
    #     so checking ports or basic responsiveness is a good proxy.
    #     Better yet, we can check basic connectivity.)

    try:
        while True:
            # 1. Check Playwright
            ret_code = pw_process.poll()
            if ret_code is not None:
                # Process finished
                if ret_code != 0:
                    # Look for visual regression diffs
                    test_results_dir = os.path.join(frontend_dir, "test-results")
                    if os.path.exists(test_results_dir):
                        print("\nFinding visual regression diffs...")
                        found_diffs = False
                        for root, dirs, files in os.walk(test_results_dir):
                            for file in files:
                                if file.endswith("-diff.png"):
                                    found_diffs = True
                                    full_path = os.path.join(root, file)
                                    print(f"Visual Diff Found: {full_path}")
                                    # Also ensure we point out the expected vs actual if they exist
                                    actual = full_path.replace("-diff.png", "-actual.png")
                                    expected = full_path.replace("-diff.png", "-expected.png")
                                    if os.path.exists(actual):
                                        print(f"  - Actual: {actual}")
                                    if os.path.exists(expected):
                                        print(f"  - Expected: {expected}")

                        if not found_diffs:
                            print("No visual regression diff images found in test-results.")

                    pytest.fail(f"Playwright tests failed with exit code {ret_code}.")
                return  # Success

            # 2. Check Backend (8000) and Frontend (5173) Health
            # If they die, Playwright will likely timeout eventually, but we want to fail fast.
            if not is_port_in_use(8000):
                pw_process.terminate()
                pytest.fail("Backend server (port 8000) CRASHED during E2E tests!")

            if not is_port_in_use(5173):
                pw_process.terminate()
                pytest.fail("Frontend server (port 5173) CRASHED during E2E tests!")

            time.sleep(1)

    except KeyboardInterrupt:
        pw_process.terminate()
        raise
