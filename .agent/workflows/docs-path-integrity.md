---
description: How to maintain path integrity and avoid absolute paths in documentation
---

This workflow ensures that all project documentation (files in `docs/`) uses relative paths for internal links and assets, maintaining portability and preventing environment-specific errors.

## Principles

1.  **Portability**: Documentation must be viewable and functional on any machine (Local, WSL, GitHub, etc.).
2.  **Schema Distinction**:
    *   **Relative Paths**: MUST be used in all permanent project documentation (e.g., `[link](./other.md)`, `![image](../assets/img.png)`).
    *   **Absolute Paths**: ONLY allowed in transient agent artifacts (implementation plans, walkthroughs) stored in the `.gemini/` directory, using the `file:///` URI scheme.

## Steps

1.  **Check for Absolute Paths**:
    Before committing or finalizing any design document, run the path enforcement script:
    ```bash
    python scripts/enforce_relative_paths.py
    ```

2.  **Fixing Violations**:
    If absolute paths are found (e.g., starting with `/home/` or `file:///home/`):
    - Identify the target file's location relative to the current document.
    - Replace the absolute path with a standard markdown relative path.
    - **Example**: Replace an absolute path like `file:///home/user/.../target.md` with `./target.md`.

3.  **Cross-Document Linking**:
    - Use `./` for files in the same directory.
    - Use `../` to traverse up the directory tree.
    - Always verify the link by clicking it in your editor or checking the rendered markdown.

4.  **Diagrams and Assets**:
    - All diagrams in `docs/` should reference images in `docs/assets/diagrams/` via relative paths (e.g., `../assets/diagrams/image.png`).
