import argparse
import os
import shutil

from PIL import Image


def remove_green_screen(image_path, output_path, threshold=50):
    """
    Process an image to remove green screen background.
    """
    try:
        img = Image.open(image_path).convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            r, g, b, a = item
            # Check if green is dominant
            if g > r + threshold and g > b + threshold:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
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

    # --- Starbuilders (Original) ---
    base_path = "/home/chacker/.gemini/antigravity/brain/31af0f52-6884-42c5-bd76-329b3559cd0d"
    vibe_img = f"{base_path}/starbuilders_enhanced_vibe_1767135852882.png"
    villagers_gs = f"{base_path}/starbuilders_villagers_sprite_1767135874753.png"
    lantern_gs = f"{base_path}/starbuilders_lantern_sprite_1767135892759.png"
    background_img = f"{base_path}/starbuilders_background_lake_sky_1767135912592.png"

    # --- Starbuilders (Charcoal) ---
    bg_charcoal = f"{base_path}/starbuild_bg_charcoal_sketch_1767139596099.png"
    lantern_charcoal = f"{base_path}/starbuild_lantern_charcoal_sketch_1767139608283.png"
    watching_charcoal = f"{base_path}/starbuild_villager_watching_charcoal_sketch_1767139621513.png"
    sitting_charcoal = f"{base_path}/starbuild_villager_sitting_charcoal_sketch_1767139637257.png"
    releasing_charcoal = (
        f"{base_path}/starbuild_villager_releasing_charcoal_sketch_1767139668225.png"
    )

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
