#!/usr/bin/env python3
"""
Scene Migration Script: Legacy Fields → Behavior System

⚠️ ONE-TIME MIGRATION - COMPLETED 2026-01-01
This script was used to migrate all scenes from legacy field format to the new
behavior system. It is kept for historical reference and documentation purposes.

All scenes have been migrated. This script should only be run again if:
- You restore old scene files from backups
- You create new scenes using the old format
- You need to understand the migration logic

Original migration created backups in:
/assets/scenes/.backups/20260101_230830/

Usage:
    python scripts/migrate_scenes_to_behaviors.py [--dry-run]
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict


def create_backup(scene_path: Path, backup_dir: Path) -> None:
    """Create a timestamped backup of the scene file."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / scene_path.name
    shutil.copy2(scene_path, backup_path)
    print(f"  ✓ Backed up to: {backup_path}")


def migrate_layer_to_behaviors(layer: Dict[str, Any]) -> Dict[str, Any]:
    """Convert legacy fields in a layer to behaviors."""
    behaviors = layer.get("behaviors", [])

    # Migrate scroll_speed
    scroll_speed = layer.get("scroll_speed")
    if scroll_speed is not None:
        # Check if already has a background or drift behavior
        has_scroll_behavior = any(b.get("type") in ["background", "drift"] for b in behaviors)

        if not has_scroll_behavior:
            if scroll_speed == 0.0:
                # Static background
                behaviors.append(
                    {"type": "background", "enabled": True, "scroll_speed": 0.0, "coordinate": "y"}
                )
            else:
                # Scrolling layer - use drift on X coordinate
                behaviors.append(
                    {
                        "type": "drift",
                        "enabled": True,
                        "velocity": scroll_speed,
                        "coordinate": "x",
                        "acceleration": 0.0,
                        "drift_cap": None,
                        "cap_behavior": "stop",
                    }
                )

        # Remove legacy field
        del layer["scroll_speed"]

    # Migrate frequency + amplitude_y (oscillation)
    frequency = layer.get("frequency")
    amplitude_y = layer.get("amplitude_y")

    if frequency is not None and amplitude_y is not None:
        has_oscillate = any(
            b.get("type") == "oscillate" and b.get("coordinate") == "y" for b in behaviors
        )

        if not has_oscillate:
            behaviors.append(
                {
                    "type": "oscillate",
                    "enabled": True,
                    "frequency": frequency,
                    "amplitude": amplitude_y,
                    "coordinate": "y",
                    "phase_offset": 0.0,
                }
            )

        # Remove legacy fields
        if "frequency" in layer:
            del layer["frequency"]
        if "amplitude_y" in layer:
            del layer["amplitude_y"]

    # Migrate events → behaviors
    events = layer.get("events", [])
    if events and not behaviors:
        behaviors = events

    if "events" in layer:
        del layer["events"]

    # Update behaviors
    if behaviors:
        layer["behaviors"] = behaviors

    return layer


def migrate_scene(scene_path: Path, dry_run: bool = False) -> Dict[str, Any]:
    """Migrate a single scene file."""
    print(f"\n📄 Processing: {scene_path}")

    with open(scene_path, "r") as f:
        scene_data = json.load(f)

    # Track changes
    changes = []

    # Migrate each layer
    if "layers" in scene_data:
        for i, layer in enumerate(scene_data["layers"]):
            original = json.dumps(layer, sort_keys=True)
            migrated = migrate_layer_to_behaviors(layer)

            if json.dumps(migrated, sort_keys=True) != original:
                sprite_name = layer.get("sprite_name", f"layer_{i}")
                changes.append(f"  - {sprite_name}: Migrated legacy fields to behaviors")

    if changes:
        print("  📝 Changes:")
        for change in changes:
            print(change)

        if not dry_run:
            # Write back to file
            with open(scene_path, "w") as f:
                json.dump(scene_data, f, indent=2)
            print("  ✅ Migrated successfully")
    else:
        print("  ⏭️  No migration needed (already using behaviors)")

    return scene_data


def main():
    import sys

    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified\n")

    # Find all scene files
    project_root = Path(__file__).parent.parent
    scenes_dir = project_root / "assets" / "scenes"
    scene_files = list(scenes_dir.glob("*/scene.json"))

    if not scene_files:
        print("❌ No scene files found!")
        return

    print(f"Found {len(scene_files)} scene(s) to migrate:\n")

    # Create backup directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = scenes_dir / ".backups" / timestamp

    if not dry_run:
        backup_dir.mkdir(parents=True, exist_ok=True)
        print(f"📦 Backup directory: {backup_dir}\n")

    # Migrate each scene
    migrated_count = 0
    for scene_path in sorted(scene_files):
        try:
            if not dry_run:
                create_backup(scene_path, backup_dir)

            migrate_scene(scene_path, dry_run=dry_run)
            migrated_count += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")

    # Summary
    print(f"\n{'=' * 60}")
    print("✅ Migration complete!")
    print(f"   Processed: {migrated_count}/{len(scene_files)} scenes")
    if not dry_run:
        print(f"   Backups: {backup_dir}")
    print(f"{'=' * 60}\n")

    if dry_run:
        print("ℹ️  Run without --dry-run to apply changes")


if __name__ == "__main__":
    main()
