#!/bin/bash
set -eo pipefail

# Store the project root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Parse arguments
FIX_MODE=true
LIVE_MODE=false
for arg in "$@"; do
    case $arg in
        --nofix)
            FIX_MODE=false
            ;;
        --live)
            LIVE_MODE=true
            ;;
    esac
done

# Ensure logs directory exists
mkdir -p logs

{
    echo "Starting Verification at $(date)"

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
    if [ "$LIVE_MODE" = true ]; then
        echo "\033[0;33mRunning ALL tests including LIVE API calls...\033[0m"
        uv run pytest --cov=src --cov-report=term-missing
    else
        echo "Skipping live tests (use --live to include them)..."
        uv run pytest -m "not live" --cov=src --cov-report=term-missing
    fi

    echo "Running Frontend Linters..."
    pushd src/web > /dev/null
    npm run lint
    popd > /dev/null
    
    echo "Running Frontend Tests (with Coverage)..."
    pushd src/web > /dev/null
    npm run test:coverage
    popd > /dev/null
    
    echo "All tests passed!"
} | tee >(sed 's/\x1b\[[0-9;]*m//g' > logs/validate.log)

# Give sed a moment to flush to disk
sleep 1

# Run coverage analysis and append to log (and show on screen)
echo "" | tee -a logs/validate.log
echo "Running Contrast Standards Check..." | tee -a logs/validate.log
./scripts/check_contrast.py --output logs/contrast_report.log
cat logs/contrast_report.log | tee -a logs/validate.log

echo "" | tee -a logs/validate.log
echo "Enforcing Relative Paths..." | tee -a logs/validate.log
./scripts/enforce_relative_paths.py | tee -a logs/validate.log

echo "" | tee -a logs/validate.log
./scripts/analyze.sh logs/validate.log | tee -a logs/validate.log
