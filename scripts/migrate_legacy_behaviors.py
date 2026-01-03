#!/usr/bin/env python3
"""
Migrate legacy scene layer fields to the behavior system.

Legacy fields:
- frequency + amplitude_y -> OscillateBehavior(coordinate="y")
- scroll_speed -> BackgroundBehavior(scroll_speed=X)

Usage:
    python scripts/migrate_legacy_behaviors.py [--dry-run]
"""

import argparse
import json
from pathlib import Path


def migrate_layer(layer: dict) -> tuple[dict, list[str]]:
    """
    Migrate legacy fields on a layer to behaviors.
    Returns (updated_layer, list_of_changes).
    """
    changes = []
    behaviors = list(layer.get("behaviors", []))

    # Migrate frequency + amplitude_y -> OscillateBehavior
    frequency = layer.get("frequency")
    amplitude_y = layer.get("amplitude_y")

    if frequency is not None and amplitude_y is not None:
        # Check if oscillate behavior already exists for Y
        has_y_oscillate = any(
            b.get("type") == "oscillate" and b.get("coordinate") == "y" for b in behaviors
        )
        if not has_y_oscillate:
            behaviors.append(
                {
                    "type": "oscillate",
                    "coordinate": "y",
                    "frequency": frequency,
                    "amplitude": amplitude_y,
                    "phase_offset": 0.0,
                    "enabled": True,
                }
            )
            changes.append(f"Added OscillateBehavior(y, freq={frequency}, amp={amplitude_y})")

    # Migrate scroll_speed -> BackgroundBehavior
    scroll_speed = layer.get("scroll_speed")
    if scroll_speed is not None:
        has_background = any(b.get("type") == "background" for b in behaviors)
        if not has_background:
            behaviors.append({"type": "background", "scroll_speed": scroll_speed, "enabled": True})
            changes.append(f"Added BackgroundBehavior(scroll_speed={scroll_speed})")

    # Build cleaned layer (remove legacy fields)
    cleaned = {
        k: v for k, v in layer.items() if k not in ("frequency", "amplitude_y", "scroll_speed")
    }
    cleaned["behaviors"] = behaviors

    return cleaned, changes


def migrate_to_unified_location(layer: dict) -> tuple[dict, list[str]]:
    """
    Convert flat positioning fields to a LocationBehavior.
    Returns (updated_layer, list_of_changes).
    """
    changes = []
    behaviors = list(layer.get("behaviors", []))

    # Check if there's already a LocationBehavior at time_offset=0
    has_initial_location = any(
        b.get("type") == "location" and b.get("time_offset", 0) == 0 for b in behaviors
    )

    if has_initial_location:
        return layer, changes

    # Fields to migrate into LocationBehavior
    flat_fields = ["z_depth", "x_offset", "y_offset", "scale", "vertical_percent"]
    has_flat_fields = any(layer.get(k) is not None for k in flat_fields)

    if not has_flat_fields:
        return layer, changes

    # Build LocationBehavior from flat fields
    location = {"type": "location", "time_offset": 0, "enabled": True, "interpolate": False}

    if layer.get("x_offset") is not None:
        location["x"] = layer["x_offset"]
    if layer.get("y_offset") is not None:
        location["y"] = layer["y_offset"]
    if layer.get("z_depth") is not None:
        location["z_depth"] = layer["z_depth"]
    if layer.get("scale") is not None:
        location["scale"] = layer["scale"]
    if layer.get("vertical_percent") is not None:
        location["vertical_percent"] = layer["vertical_percent"]

    # Insert at beginning
    behaviors.insert(0, location)

    # Build cleaned layer without flat positioning fields
    cleaned = {k: v for k, v in layer.items() if k not in flat_fields and k != "behaviors"}
    cleaned["behaviors"] = behaviors

    changes.append(
        f"Created LocationBehavior(z={location.get('z_depth')}, "
        f"x={location.get('x', 0)}, y={location.get('y', 0)})"
    )

    return cleaned, changes


def load_sprite_behaviors(sprite_name: str, sprites_dir: Path) -> list[dict]:
    """Load behaviors from a sprite's metadata file."""
    sprite_path = sprites_dir / sprite_name / f"{sprite_name}.prompt.json"
    if not sprite_path.exists():
        return []

    with open(sprite_path, "r") as f:
        metadata = json.load(f)

    return metadata.get("behaviors", [])


def migrate_scene(
    scene_path: Path,
    sprites_dir: Path,
    dry_run: bool = False,
    populate: bool = False,
    unified: bool = False,
) -> list[str]:
    """
    Migrate a single scene file.
    If populate=True, also copies sprite default behaviors into empty scene layers.
    If unified=True, converts flat positioning fields to LocationBehavior.
    Returns list of all changes made.
    """
    all_changes = []

    with open(scene_path, "r") as f:
        scene = json.load(f)

    layers = scene.get("layers", [])
    new_layers = []
    modified = False

    # Legacy fields to remove from scene layers
    legacy_layer_fields = ["frequency", "amplitude_y", "scroll_speed"]

    for layer in layers:
        sprite_name = layer.get("sprite_name", "unknown")
        cleaned, changes = migrate_layer(layer)

        # Populate from sprite defaults if behaviors empty and populate mode
        if populate and not cleaned.get("behaviors"):
            sprite_behaviors = load_sprite_behaviors(sprite_name, sprites_dir)
            if sprite_behaviors:
                cleaned["behaviors"] = sprite_behaviors
                changes.append(f"Copied {len(sprite_behaviors)} behaviors from sprite defaults")
                modified = True

        # Clean up legacy null fields from scene layer
        for key in legacy_layer_fields:
            if key in cleaned and cleaned[key] is None:
                del cleaned[key]
                changes.append(f"Removed legacy null field: {key}")
                modified = True

        # Convert flat positioning to unified LocationBehavior
        if unified:
            cleaned, loc_changes = migrate_to_unified_location(cleaned)
            changes.extend(loc_changes)
            if loc_changes:
                modified = True

        new_layers.append(cleaned)
        for change in changes:
            all_changes.append(f"  [{sprite_name}] {change}")

        if changes:
            modified = True

    if modified and not dry_run:
        scene["layers"] = new_layers
        with open(scene_path, "w") as f:
            json.dump(scene, f, indent=2)

    return all_changes


def migrate_sprite_metadata(sprite_path: Path, dry_run: bool = False) -> list[str]:
    """
    Migrate sprite metadata legacy fields to behaviors.
    Returns list of changes made.
    """
    changes = []

    with open(sprite_path, "r") as f:
        metadata = json.load(f)

    behaviors = list(metadata.get("behaviors", []))
    metadata.get("name", sprite_path.parent.name)

    # Legacy fields to behavior mapping
    frequency = metadata.get("frequency")
    amplitude_y = metadata.get("amplitude_y")
    vertical_drift = metadata.get("vertical_drift")
    horizontal_drift = metadata.get("horizontal_drift")
    scale_drift = metadata.get("scale_drift")
    twinkle_amplitude = metadata.get("twinkle_amplitude")
    twinkle_frequency = metadata.get("twinkle_frequency")
    twinkle_min_scale = metadata.get("twinkle_min_scale")
    scale_drift_multiplier = metadata.get("scale_drift_multiplier_after_cap")

    # Oscillate from frequency + amplitude_y
    if frequency and amplitude_y:
        has_y_oscillate = any(
            b.get("type") == "oscillate" and b.get("coordinate") == "y" for b in behaviors
        )
        if not has_y_oscillate:
            behaviors.append(
                {
                    "type": "oscillate",
                    "coordinate": "y",
                    "frequency": frequency,
                    "amplitude": amplitude_y,
                    "phase_offset": 0.0,
                    "enabled": True,
                }
            )
            changes.append(f"Added OscillateBehavior(y, freq={frequency}, amp={amplitude_y})")

    # Drift behaviors
    if vertical_drift and vertical_drift != 0:
        has_y_drift = any(
            b.get("type") == "drift" and b.get("coordinate") == "y" for b in behaviors
        )
        if not has_y_drift:
            drift_cfg = {
                "type": "drift",
                "coordinate": "y",
                "velocity": vertical_drift,
                "enabled": True,
            }
            if metadata.get("drift_cap_y"):
                drift_cfg["drift_cap"] = metadata["drift_cap_y"]
                drift_cfg["cap_behavior"] = "stop"
            behaviors.append(drift_cfg)
            changes.append(f"Added DriftBehavior(y, velocity={vertical_drift})")

    if horizontal_drift and horizontal_drift != 0:
        has_x_drift = any(
            b.get("type") == "drift" and b.get("coordinate") == "x" for b in behaviors
        )
        if not has_x_drift:
            behaviors.append(
                {"type": "drift", "coordinate": "x", "velocity": horizontal_drift, "enabled": True}
            )
            changes.append(f"Added DriftBehavior(x, velocity={horizontal_drift})")

    if scale_drift and scale_drift != 0:
        has_scale_drift = any(
            b.get("type") == "drift" and b.get("coordinate") == "scale" for b in behaviors
        )
        if not has_scale_drift:
            drift_cfg = {
                "type": "drift",
                "coordinate": "scale",
                "velocity": scale_drift,
                "enabled": True,
            }
            if scale_drift_multiplier:
                drift_cfg["scale_drift_multiplier_after_cap"] = scale_drift_multiplier
            behaviors.append(drift_cfg)
            changes.append(f"Added DriftBehavior(scale, velocity={scale_drift})")

    # Twinkle -> Pulse
    if twinkle_amplitude and twinkle_frequency and twinkle_amplitude != 0:
        has_pulse = any(b.get("type") == "pulse" for b in behaviors)
        if not has_pulse:
            pulse_cfg = {
                "type": "pulse",
                "coordinate": "opacity",
                "frequency": twinkle_frequency,
                "min_value": 1.0 - twinkle_amplitude,
                "max_value": 1.0,
                "waveform": "sine",
                "enabled": True,
            }
            if twinkle_min_scale:
                pulse_cfg["activation_threshold_scale"] = twinkle_min_scale
            behaviors.append(pulse_cfg)
            changes.append(f"Added PulseBehavior(opacity, freq={twinkle_frequency})")

    if changes and not dry_run:
        # Remove legacy fields
        legacy_keys = [
            "frequency",
            "amplitude_y",
            "vertical_drift",
            "horizontal_drift",
            "scale_drift",
            "twinkle_amplitude",
            "twinkle_frequency",
            "twinkle_min_scale",
            "scale_drift_multiplier_after_cap",
            "drift_cap_y",
        ]
        cleaned = {k: v for k, v in metadata.items() if k not in legacy_keys}
        cleaned["behaviors"] = behaviors

        with open(sprite_path, "w") as f:
            json.dump(cleaned, f, indent=2)

    return changes


def main():
    parser = argparse.ArgumentParser(description="Migrate legacy scene/sprite fields to behaviors")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without writing")
    parser.add_argument("--sprites-only", action="store_true", help="Only migrate sprite metadata")
    parser.add_argument("--scenes-only", action="store_true", help="Only migrate scene layers")
    parser.add_argument(
        "--populate",
        action="store_true",
        help="Copy sprite default behaviors into empty scene layers",
    )
    parser.add_argument(
        "--unified",
        action="store_true",
        help="Convert flat positioning fields (z_depth, offsets, scale) to LocationBehavior",
    )
    args = parser.parse_args()

    total_changes = 0
    sprites_dir = Path("assets/sprites")

    # Migrate scenes
    if not args.sprites_only:
        scenes_dir = Path("assets/scenes")
        if scenes_dir.exists():
            scene_files = list(scenes_dir.glob("*/scene.json"))
            print(f"Found {len(scene_files)} scene files")

            for scene_path in scene_files:
                changes = migrate_scene(
                    scene_path,
                    sprites_dir,
                    dry_run=args.dry_run,
                    populate=args.populate,
                    unified=args.unified,
                )
                if changes:
                    print(f"\n{scene_path.parent.name}/scene.json:")
                    for change in changes:
                        print(change)
                    total_changes += len(changes)

    # Migrate sprite metadata
    if not args.scenes_only:
        sprites_dir = Path("assets/sprites")
        if sprites_dir.exists():
            sprite_files = list(sprites_dir.glob("*/*.prompt.json"))
            print(f"\nFound {len(sprite_files)} sprite metadata files")

            for sprite_path in sprite_files:
                changes = migrate_sprite_metadata(sprite_path, dry_run=args.dry_run)
                if changes:
                    print(f"\n{sprite_path.parent.name}:")
                    for change in changes:
                        print(f"  {change}")
                    total_changes += len(changes)

    print(f"\n{'Would make' if args.dry_run else 'Made'} {total_changes} changes")
    if args.dry_run and total_changes > 0:
        print("Run without --dry-run to apply changes")

    return 0


if __name__ == "__main__":
    exit(main())
