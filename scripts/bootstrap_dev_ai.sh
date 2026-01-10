#!/bin/bash
set -e

# Bootstrap script for the "Dev-AI" environment
# This sets up a feature-rich environment for AI development and desktop rendering.

echo "=== Papeterie Engine: Dev-AI Bootstrap ==="

# 1. Check for uv
if ! command -v uv &> /dev/null; then
    echo "Error: 'uv' is not installed. Please install it first:"
    echo "curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# 2. Sync dependencies with all extras
echo "--> Installing all dependencies (Base + Processing + Renderer + Dev)..."
# 'dev' is a dependency group, 'processing' and 'renderer' are extras
uv sync --all-extras --group dev

# 3. Verify key components
echo "--> Verifying critical components..."
source .venv/bin/activate

python -c "import rembg; print(f'Rembg: OK ({rembg.__version__})')" || echo "Rembg: FAILED"
python -c "import cv2; print(f'OpenCV: OK ({cv2.__version__})')" || echo "OpenCV: FAILED"
python -c "import pygame; print(f'Pygame: OK ({pygame.version.ver})')" || echo "Pygame: FAILED"

echo ""
echo "=== Setup Complete ==="
echo "You are now in the Dev-AI configuration."
echo "To run the full desktop theatre:"
echo "  uv run python src/renderer/theatre.py"
echo ""
echo "To run the validation suite:"
echo "  uv run pytest"
