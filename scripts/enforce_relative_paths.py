#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path

# Project root relative to this script
PROJECT_ROOT = Path(__file__).parent.parent.absolute()

# Patterns that indicate absolute project paths
# We look for the common patterns that appeared: /home/chacker/projects/papeterie-engine
# and also the file:/// scheme followed by an absolute linux path.
PATTERNS = [
    re.compile(r"file:///home/[\w.-]+/"),
    re.compile(rf"{re.escape(str(PROJECT_ROOT))}"),
    # Common user home pattern in case project root detection is slightly off in some envs
    re.compile(r"/home/[\w.-]+/projects/papeterie-engine"),
]

# Files and directories to ignore
EXCLUDE_DIRS = {
    ".git",
    ".agent",
    "node_modules",
    ".venv",
    "__pycache__",
    "logs",
    "dist",
    "coverage",
    ".pytest_cache",
    ".ruff_cache",
    ".aider.tags.cache.v4",
}

EXCLUDE_FILES = {
    "enforce_relative_paths.py",
    "uv.lock",
    "package-lock.json",
    ".coverage",
}

# Binary extensions to skip
BINARY_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".mp4",
    ".db",
}


def is_binary(file_path):
    return file_path.suffix.lower() in BINARY_EXTENSIONS


def check_file(file_path):
    offending_lines = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f, 1):
                for pattern in PATTERNS:
                    if pattern.search(line):
                        offending_lines.append((i, line.strip()))
                        break
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    return offending_lines


def main():
    root_dir = PROJECT_ROOT
    errors = 0

    print(f"Scanning for absolute paths in {root_dir}...")

    for root, dirs, files in os.walk(root_dir):
        # Prune excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            if file in EXCLUDE_FILES:
                continue

            file_path = Path(root) / file

            if is_binary(file_path):
                continue

            problems = check_file(file_path)
            if problems:
                errors += 1
                rel_path = file_path.relative_to(root_dir)
                print(f"\n❌ Absolute path(s) found in {rel_path}:")
                for line_num, content in problems:
                    print(f"  L{line_num}: {content}")

    if errors > 0:
        print(f"\nTotal: {errors} files found with absolute paths.")
        print("Please use relative paths instead (e.g., ../src/ or assets/diagrams/).")
        sys.exit(1)
    else:
        print("✅ No absolute paths found.")
        sys.exit(0)


if __name__ == "__main__":
    main()
