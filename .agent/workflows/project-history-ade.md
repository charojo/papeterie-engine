---
description: Analyze project evolution and statistics over time
---

# Project History Analysis

This workflow allows you to analyze the evolution of the project by traversing the git history.
It generates a report containing statistics for each commit, including Lines of Code (LOC) per language, and counts of TODO/FIXME markers.

## Prerequisites

- The `agent_env` must be configured.
- You must be inside a git repository.

## Usage

Run the analysis script directly from the bin directory (or your PATH if configured):

```bash
# Analyze the last 10 commits and print to stdout
python3 agent_env/bin/ADE_project_history.py --limit 10

# Analyze the entire history and save to a file
python3 agent_env/bin/ADE_project_history.py --output history_report.md
```

## Options

- `--limit <N>`: Limit the analysis to the most recent N commits.
- `--reverse`: Analyze in reverse chronological order (oldest first).
- `--output <FILE>`: Save the Markdown report to the specified file.

## Output Format

The output is a Markdown table with the following columns:

- **Date**: Commit date (YYYY-MM-DD)
- **Commit**: Short commit hash
- **Author**: Commit author
- **Total LOC**: Total lines of code tracked
- **Py LOC**: Python lines of code
- **TS/JS LOC**: TypeScript and JavaScript lines of code
- **MD LOC**: Markdown lines of code
- **Tests**: Number of test files detected
- **TODOs**: Count of "TODO" markers
- **NEEDS_FIX**: Count of "FIXME" markers

## Example Report

| Date | Commit | Author | Total LOC | Py LOC | TS/JS LOC | MD LOC | Tests | TODOs | NEEDS_FIX |
|---|---|---|---|---|---|---|---|---|---|
| 2024-01-15 | `a1b2c3d` | Alice Dev | 1500 | 800 | 400 | 300 | 12 | 5 | 2 |
| 2024-01-14 | `x9y8z7w` | Bob Engineer | 1450 | 780 | 390 | 280 | 11 | 4 | 2 |
