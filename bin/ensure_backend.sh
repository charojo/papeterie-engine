#!/bin/bash
# Kill existing backend if it's there
pkill -f "start_dev" || echo "No backend running."
sleep 2
# Start fresh
nohup ./bin/start_dev.sh > logs/backend.log 2>&1 &
echo "Backend restarted."
