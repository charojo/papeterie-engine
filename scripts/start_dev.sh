#!/bin/bash
set -e

# Function to kill all background jobs on exit
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p) 2>/dev/null
}
trap cleanup EXIT

# Get the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Checking for existing processes on ports 8000 (backend) and 5173 (frontend)..."

# Kill process on port 8000 (Backend)
if command -v lsof >/dev/null; then
    if lsof -ti:8000 >/dev/null; then
        echo "Killing existing backend on port 8000..."
        lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    fi
    # Kill process on port 5173 (Frontend)
    if lsof -ti:5173 >/dev/null; then
        echo "Killing existing frontend on port 5173..."
        lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    fi
else
    echo "Warning: 'lsof' not found. Cannot automatically kill existing processes on ports."
    echo "If servers fail to start, please manually kill processes on ports 8000 and 5173."
fi

echo "Starting backend server..."
cd "$PROJECT_ROOT"
# Using --reload for development
uv run uvicorn src.server.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting frontend server..."
cd "$PROJECT_ROOT/src/web"
npm run dev -- --port 5173 & 
FRONTEND_PID=$!

echo "Servers started!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both servers."

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
