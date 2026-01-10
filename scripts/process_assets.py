import argparse
import os
import shutil
import sys
from pathlib import Path

from PIL import Image

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent))

from src.server.image_processing import remove_green_screen as central_remove_green


def remove_green_screen(image_path, output_path, threshold=50):
    """
    Process an image to remove green screen background using centralized logic.
    """
    try:
        img = Image.open(image_path)
        processed_img = central_remove_green(img, threshold)
        processed_img.save(output_path, "PNG")
        print(f"Processed: {output_path}")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")


def process_single_asset(src, dest, mode="transparent", threshold=40):
    """
    Process a single asset based on arguments.
    """
    if not os.path.exists(src):
        print(f"Error: Source file not found: {src}")
        return

    dest_dir = os.path.dirname(dest)
    if dest_dir and not os.path.exists(dest_dir):
        os.makedirs(dest_dir, exist_ok=True)

    if mode == "copy":
        shutil.copy(src, dest)
        print(f"Copied: {dest}")
    elif mode == "transparent":
        remove_green_screen(src, dest, threshold)
    else:
        print(f"Unknown mode: {mode}")


def process_batch_assets():
    """
    Legacy batch processing for existing project assets.
    """
    base_dir = "assets/sprites"

    # To run batch processing, set the path to where your generated assets are located
    base_path = os.getenv("ASSET_STAGING_DIR", "temp_assets")

    # Example paths (update to your actual files)
    vibe_img = f"{base_path}/starbuilders_enhanced_vibe.png"
    villagers_gs = f"{base_path}/starbuilders_villagers_sprite.png"
    lantern_gs = f"{base_path}/starbuilders_lantern_sprite.png"
    background_img = f"{base_path}/starbuilders_background_lake_sky.png"

    # --- Starbuilders (Charcoal) ---
    bg_charcoal = f"{base_path}/starbuild_bg_charcoal_sketch.png"
    lantern_charcoal = f"{base_path}/starbuild_lantern_charcoal_sketch.png"
    watching_charcoal = f"{base_path}/starbuild_villager_watching_charcoal_sketch.png"
    sitting_charcoal = f"{base_path}/starbuild_villager_sitting_charcoal_sketch.png"
    releasing_charcoal = f"{base_path}/starbuild_villager_releasing_charcoal_sketch.png"

    asset_operations = [
        ("starbuild_villagers", villagers_gs, "transparent"),
        ("starbuild_lantern", lantern_gs, "transparent"),
        ("starbuild_bg", background_img, "copy"),
        ("starbuild_bg_charcoal", bg_charcoal, "copy"),
        ("starbuild_lantern_charcoal", lantern_charcoal, "transparent"),
        ("starbuild_villager_watching", watching_charcoal, "transparent"),
        ("starbuild_villager_sitting", sitting_charcoal, "transparent"),
        ("starbuild_villager_releasing", releasing_charcoal, "transparent"),
    ]

    print(f"Starting batch asset processing for {len(asset_operations)} items...")

    for d_name, src, op_type in asset_operations:
        if not src or not os.path.exists(src):
            print(f"Skipping {d_name}: Source not found ({src})")
            continue

        target_dir = os.path.join(base_dir, d_name)
        target_path = os.path.join(target_dir, f"{d_name}.png")
        process_single_asset(src, target_path, mode=op_type)

    if os.path.exists(vibe_img):
        shutil.copy(vibe_img, "assets/originals/starbuilders_stylized.png")

    print("Batch asset processing complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process game assets (green screen removal/copy).")
    parser.add_argument("--src", help="Source image path")
    parser.add_argument("--dest", help="Destination image path")
    parser.add_argument(
        "--mode", choices=["transparent", "copy"], default="transparent", help="Processing mode"
    )
    parser.add_argument("--threshold", type=int, default=40, help="Green screen threshold")
    parser.add_argument("--batch", action="store_true", help="Run legacy batch processing")

    args = parser.parse_args()

    # If no args provided, or --batch is set, run batch logic (backward compatibility)
    if args.batch or (not args.src and not args.dest):
        process_batch_assets()
    elif args.src and args.dest:
        process_single_asset(args.src, args.dest, args.mode, args.threshold)
    else:
        print("Error: must provide both --src and --dest for single file processing.")
        parser.print_help()
