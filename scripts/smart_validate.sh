#!/bin/bash
set -eo pipefail

# Store the project root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure logs directory exists
mkdir -p logs

{
    echo "Starting Smart Verification (Impact Analysis) at $(date)"
    echo "-----------------------------------------------------"

    echo "Running Backend Impact Analysis (pytest-testmon)..."
    # First run might take longer to build database if it doesn't exist
    uv run pytest --testmon

    echo ""
    echo "Running Frontend Impact Analysis (vitest --changed)..."
    pushd src/web > /dev/null
    # vitest --changed runs tests related to uncommitted changes
    # If no changes, it might run nothing, which is expected.
    npm run test:run -- --changed
    popd > /dev/null

    echo "-----------------------------------------------------"
    echo "Smart Verification Complete!"
} | tee >(sed 's/\x1b\[[0-9;]*m//g' > logs/smart_validate.log)
