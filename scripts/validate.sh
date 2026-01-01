#!/bin/bash
set -eo pipefail

# Ensure logs directory exists
mkdir -p logs

{
    echo "Starting Verification at $(date)"
    echo "----------------------------------------"

    echo "Running Backend Linters..."
    uv run ruff check .
    uv run ruff format --check .

    echo "Running Backend Tests..."
    uv run pytest --cov=src --cov-report=term-missing

    # echo "Running Frontend Linters..."
    # cd src/web
    # npm run lint
    
    echo "Running Frontend Tests (with Coverage)..."
    cd src/web && npm run test:coverage && cd ../..
    
    echo "----------------------------------------"
    echo "All tests passed!"
} | tee >(sed 's/\x1b\[[0-9;]*m//g' > logs/verification.log)
