#!/bin/bash

# Script to launch the sqlite-web database inspector for the Papeterie Engine

DB_PATH="./papeterie.db"

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file $DB_PATH not found."
    exit 1
fi

echo "Launching sqlite-web for $DB_PATH..."
uv run python -m sqlite_web "$DB_PATH" --port 8081
