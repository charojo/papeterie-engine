import io

from PIL import Image


def test_rotate_endpoint():
    """
    Simulates the backend rotation logic using PIL to verify behavior.
    """
    # Create valid dummy image (RECTANGLE: Width > Height)
    # 100x50 red rectangle
    img = Image.new("RGBA", (100, 50), (255, 0, 0, 255))

    # Save to buffer
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    # Reload and Rotate 90 degrees (UI "Right")
    # Backend does: request.angle = 90
    # img.rotate(-90, expand=True)

    angle = 90
    loaded_img = Image.open(buf)
    rotated = loaded_img.rotate(-angle, expand=True)

    # Check dimensions
    # Original: 100x50
    # Rotated 90: Should be 50x100
    print(f"Original: {loaded_img.size}")
    print(f"Rotated: {rotated.size}")

    assert rotated.size == (50, 100), f"Expected (50, 100) but got {rotated.size}"

    # Rotate again 90
    rotated2 = rotated.rotate(-angle, expand=True)
    print(f"Rotated x2: {rotated2.size}")
    assert rotated2.size == (100, 50), f"Expected (100, 50) but got {rotated2.size}"
