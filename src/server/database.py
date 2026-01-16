import os

## @DOC
# ### Persistence Layer
# Handles local storage and ownership tracking using **SQLite**:
# - **User Management**: Stores credentials and timestamps.
# - **Asset Ownership**: Links sprites and scenes to specific user IDs.
# - **Database Initialization**: Ensures tables exist at project startup.
import sqlite3
from pathlib import Path

from src.config import PROJECT_ROOT

env_path = os.environ.get("PAPETERIE_DB_PATH")
if env_path:
    DB_PATH = Path(env_path)
else:
    DB_PATH = PROJECT_ROOT / "papeterie.db"


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with necessary tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Create Assets table to track ownership
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        asset_type TEXT NOT NULL, -- 'sprite' or 'scene'
        asset_name TEXT NOT NULL,
        is_shared BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, asset_type, asset_name)
    )
    """)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
