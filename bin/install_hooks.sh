#!/bin/bash
# Installs git hooks for the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

HOOK_PATH="$PROJECT_ROOT/.git/hooks/pre-commit"

echo "Installing git hooks..."

if [ ! -d "$PROJECT_ROOT/.git/hooks" ]; then
    mkdir -p "$PROJECT_ROOT/.git/hooks"
fi

cat > "$HOOK_PATH" <<EOF
#!/bin/bash
# Pre-commit hook to run fast validation
echo "Running pre-commit validation..."
$PROJECT_ROOT/agent_env/bin/validate.sh --fast
EOF

chmod +x "$HOOK_PATH"
echo "Pre-commit hook installed."
