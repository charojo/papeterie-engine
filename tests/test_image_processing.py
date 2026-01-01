from PIL import Image

from src.server.image_processing import optimize_image, remove_green_screen


def create_test_image(color, size=(100, 100)):
    img = Image.new("RGB", size, color)
    return img


def test_remove_green_screen():
    # purely green image
    green_img = create_test_image((0, 255, 0))  # Green
    processed_green = remove_green_screen(green_img)
    # Check if center pixel is transparent
    assert processed_green.mode == "RGBA"
    assert processed_green.getpixel((50, 50)) == (255, 255, 255, 0)

    # Red image (should remain opaque)
    red_img = create_test_image((255, 0, 0))  # Red
    processed_red = remove_green_screen(red_img)
    assert processed_red.getpixel((50, 50)) == (255, 0, 0, 255)


def test_optimize_image():
    # Large image
    large_img = create_test_image((255, 255, 255), size=(4096, 4096))
    optimized = optimize_image(large_img, max_size=2048)
    assert optimized.size == (2048, 2048)

    # Small image should remain same
    small_img = create_test_image((255, 255, 255), size=(100, 100))
    optimized_small = optimize_image(small_img, max_size=2048)
    assert optimized_small.size == (100, 100)
