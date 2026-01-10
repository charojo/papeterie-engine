#!/bin/bash
set -e

# scripts/prepare_deploy.sh
# Prepares the local environment for PythonAnywhere deployment.
# 1. Exports "lite" requirements.txt from uv (base dependencies only)
# 2. Builds the frontend (if needed or forced)

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Papeterie Engine: Prepare for Deployment ==="

# 1. Export requirements.txt (Lite / Base only)
echo -e "\n--> Generating requirements.txt (Lite / Base only)..."
if command -v uv >/dev/null 2>&1; then
    # --no-dev excludes dev dependencies
    # By default, without --extra, this excludes optional dependencies (processing, renderer)
    uv export --format requirements-txt --no-dev > requirements.txt
    
    # Check if heavy libs sneaked in
    if grep -qE "rembg|pygame|moviepy|opencv" requirements.txt; then
        echo "[WARNING] Heavy dependencies found in requirements.txt!"
        echo "Check pyproject.toml and uv.lock."
    else
        echo "requirements.txt generated successfully (Lite version)."
    fi
else
    echo "[ERROR] 'uv' is not installed or not in PATH. Cannot export requirements."
    exit 1
fi

# 2. Build Frontend
echo -e "\n--> Checking frontend build..."
DIST_DIR="$PROJECT_ROOT/src/web/dist"
FORCE_BUILD=false

for arg in "$@"; do
    if [ "$arg" == "--rebuild" ]; then
        FORCE_BUILD=true
    fi
done

if [ ! -d "$DIST_DIR" ] || [ "$FORCE_BUILD" = true ]; then
    echo "Building frontend..."
    cd "$PROJECT_ROOT/src/web"
    npm install
    npm run build
    cd "$PROJECT_ROOT"
    echo "Frontend build complete."
else
    echo "Frontend build found at $DIST_DIR. Skipping build."
    echo "Use --rebuild to force a fresh build."
fi

# 3. Final Instructions
echo -e "\n========================================"
echo "PREPARATION COMPLETE"
echo "========================================"
echo "1. Commit generated artifacts:"
echo "   git add requirements.txt"
echo "   git commit -m 'chore: update deployment artifacts'"
echo "   git push"
echo ""
echo "2. On PythonAnywhere console:"
echo "   git pull"
echo "   python3.10 scripts/setup_pythonAnywhere.py"
echo "   (This will install the lite dependency set)"
echo ""
echo "3. Upload frontend assets:"
echo "   rsync -avz src/web/dist/ <user>@ssh.pythonanywhere.com:~/papeterie-engine/src/web/dist/"
echo "========================================"
