#!/bin/bash
set -eo pipefail

# Store the project root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure logs directory exists
mkdir -p logs

# Start log
LOG_FILE="logs/smart_validate.log"
echo "Starting Smart Verification (Impact Analysis) at $(date)" | tee "$LOG_FILE"

echo "Running Backend Impact Analysis (pytest-testmon)..." | tee -a "$LOG_FILE"
# First run might take longer to build database if it doesn't exist
uv run pytest --testmon -m "not live" 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Running Frontend Impact Analysis (vitest --changed)..." | tee -a "$LOG_FILE"
cd src/web
# vitest --changed runs tests related to uncommitted changes
# If no changes, it might run nothing, which is expected.
npm run test:run -- --changed 2>&1 | tee -a "../../$LOG_FILE"
cd "$ROOT_DIR"

echo "Smart Verification Complete!" | tee -a "$LOG_FILE"

