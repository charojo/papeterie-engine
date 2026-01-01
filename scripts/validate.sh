#!/bin/bash
set -eo pipefail

# Ensure logs directory exists
mkdir -p logs

{
    echo "Starting Verification at $(date)"
    echo "----------------------------------------"

    echo "Running Backend Tests..."
    uv run pytest --cov=src --cov-report=term-missing

    echo "Running Frontend Tests..."
    cd src/web
    npm run test:coverage
    
    echo "----------------------------------------"
    echo "All tests passed!"
} | tee >(sed 's/\x1b\[[0-9;]*m//g' > logs/verification.log)
