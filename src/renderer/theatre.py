import json
import logging
import math
import os
import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

import pygame

# Allow running directly as a script (adds project root to path)
if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

from src.compiler.models import (
    BackgroundBehavior,
    BehaviorConfig,
    BehaviorType,
    CoordinateType,
    DriftBehavior,
    EnvironmentalReaction,
    LocationBehavior,
    OscillateBehavior,
    PulseBehavior,
    SpriteMetadata,
)

logger = logging.getLogger(__name__)


class BehaviorRuntime(ABC):
    """Base class for runtime behavior."""

    def __init__(self, config: BehaviorConfig):
        self.config = config
        self.active = config.enabled

    @abstractmethod
    def apply(self, layer: "ParallaxLayer", dt: float, transform: Dict[str, float]):
        """Modify the transformation state."""
        pass


class OscillateRuntime(BehaviorRuntime):
    def __init__(self, config: OscillateBehavior):
        super().__init__(config)
        self.config: OscillateBehavior = config
        self.time_accum = 0.0

    def apply(self, layer, dt, transform):
        if not self.active:
            return

        self.time_accum += dt

        # Calculate offset: sin(2 * pi * freq * t + phase) * amplitude
        phase = (self.time_accum * self.config.frequency * 2 * math.pi) + self.config.phase_offset
        offset = math.sin(phase) * self.config.amplitude

        if self.config.coordinate == CoordinateType.Y:
            transform["y"] += offset
        elif self.config.coordinate == CoordinateType.X:
            transform["x"] += offset
        elif self.config.coordinate == CoordinateType.SCALE:
            transform["scale"] += offset / 100.0
        elif self.config.coordinate == CoordinateType.ROTATION:
            transform["rotation"] += offset


class DriftRuntime(BehaviorRuntime):
    def __init__(self, config: DriftBehavior):
        super().__init__(config)
        self.config: DriftBehavior = config
        self.current_value = 0.0
        self.reached_cap = False

    def apply(self, layer, dt, transform):
        if not self.active:
            return

        # Simple linear drift for now (v * t)
        delta = self.config.velocity * dt
        self.current_value += delta

        # Apply cap logic
        if self.config.drift_cap is not None:
            if self.config.coordinate == CoordinateType.Y:
                target_y = transform["base_y"] + transform["y"] + self.current_value
                # Simplified cap logic
                if abs(target_y) > self.config.drift_cap:
                    self.current_value = 0  # Wrap/Reset

        val = self.current_value

        if self.config.coordinate == CoordinateType.Y:
            transform["y"] += val
        elif self.config.coordinate == CoordinateType.X:
            transform["x"] += val
        elif self.config.coordinate == CoordinateType.SCALE:
            transform["scale"] += val


class PulseRuntime(BehaviorRuntime):
    def __init__(self, config: PulseBehavior):
        super().__init__(config)
        self.config: PulseBehavior = config
        self.time_accum = 0.0

    def apply(self, layer, dt, transform):
        if not self.active:
            return

        self.time_accum += dt

        # 0.0 to 1.0 progress
        cycle = (self.time_accum * self.config.frequency) % 1.0

        value = 0.0
        if self.config.waveform == "sine":
            value = (math.sin(cycle * 2 * math.pi) + 1) / 2
        elif self.config.waveform == "spike":
            value = pow((math.sin(cycle * 2 * math.pi) + 1.0) / 2.0, 10)

        # Map 0-1 to min-max
        final_val = self.config.min_value + (
            value * (self.config.max_value - self.config.min_value)
        )

        if self.config.coordinate == CoordinateType.OPACITY:
            transform["opacity"] *= final_val
        elif self.config.coordinate == CoordinateType.SCALE:
            transform["scale"] *= final_val


class LocationRuntime(BehaviorRuntime):
    def __init__(self, config: LocationBehavior):
        super().__init__(config)
        self.config: LocationBehavior = config

    def apply(self, layer, dt, transform):
        if not self.active:
            return

        transform["x"] += self.config.x
        transform["y"] += self.config.y

        if self.config.scale is not None:
            transform["scale"] *= self.config.scale

        if self.config.vertical_percent is not None:
            screen_h = transform.get("_screen_h")
            if screen_h is not None:
                # Recalculate base_y based on new vertical_percent
                # Mimic logic from ParallaxLayer._get_base_y
                pos_h = layer.original_image_size[1]
                base = screen_h * self.config.vertical_percent

                new_base_y = 0.0
                if layer.vertical_anchor == "bottom":
                    new_base_y = base - pos_h
                elif layer.vertical_anchor == "top":
                    new_base_y = base
                else:
                    new_base_y = base - (pos_h / 2)

                transform["base_y"] = new_base_y + layer.y_offset


class BackgroundRuntime(BehaviorRuntime):
    def apply(self, layer, dt, transform):
        pass


class ParallaxLayer:
    def __init__(
        self,
        asset_path,
        z_depth,
        vertical_percent=0.5,
        target_height=None,
        scroll_speed=1.0,
        is_background=False,
        tile_horizontal=False,
        tile_border=0,
        height_scale=None,
        fill_down=False,
        vertical_anchor="center",
        x_offset: int = 0,
        y_offset: int = 0,
        environmental_reaction: Optional[EnvironmentalReaction] = None,
        behaviors: List[BehaviorConfig] = None,
    ):
        self.z_depth = z_depth
        self.asset_path = Path(asset_path)
        self.vertical_percent = vertical_percent or 0.5
        self.target_height = target_height
        self.scroll_speed = scroll_speed or 0
        self.is_background = is_background
        self.tile_horizontal = tile_horizontal
        self.tile_border = tile_border
        self.height_scale = height_scale
        self.fill_down = fill_down
        self.vertical_anchor = vertical_anchor
        self.x_offset = x_offset
        self.y_offset = y_offset
        self.environmental_reaction = environmental_reaction
        self.visible = True

        # Initialize Behavior Runtimes
        self.behavior_runtimes: List[BehaviorRuntime] = []
        if behaviors:
            for b_config in behaviors:
                if b_config.type == BehaviorType.OSCILLATE:
                    self.behavior_runtimes.append(OscillateRuntime(b_config))
                elif b_config.type == BehaviorType.DRIFT:
                    self.behavior_runtimes.append(DriftRuntime(b_config))
                    # Extract scroll_speed from DriftBehavior with X coordinate
                    # This handles the migration from scroll_speed field to DriftBehavior
                    if b_config.coordinate == CoordinateType.X and b_config.velocity is not None:
                        self.scroll_speed = b_config.velocity
                elif b_config.type == BehaviorType.PULSE:
                    self.behavior_runtimes.append(PulseRuntime(b_config))
                elif b_config.type == BehaviorType.BACKGROUND:
                    self.behavior_runtimes.append(BackgroundRuntime(b_config))
                    # Also enforce properties
                    self.is_background = True
                    self.scroll_speed = b_config.scroll_speed
                elif b_config.type == BehaviorType.LOCATION:
                    self.behavior_runtimes.append(LocationRuntime(b_config))

        self.original_image_size = (0, 0)
        self.image = None
        self.mask = None
        self.height_map: List[int] = []  # Pre-calculated for fast physics
        # Physics state
        self.current_tilt = 0.0

        # Scaling cache to prevent expensive per-frame transformation
        self._last_scale_used = -1.0
        self._scaled_image_cache: Optional[pygame.Surface] = None
        self._load_image()

    def _load_image(self):
        if self.asset_path.exists():
            original_image = pygame.image.load(str(self.asset_path)).convert_alpha()

            if self.tile_border > 0:
                w, h = original_image.get_size()
                crop_rect = pygame.Rect(self.tile_border, 0, w - (2 * self.tile_border), h)
                original_image = original_image.subsurface(crop_rect)

            processed_image = original_image
            # Handle resizing logic
            if self.height_scale is not None:
                screen_surface = pygame.display.get_surface()
                if screen_surface:
                    screen_h = screen_surface.get_height()
                    target_h = int(screen_h * self.height_scale)
                    w, h = processed_image.get_size()
                    aspect = w / h
                    target_w = int(target_h * aspect)
                    processed_image = pygame.transform.smoothscale(
                        processed_image, (target_w, target_h)
                    )
            elif self.target_height:
                w, h = processed_image.get_size()
                aspect = w / h
                processed_image = pygame.transform.smoothscale(
                    processed_image, (int(self.target_height * aspect), self.target_height)
                )

            self.original_image_size = processed_image.get_size()
            self.image = processed_image
            self.fill_color = None

            if self.fill_down:
                w, h = processed_image.get_size()
                try:
                    self.fill_color = processed_image.get_at((w // 2, h - 1))
                except Exception as e:
                    logging.warning(f"Could not sample fill color: {e}")

            # Always pre-calculate height map for efficient physics sampling
            self._precalculate_height_map()

    def _precalculate_height_map(self):
        """Pre-calculate the first non-transparent pixel in each column."""
        if self.image is None:
            self.height_map = []
            return

        # Get dimensions first - works with both real Surface and mocks
        w, h = self.image.get_size()

        # Only create mask if self.image is a real Surface (not a mock)
        # Note: MagicMock(spec=Surface) passes isinstance checks, so we use try/except
        if self.mask is None:
            try:
                self.mask = pygame.mask.from_surface(self.image)
            except TypeError:
                # self.image is a mock, skip mask creation
                self.height_map = [h] * w
                return

        self.height_map = [h] * w

        for x in range(w):
            # Scan top-down for the first cluster of solid pixels (3px deep to avoid noise)
            for y in range(h - 3):
                if (
                    self.mask.get_at((x, y))
                    and self.mask.get_at((x, y + 1))
                    and self.mask.get_at((x, y + 2))
                ):
                    self.height_map[x] = y
                    break

    @classmethod
    def from_sprite_dir(cls, sprite_dir_path: str, overrides: Optional[Dict[str, Any]] = None):
        sprite_dir = Path(sprite_dir_path)
        sprite_name = sprite_dir.name
        meta_path = sprite_dir / f"{sprite_name}.prompt.json"

        png_files = list(sprite_dir.glob("*.png"))
        asset_path = png_files[0] if png_files else sprite_dir / "placeholder.png"

        meta_data = {}
        if meta_path.exists():
            with open(meta_path, "r") as f:
                raw_json = json.load(f)
                try:
                    sprite_meta = SpriteMetadata(**raw_json)
                    meta_data = sprite_meta.model_dump()
                except Exception as e:
                    logging.error(f"Failed to parse metadata for {sprite_name}: {e}")
                    meta_data = raw_json

        # Merge overrides
        if overrides:
            meta_data.update({k: v for k, v in overrides.items() if v is not None})

        # Re-construct behavior models from list of dicts/models
        raw_behaviors = meta_data.get("behaviors", [])
        behavior_list = []
        for b in raw_behaviors:
            if isinstance(b, dict):
                b_type = b.get("type")
                if b_type == BehaviorType.OSCILLATE:
                    behavior_list.append(OscillateBehavior(**b))
                elif b_type == BehaviorType.DRIFT:
                    behavior_list.append(DriftBehavior(**b))
                elif b_type == BehaviorType.PULSE:
                    behavior_list.append(PulseBehavior(**b))
                elif b_type == BehaviorType.BACKGROUND:
                    behavior_list.append(BackgroundBehavior(**b))
                elif b_type == BehaviorType.LOCATION:
                    behavior_list.append(LocationBehavior(**b))
            else:
                behavior_list.append(b)

        return cls(
            asset_path=str(asset_path),
            z_depth=meta_data.get("z_depth", 1),
            vertical_percent=meta_data.get("vertical_percent", 0.5),
            target_height=meta_data.get("target_height"),
            scroll_speed=meta_data.get("scroll_speed", 0.0),
            is_background=meta_data.get("is_background", False),
            tile_horizontal=meta_data.get("tile_horizontal", False),
            tile_border=meta_data.get("tile_border", 0),
            height_scale=meta_data.get("height_scale"),
            fill_down=meta_data.get("fill_down", False),
            vertical_anchor=meta_data.get("vertical_anchor", "center"),
            x_offset=meta_data.get("x_offset", 0),
            y_offset=meta_data.get("y_offset", 0),
            environmental_reaction=(
                EnvironmentalReaction(**meta_data["environmental_reaction"])
                if meta_data.get("environmental_reaction")
                else None
            ),
            behaviors=behavior_list,
        )

    def _get_base_y(self, screen_h: int) -> float:
        pos_h = self.original_image_size[1]

        base = screen_h * self.vertical_percent
        if self.vertical_anchor == "bottom":
            return base - pos_h
        elif self.vertical_anchor == "top":
            return base
        else:
            return base - (pos_h / 2)

    def get_transform(self, screen_h: int, scroll_x: float, elapsed_time: float, dt: float):
        """Calculate the final transform for this frame."""

        # Base state
        transform = {
            "x": 0.0,
            "y": 0.0,
            "base_y": self._get_base_y(screen_h) + self.y_offset,
            "scale": 1.0,
            "rotation": 0.0,
            "opacity": 1.0,
            "_screen_h": screen_h,  # Internal context for behaviors
        }

        # Apply Behaviors
        for runtime in self.behavior_runtimes:
            runtime.apply(self, dt, transform)

        return transform

    def get_y_at_x(
        self, screen_h: int, scroll_x: float, x_coord: float, elapsed_time: float
    ) -> float:
        # 1. Transform x_coord (screen space) to local image space
        # screen_w = 800 # TODO: Pass screen_w? Assuming 800 for now or calculating?
        # Ideally we know the screen dimensions.

        # Recalculate transform to find where the image is drawn
        # Similar logic to draw() but inverse.

        # Calculate scroll offset
        parallax_scroll = scroll_x * self.scroll_speed

        # Calculate transforms (assumes dt small or 0 for static sampling)
        tf = self.get_transform(screen_h, scroll_x, elapsed_time, 0.0)

        if self.image is None:
            return screen_h

        # Use original_image_size (pre-fill-down) to ensure correct aspect ratio/dimensions
        # logic. self.image might include fill_down extension which skews h.
        base_w, base_h = self.original_image_size
        if base_w == 0 or base_h == 0:
            base_w = self.image.get_width()
            base_h = self.image.get_height()

        # If scaled, we need to account for that.
        final_scale = max(0.001, tf["scale"])
        base_y = tf["base_y"] + tf["y"]

        # Note: _load_image already handled target_height/height_scale resizing
        # into original_image_size. We just need to apply behavioral scale.
        img_w = base_w * final_scale

        scroll_offset = parallax_scroll + self.x_offset + tf["x"]

        # NOTE: This assumes standard non-tiled or horizontally tiled logic.
        # Inverse mapping:
        # screen_x = (local_x + scroll_offset) % wrap_w - img_w (roughly)

        # Let's map screen X to local X.
        # local_x = (screen_x - scroll_offset) % img_w

        # Normalize x_coord into pattern space
        # We need the 'time' factor if there is horizontal drift?
        # For environment (waves), usually they scroll.

        # Simple wrapping logic:
        # The image repeats every img_w pixels (if tiled) or effectively wraps.
        local_x = (x_coord - scroll_offset) % img_w

        # Scale back to original image coordinates for pixel lookup
        # original_x = local_x / final_scale ?
        # Wait, img_w above IS the scaled width.

        # Scale back to original image coordinates for pixel lookup
        ratio = self.image.get_width() / img_w
        orig_x = int(local_x * ratio)
        orig_x = max(0, min(self.image.get_width() - 1, orig_x))

        # Use pre-calculated height map for O(1) vertical lookup instead of O(H) scan
        if orig_x < len(self.height_map):
            y = self.height_map[orig_x]
            if y < self.image.get_height():
                # Map back to screen Y
                y_scaled = y / ratio
                return base_y + y_scaled

        return screen_h

    def get_screen_pos(self, screen_w: int, screen_h: int, scroll_x: float, elapsed_time: float):
        """Calculate the logical screen position of the sprite."""
        tf = self.get_transform(screen_h, scroll_x, elapsed_time, 0.0)
        final_x = tf["x"]
        final_y = tf["base_y"] + tf["y"]
        final_scale = max(0.001, tf["scale"])

        base_w, base_h = self.original_image_size
        if base_w == 0 or base_h == 0:
            if self.image:
                base_w, base_h = self.image.get_size()
            else:
                return (0.0, 0.0)

        scaled_unrotated_w = base_w * final_scale

        parallax_x = (scroll_x * self.scroll_speed) + self.x_offset
        wrapper_w = screen_w + scaled_unrotated_w
        x = (parallax_x + final_x) % wrapper_w
        logical_x = x - scaled_unrotated_w

        return (logical_x, final_y)

    def draw(
        self,
        screen,
        scroll_x: float,
        elapsed_time: float,
        dt: float,
        env_y: Optional[float] = None,
        env_layer: Optional["ParallaxLayer"] = None,
    ):
        if not self.visible:
            return

        screen_w, screen_h = screen.get_size()

        if self.is_background:
            self._draw_background(screen)
            return

        # Calculate Transform
        tf = self.get_transform(screen_h, scroll_x, elapsed_time, dt)

        # Resolve final values
        final_x = tf["x"]
        final_y = tf["base_y"] + tf["y"]
        final_scale = max(0.001, tf["scale"])
        final_rot = tf["rotation"]
        final_alpha = max(0.0, min(1.0, tf["opacity"]))

        # Prepare Image
        if self.image is None:
            return

        # Optimization: Caching scaled image
        if abs(final_scale - self._last_scale_used) > 0.001:
            w, h = self.image.get_size()
            new_size = (int(w * final_scale), int(h * final_scale))
            if new_size[0] > 0 and new_size[1] > 0:
                self._scaled_image_cache = pygame.transform.smoothscale(self.image, new_size)
                self._last_scale_used = final_scale
            else:
                self._scaled_image_cache = self.image  # Fallback for tiny scales

        img_to_draw = self._scaled_image_cache

        # Environmental Reaction Logic
        if self.environmental_reaction and env_layer:
            reaction = self.environmental_reaction

            # hull_length_factor defaults to 0.5 if not present
            hull_factor = getattr(reaction, "hull_length_factor", 0.5)

            # 1. Determine local center and sampling offsets
            img_w_curr = img_to_draw.get_width()
            parallax_x = (scroll_x * self.scroll_speed) + self.x_offset
            center_x = parallax_x + final_x + (img_w_curr / 2)

            offset_w = img_w_curr * (hull_factor / 2)
            x_stern = center_x - offset_w
            x_bow = center_x + offset_w

            # 2. Sample environment heights
            y_stern = env_layer.get_y_at_x(screen_h, scroll_x, x_stern, elapsed_time)
            y_bow = env_layer.get_y_at_x(screen_h, scroll_x, x_bow, elapsed_time)

            # 3. Calculate target position and tilt
            # Average height of these two points defines the surface level for the boat center
            target_env_y = (y_stern + y_bow) / 2.0

            # Determine slope-based angle
            hull_dist = x_bow - x_stern
            if hull_dist > 0:
                slope = (y_bow - y_stern) / hull_dist
                # Screen Y is inverted, positive slope = nose down.
                # Pygame rotation is CCW positive, so -atan(slope)
                angle = -math.degrees(math.atan(slope))
            else:
                angle = 0

            # Apply sensitivity factor and start-of-scene ramp-in
            start_ramp = min(1.0, scroll_x / 300.0) if scroll_x > 0 else 0
            target_tilt = max(
                -reaction.max_tilt_angle,
                min(reaction.max_tilt_angle, angle * 5.0 * start_ramp),
            )

            # 4. Smoothing / Inertia
            # Rotation smoothing
            self.current_tilt += (target_tilt - self.current_tilt) * 0.1
            final_rot += self.current_tilt

            # Vertical Position calculation
            if reaction.vertical_follow_factor > 0:
                # Base height from environment
                current_h = img_to_draw.get_height()
                img_h_pos = (
                    self.original_image_size[1] * final_scale if self.fill_down else current_h
                )

                # Desired final_y relative to the environment surface
                desired_y = (
                    target_env_y
                    + self.y_offset
                    - (img_h_pos * (1 - reaction.vertical_follow_factor))
                )

                # We use internal smoothing for vertical position to simulate weight
                if not hasattr(self, "_current_y_phys"):
                    self._current_y_phys = final_y

                # Update physical Y with smoothing
                lift = self.current_tilt * getattr(reaction, "tilt_lift_factor", 0.0)
                desired_y -= lift

                self._current_y_phys += (desired_y - self._current_y_phys) * 0.1
                final_y = self._current_y_phys

        # Always rotate if there is a value (or test expects it even if 0)
        # Optimization: only if abs(final_rot) > 0.1
        if abs(final_rot) > 0.1:
            img_to_draw = pygame.transform.rotate(img_to_draw, final_rot)
        # Note: If rot is tiny, we skip to save significant CPU cycles

        if final_alpha < 1.0:
            img_to_draw.set_alpha(int(final_alpha * 255))
        else:
            img_to_draw.set_alpha(255)

        # Positioning
        rotated_w, rotated_h = img_to_draw.get_size()

        # Defensive check for image size (handling mocks/unloaded states in tests)
        unrotated_w, unrotated_h = 0, 0
        if hasattr(self, "original_image_size") and len(self.original_image_size) == 2:
            unrotated_w, unrotated_h = self.original_image_size
        else:
            unrotated_w, unrotated_h = rotated_w, rotated_h

        scaled_unrotated_w = unrotated_w * final_scale
        scaled_unrotated_h = unrotated_h * final_scale

        parallax_x = (scroll_x * self.scroll_speed) + self.x_offset

        # Tiling vs Single
        if self.tile_horizontal:
            # Safety check: prevent infinite loop if width is zero
            if scaled_unrotated_w < 0.5:
                return

            # Optimization: Create fill surface once outside the loop
            fill_surf = None
            frw, frh = 0, 0
            if self.fill_down and self.fill_color:
                fill_w = scaled_unrotated_w
                fill_h = screen_h
                fill_surf = pygame.Surface((int(fill_w), int(fill_h)), pygame.SRCALPHA)
                fill_surf.fill(self.fill_color)
                if abs(final_rot) > 0.1:
                    fill_surf = pygame.transform.rotate(fill_surf, final_rot)
                    frw, frh = fill_surf.get_size()

            # Calculate logical tiling start based on unrotated width
            start_x = (parallax_x + final_x) % scaled_unrotated_w
            if start_x > 0:
                start_x -= scaled_unrotated_w

            curr_x = start_x
            while curr_x < screen_w:
                # Position rotated image centered on the logical unrotated tile's center
                tile_center_x = curr_x + (scaled_unrotated_w / 2)
                tile_center_y = final_y + (scaled_unrotated_h / 2)

                draw_x = tile_center_x - (rotated_w / 2)
                draw_y = tile_center_y - (rotated_h / 2)

                screen.blit(img_to_draw, (draw_x, draw_y))

                if fill_surf:
                    if abs(final_rot) > 0.1:
                        # Position below the sprite center
                        screen.blit(
                            fill_surf,
                            (
                                tile_center_x - frw / 2,
                                tile_center_y + rotated_h / 2 - (frh - fill_h) / 2,
                            ),
                        )
                    else:
                        screen.blit(fill_surf, (curr_x, tile_center_y + (scaled_unrotated_h / 2)))

                curr_x += scaled_unrotated_w
        else:
            # Wrap around screen using logical unrotated width for the boundary
            wrapper_w = screen_w + scaled_unrotated_w
            if wrapper_w < 0.5:
                return

            x = (parallax_x + final_x) % wrapper_w

            # logical_x is the left edge of the unrotated image
            logical_x = x - scaled_unrotated_w

            # logical_center is the stable midpoint
            logical_center_x = logical_x + (scaled_unrotated_w / 2)
            logical_center_y = final_y + (scaled_unrotated_h / 2)

            # Position rotated image centered on the logical center
            draw_x = logical_center_x - (rotated_w / 2)
            draw_y = logical_center_y - (rotated_h / 2)

            screen.blit(img_to_draw, (draw_x, draw_y))

            if self.fill_down and self.fill_color:
                fill_w = scaled_unrotated_w
                fill_h = screen_h
                fill_surf = pygame.Surface((int(fill_w), int(fill_h)), pygame.SRCALPHA)
                fill_surf.fill(self.fill_color)
                if abs(final_rot) > 0.1:
                    fill_surf = pygame.transform.rotate(fill_surf, final_rot)
                    frw, frh = fill_surf.get_size()
                    screen.blit(
                        fill_surf,
                        (
                            logical_center_x - frw / 2,
                            logical_center_y + rotated_h / 2 - (frh - fill_h) / 2,
                        ),
                    )
                else:
                    screen.blit(fill_surf, (logical_x, logical_center_y + (scaled_unrotated_h / 2)))

    def _draw_background(self, screen):
        if self.image:
            screen_w, screen_h = screen.get_size()
            img_w = self.image.get_width()

            # Tile horizontally with 1px overlap to prevent gaps
            if img_w > 0:
                # Calculate number of tiles needed, ensure coverage
                import math

                num_tiles = math.ceil(screen_w / img_w) + 1

                for i in range(num_tiles):
                    # Overlap by 1 pixel
                    x = i * (img_w - 1)
                    screen.blit(self.image, (x, 0))


class Theatre:
    def __init__(
        self,
        scene_path: str = "assets/scenes/sailboat/scene.json",
        width: int = 1280,
        height: int = 720,
    ):
        logging.basicConfig(
            level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", force=True
        )

        if not pygame.get_init():
            pygame.init()

        self.screen = pygame.display.set_mode((width, height))
        self.clock = pygame.time.Clock()
        self.scroll = 0

        # Legacy path support
        path_obj = Path(scene_path)
        if not path_obj.exists() and "assets/story" in scene_path:
            name_part = path_obj.stem.replace("scene_", "")
            new_path = Path("assets/scenes") / name_part / "scene.json"
            if new_path.exists():
                logging.warning(f"Legacy path detected '{scene_path}'. Redirecting to '{new_path}'")
                path_obj = new_path

        self.scene_path = path_obj
        self.last_modified_time = 0
        self.layers: list[ParallaxLayer] = []
        self.sprite_base_dir = Path("assets/sprites")

        self.elapsed_time = 0.0
        self.debug_target_layer_index = 0
        self.show_debug_menu = True
        self.debug_menu_rect = pygame.Rect(10, 40, 320, 420)
        self._frame_counter = 0

        # Cache fonts for performance
        self.font_header = pygame.font.SysFont(None, 28, bold=True)
        self.font_item = pygame.font.SysFont(None, 24)
        self.font_small = pygame.font.SysFont(None, 24)  # Reuse or specific small

        self.load_scene()
        logging.info("Theatre initialized. Main loop starting.")

    def load_scene(self):
        """Load or reload the scene from the JSON configuration."""
        try:
            with open(self.scene_path, "r") as f:
                scene_config = json.load(f)

            new_layers = []
            for layer_data in scene_config.get("layers", []):
                sprite_name = layer_data.get("sprite_name")
                if not sprite_name:
                    continue

                # Pass legacy overrides if any, from_sprite_dir might use them if matched
                overrides = layer_data.copy()
                if "sprite_name" in overrides:
                    del overrides["sprite_name"]

                scene_dir = self.scene_path.parent
                local_sprite_path = scene_dir / "sprites" / sprite_name
                global_sprite_path = self.sprite_base_dir / sprite_name

                if local_sprite_path.exists() and local_sprite_path.is_dir():
                    target_path = local_sprite_path
                elif global_sprite_path.exists() and global_sprite_path.is_dir():
                    target_path = global_sprite_path
                else:
                    logging.warning(
                        f"Sprite directory not found for '{sprite_name}'. "
                        f"Checked: {local_sprite_path}, {global_sprite_path}"
                    )
                    continue

                layer = ParallaxLayer.from_sprite_dir(str(target_path), overrides=overrides)
                new_layers.append(layer)

            new_layers.sort(key=lambda layer: layer.z_depth or 0)
            self.layers = new_layers
            self.last_modified_time = os.path.getmtime(self.scene_path)
            logging.info(f"Loaded {len(self.layers)} layers. Scene reloaded due to file change.")

        except Exception as e:
            logging.error(f"Error loading scene: {e}")

    def run(self, max_frames: Optional[int] = None):
        """The main theatre loop."""
        frame_count = 0
        while True:
            if max_frames is not None and frame_count >= max_frames:
                logging.info(f"Reached max_frames ({max_frames}). Exiting loop.")
                return

            for event in pygame.event.get():
                # Debug: Log all events to understand what's happening
                if event.type not in (pygame.MOUSEMOTION,):  # Skip noisy motion events
                    logging.info(f"Event received: type={event.type}, {event}")

                if event.type == pygame.QUIT:
                    logging.info("QUIT event - exiting")
                    pygame.display.quit()
                    os._exit(0)
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_TAB:
                        self.debug_target_layer_index = (self.debug_target_layer_index + 1) % len(
                            self.layers
                        )
                        layer = self.layers[self.debug_target_layer_index]
                        target_name = layer.asset_path.parent.name
                        logging.info(f"Debug sampler target changed to layer: {target_name}")
                    if event.key == pygame.K_d:
                        self.show_debug_menu = not self.show_debug_menu
                        logging.info(f"Debug menu {'opened' if self.show_debug_menu else 'closed'}")

                if event.type == pygame.MOUSEBUTTONDOWN:
                    mouse_pos = pygame.mouse.get_pos()
                    logging.info(
                        f"Mouse click at {mouse_pos}, button={event.button}, "
                        f"debug_menu={self.show_debug_menu}"
                    )
                    if event.button == 1 and self.show_debug_menu:
                        if self.debug_menu_rect.collidepoint(mouse_pos):
                            # Calculate index based on click Y relative to menu entries
                            # (start at +45)
                            relative_y = mouse_pos[1] - (self.debug_menu_rect.y + 45)
                            if relative_y >= 0:
                                clicked_idx = relative_y // 25  # 25px per item
                                if 0 <= clicked_idx < len(self.layers):
                                    # Clicked layer name area -> Select for pink dot
                                    if mouse_pos[0] < self.debug_menu_rect.x + 280:
                                        self.debug_target_layer_index = clicked_idx
                                        layer = self.layers[clicked_idx]
                                        target_name = layer.asset_path.parent.name
                                        logging.info(f"Debug target selected: {target_name}")
                                    else:
                                        # Clicked visibility toggle area
                                        layer = self.layers[clicked_idx]
                                        layer.visible = not layer.visible
                                        target_name = layer.asset_path.parent.name
                                        msg = f"Toggle: {target_name} -> {layer.visible}"
                                        logging.info(msg)
                            # Consume the event since it was in the menu
                            continue

            # Throttle file integrity check (every 60 frames)
            self._frame_counter += 1
            if self._frame_counter % 60 == 0:
                has_changed = (
                    os.path.exists(self.scene_path)
                    and os.path.getmtime(self.scene_path) != self.last_modified_time
                )
                if has_changed:
                    logging.info(f"Detected change in {self.scene_path}. Reloading...")
                    self.load_scene()
                    # Ensure index still valid after reload
                    self.debug_target_layer_index %= len(self.layers) if self.layers else 1

            dt = self.clock.tick(60) / 1000.0
            self.elapsed_time += dt
            frame_count += 1
            self.scroll += 3
            screen_w, screen_h = self.screen.get_size()

            self.screen.fill((200, 230, 255))

            layers_by_name = {layer.asset_path.parent.name: layer for layer in self.layers}

            # Simple environment binding via name for now
            # (Assuming one-way binding or simple lookup)

            for layer in self.layers:
                env_layer_for_tilt = None

                if layer.environmental_reaction:
                    target_name = layer.environmental_reaction.target_sprite_name
                    env_layer_for_tilt = layers_by_name.get(target_name)

                layer.draw(
                    self.screen, self.scroll, self.elapsed_time, dt, None, env_layer_for_tilt
                )

                # DEBUG: Visualize Physics Sampling
                if layer.asset_path.name == "boat.png" and env_layer_for_tilt:
                    # Let's just draw the points returned by the log!
                    # We can't easier get them without recalculating.
                    pass

            # DEBUG: Draw a marker at the mouse-reported "Surface Y" for the mouse X
            # to see what the physics engine thinks is at the mouse X
            if self.layers and self.debug_target_layer_index < len(self.layers):
                sampled_layer = self.layers[self.debug_target_layer_index]
                mx, my = pygame.mouse.get_pos()
                physics_y = sampled_layer.get_y_at_x(screen_h, self.scroll, mx, self.elapsed_time)
                pygame.draw.circle(self.screen, (255, 0, 255), (mx, physics_y), 5)

            # DEBUG: Interactive Menu & Overlay
            if self.show_debug_menu:
                self._draw_debug_menu()
            elif self.layers and self.debug_target_layer_index < len(self.layers):
                # Simple overlay when menu is closed
                if pygame.font.get_init():
                    sampled_layer = self.layers[self.debug_target_layer_index]
                    mx, my = pygame.mouse.get_pos()
                    physics_y = sampled_layer.get_y_at_x(
                        screen_h, self.scroll, mx, self.elapsed_time
                    )
                    msg = (
                        f"Sampling Layer: {sampled_layer.asset_path.parent.name} | "
                        f"Surface Y: {int(physics_y)}"
                    )
                    text = self.font_small.render(msg, True, (255, 0, 0))
                    self.screen.blit(text, (10, 10))

            pygame.display.flip()

    def _draw_debug_menu(self):
        """Draw the interactive debug dialog."""
        if not pygame.font.get_init():
            return

        mx, my = pygame.mouse.get_pos()
        screen_h = self.screen.get_height()

        # 1. Background box
        s = pygame.Surface(
            (self.debug_menu_rect.width, self.debug_menu_rect.height), pygame.SRCALPHA
        )
        s.fill((0, 0, 0, 180))  # Dark transparent
        self.screen.blit(s, (self.debug_menu_rect.x, self.debug_menu_rect.y))
        pygame.draw.rect(self.screen, (255, 255, 255), self.debug_menu_rect, 2)

        # 2. Header
        header_text = self.font_header.render("Debug Menu: Select Layer", True, (255, 255, 0))
        self.screen.blit(header_text, (self.debug_menu_rect.x + 10, self.debug_menu_rect.y + 10))

        # 3. Layer list
        y_offset = self.debug_menu_rect.y + 45
        for i, layer in enumerate(self.layers):
            color = (255, 255, 255)
            prefix = "[ ] "
            if i == self.debug_target_layer_index:
                color = (255, 0, 255)  # Pink for active
                prefix = "[x] "

            layer_name = layer.asset_path.parent.name
            item_text = self.font_item.render(f"{prefix}{layer_name}", True, color)
            self.screen.blit(item_text, (self.debug_menu_rect.x + 20, y_offset))

            # Visibility toggle
            vis_char = "[V]" if layer.visible else "[H]"
            vis_color = (0, 255, 0) if layer.visible else (150, 150, 150)
            vis_text = self.font_item.render(vis_char, True, vis_color)
            self.screen.blit(vis_text, (self.debug_menu_rect.right - 40, y_offset))

            y_offset += 25

        # 4. Detailed Coordinate Reporting (Footer)
        footer_y = self.debug_menu_rect.bottom - 105
        pygame.draw.line(
            self.screen,
            (150, 150, 150),
            (self.debug_menu_rect.x + 10, footer_y),
            (self.debug_menu_rect.right - 10, footer_y),
        )

        if not self.layers:
            return

        idx = self.debug_target_layer_index % len(self.layers)
        sampled_layer = self.layers[idx]
        physics_y = sampled_layer.get_y_at_x(screen_h, self.scroll, mx, self.elapsed_time)
        sprite_x, sprite_y = sampled_layer.get_screen_pos(
            self.screen.get_width(), screen_h, self.scroll, self.elapsed_time
        )

        report_mouse = self.font_item.render(f"Mouse X: {mx}  Y: {my}", True, (200, 200, 200))
        report_pink = self.font_item.render(
            f"Pink Dot X: {mx}  Y: {int(physics_y)}", True, (255, 0, 255)
        )
        report_sprite = self.font_item.render(
            f"Sprite X: {int(sprite_x)}  Y: {int(sprite_y)}", True, (255, 255, 0)
        )
        report_layer = self.font_item.render(
            f"Target: {sampled_layer.asset_path.parent.name}", True, (0, 255, 255)
        )

        self.screen.blit(report_mouse, (self.debug_menu_rect.x + 15, footer_y + 5))
        self.screen.blit(report_pink, (self.debug_menu_rect.x + 15, footer_y + 30))
        self.screen.blit(report_sprite, (self.debug_menu_rect.x + 15, footer_y + 55))
        self.screen.blit(report_layer, (self.debug_menu_rect.x + 15, footer_y + 80))


def run_theatre(scene_path: str = "assets/scenes/sailboat/scene.json"):
    theatre = Theatre(scene_path)
    theatre.run()


if __name__ == "__main__":
    scene = sys.argv[1] if len(sys.argv) > 1 else "assets/scenes/sailboat/scene.json"
    run_theatre(scene)
    pygame.display.quit()
    os._exit(0)
