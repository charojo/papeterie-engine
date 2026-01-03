#!/bin/bash
set -eo pipefail

# Store the project root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Parse arguments
FIX_MODE=true
for arg in "$@"; do
    case $arg in
        --nofix)
            FIX_MODE=false
            ;;
    esac
done

# Ensure logs directory exists
mkdir -p logs

{
    echo "Starting Verification at $(date)"
    echo "----------------------------------------"

    if [ "$FIX_MODE" = true ]; then
        echo "Auto-fixing Backend code style..."
        uv run ruff check --fix .
        uv run ruff format .
        echo ""
        echo "Auto-fixing Frontend code style..."
        pushd src/web > /dev/null
        npm run lint -- --fix || true  # Don't fail on unfixable issues
        popd > /dev/null
        echo ""
    fi

    echo "Running Backend Linters..."
    uv run ruff check .
    uv run ruff format --check .

    echo "Running Backend Tests..."
    uv run pytest --cov=src --cov-report=term-missing

    echo "Running Frontend Linters..."
    pushd src/web > /dev/null
    npm run lint
    popd > /dev/null
    
    echo "Running Frontend Tests (with Coverage)..."
    pushd src/web > /dev/null
    npm run test:coverage
    popd > /dev/null
    
    echo "----------------------------------------"
    echo "All tests passed!"
} | tee >(sed 's/\x1b\[[0-9;]*m//g' > logs/validate.log)

# Give sed a moment to flush to disk
sleep 1

# Run coverage analysis and append to log (and show on screen)
echo "" | tee -a logs/validate.log
./scripts/analyze.sh logs/validate.log | tee -a logs/validate.log
