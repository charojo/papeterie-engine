import pygame
import sys
import os
from pathlib import Path
import math
import json
import logging
from typing import Dict, Any, Optional
from compiler.models import EnvironmentalReaction, EnvironmentalReactionType

class ParallaxLayer:
    def __init__(self, asset_path, z_depth, vertical_percent, target_height=None, bob_amplitude=0, bob_frequency=0.0, scroll_speed=1.0, is_background=False, tile_horizontal=False, tile_border=0, height_scale=None, fill_down=False, vertical_anchor="center", x_offset: int = 0, y_offset: int = 0, environmental_reaction: Optional[EnvironmentalReaction] = None):
        self.z_depth = z_depth
        self.asset_path = Path(asset_path)
        self.vertical_percent = vertical_percent
        self.bob_amplitude = bob_amplitude
        self.bob_frequency = bob_frequency
        self.scroll_speed = scroll_speed
        self.is_background = is_background
        self.tile_horizontal = tile_horizontal
        self.tile_border = tile_border
        self.height_scale = height_scale
        self.fill_down = fill_down
        self.vertical_anchor = vertical_anchor
        self.x_offset = x_offset
        self.y_offset = y_offset
        self.environmental_reaction = environmental_reaction
        
        if self.asset_path.exists():
            original_image = pygame.image.load(str(self.asset_path)).convert_alpha()
            
            if self.tile_border > 0:
                w, h = original_image.get_size()
                crop_rect = pygame.Rect(self.tile_border, 0, w - (2 * self.tile_border), h)
                original_image = original_image.subsurface(crop_rect)

            processed_image = original_image
            if self.height_scale is not None:
                screen_surface = pygame.display.get_surface()
                if screen_surface is None:
                    raise RuntimeError("pygame.display.set_mode() must be called before creating ParallaxLayer with height_scale. Screen surface is None.")
                screen_h = screen_surface.get_height()
                target_h = int(screen_h * self.height_scale)
                w, h = processed_image.get_size()
                aspect_ratio = w / h
                target_w = int(target_h * aspect_ratio)
                processed_image = pygame.transform.smoothscale(processed_image, (target_w, target_h))
            elif target_height:
                w, h = processed_image.get_size()
                aspect_ratio = w / h
                target_width = int(target_height * aspect_ratio)
                processed_image = pygame.transform.smoothscale(processed_image, (target_width, target_height))
            
            self.original_image_size = processed_image.get_size()

            if self.fill_down:
                screen_surface = pygame.display.get_surface()
                if screen_surface is None:
                    raise RuntimeError("pygame.display.set_mode() must be called before creating ParallaxLayer with fill_down=True. Screen surface is None.")
                screen_h = screen_surface.get_height()
                w, h = processed_image.get_size()
                
                bottom_color = processed_image.get_at((w // 2, h - 1))
                
                new_h = h + screen_h 
                filled_surface = pygame.Surface((w, new_h), pygame.SRCALPHA)
                
                filled_surface.blit(processed_image, (0, 0))
                
                fill_rect = pygame.Rect(0, h, w, new_h - h)
                filled_surface.fill(bottom_color, fill_rect)

                self.image = filled_surface
            else:
                self.image = processed_image
        else:
            self.image = pygame.Surface((100, 50))
            self.image.fill((255, 0, 255))

    @classmethod
    def from_sprite_dir(cls, sprite_dir_path: str, overrides: Optional[Dict[str, Any]] = None):
        sprite_dir = Path(sprite_dir_path)
        sprite_name = sprite_dir.name
        meta_path = sprite_dir / f"{sprite_name}.meta"
        
        png_files = list(sprite_dir.glob("*.png"))
        if not png_files:
            raise FileNotFoundError(f"No PNG asset found in sprite directory: {sprite_dir}")
        if len(png_files) > 1:
            logging.warning(f"Multiple PNG assets found in {sprite_dir}. Using the first one: {png_files[0]}")
        asset_path = png_files[0]

        with open(meta_path, 'r') as f:
            meta = json.load(f)
            logging.info(f"Loaded sprite '{sprite_name}' with metadata: {meta}")

        if overrides:
            meta.update({k: v for k, v in overrides.items() if v is not None})

        return cls(
            asset_path=str(asset_path),
            z_depth=meta.get("z_depth", 1),
            vertical_percent=meta.get("vertical_percent", 0.5),
            target_height=meta.get("target_height"),
            bob_amplitude=meta.get("bob_amplitude", 0),
            bob_frequency=meta.get("bob_frequency", 0.0),
            scroll_speed=meta.get("scroll_speed", 0.0),
            is_background=meta.get("is_background", False),
            tile_horizontal=meta.get("tile_horizontal", False),
            tile_border=meta.get("tile_border", 0),
            height_scale=meta.get("height_scale"),
            fill_down=meta.get("fill_down", False),
            vertical_anchor=meta.get("vertical_anchor", "center"),
            x_offset=meta.get("x_offset", 0),
            y_offset=meta.get("y_offset", 0),
            environmental_reaction=EnvironmentalReaction(**meta["environmental_reaction"]) if meta.get("environmental_reaction") else None
        )

    def _get_base_y(self, screen_h: int) -> float:
        """Calculate the Y coordinate before bobbing, following, or offsets."""
        img_h_for_blit = self.image.get_size()[1]
        img_h_for_positioning = self.original_image_size[1] if self.fill_down else img_h_for_blit
        base_y_from_top = screen_h * self.vertical_percent
        
        if self.vertical_anchor == "bottom":
            return base_y_from_top - img_h_for_positioning
        elif self.vertical_anchor == "top":
            return base_y_from_top
        else: # Default to "center"
            return base_y_from_top - (img_h_for_positioning / 2)

    def _get_bob_offset(self, scroll_x: float, x_coord: Optional[int] = None) -> float:
        """Calculate the bobbing offset at a specific scroll and optional screen X."""
        if self.bob_amplitude <= 0 or self.bob_frequency <= 0:
            return 0
        
        if x_coord is not None and self.tile_horizontal:
            # Spatial bobbing for environment layers
            spatial_phase = (scroll_x * self.scroll_speed) + (x_coord * 0.01)
            return math.sin(spatial_phase * self.bob_frequency) * self.bob_amplitude
        
        return math.sin(scroll_x * self.bob_frequency) * self.bob_amplitude

    def get_current_y(self, screen_h: int, scroll_x: float, x_coord: Optional[int] = None) -> float:
        """Calculate the final Y coordinate including base position, bobbing, and Y offset."""
        base_y = self._get_base_y(screen_h)
        bob_offset = self._get_bob_offset(scroll_x, x_coord)
        return base_y + bob_offset + self.y_offset

    def get_current_tilt(self, screen_h: int, scroll_x: float, draw_x: float, img_w: int, environment_layer_for_tilt: Optional['ParallaxLayer']) -> float:
        """Calculate the tilt angle based on environment slope."""
        if not self.environmental_reaction or not environment_layer_for_tilt:
            return 0
        
        if self.environmental_reaction.reaction_type != EnvironmentalReactionType.PIVOT_ON_CREST:
            return 0

        # Calculate the reacting sprite's current horizontal center on the screen
        reacting_sprite_current_x = draw_x + img_w / 2

        # Sample the environment's Y at points slightly ahead and behind the sprite's center
        sample_offset = 2.0 
        
        y_at_behind_point = environment_layer_for_tilt.get_y_at_x(screen_h, scroll_x, int(reacting_sprite_current_x - sample_offset))
        y_at_ahead_point = environment_layer_for_tilt.get_y_at_x(screen_h, scroll_x, int(reacting_sprite_current_x + sample_offset))
        
        delta_y = y_at_behind_point - y_at_ahead_point
        delta_x = 2 * sample_offset
        raw_slope = delta_y / delta_x if delta_x != 0 else 0
        
        # Apply sensitivity factor and start-of-scene ramp-in
        start_ramp = min(1.0, scroll_x / 300.0) if scroll_x > 0 else 0
        tilt_angle_deg = math.degrees(math.atan(raw_slope)) * 50.0 * start_ramp
        
        return max(-self.environmental_reaction.max_tilt_angle, 
                   min(self.environmental_reaction.max_tilt_angle, 
                       tilt_angle_deg))
            
    def draw(self, screen, scroll_x, environment_y: Optional[float] = None, environment_layer_for_tilt: Optional['ParallaxLayer'] = None):
        screen_w, screen_h = screen.get_size()

        if self.is_background:
            img_w, img_h = self.image.get_size()
            
            screen_aspect = screen_w / screen_h
            img_aspect = img_w / img_h

            if img_aspect > screen_aspect:
                new_h = screen_h
                new_w = int(new_h * img_aspect)
            else:
                new_w = screen_w
                new_h = int(new_w / img_aspect)

            scaled_image = pygame.transform.smoothscale(self.image, (new_w, new_h))
            
            blit_x = (screen_w - new_w) / 2
            blit_y = (screen_h - new_h) / 2
            
            screen.blit(scaled_image, (blit_x, blit_y))
            return 

        img_w_for_blit, img_h_for_blit = self.image.get_size()
        image_to_draw = self.image
        
        img_h_for_positioning = self.original_image_size[1] if self.fill_down else img_h_for_blit

        parallax_scroll = scroll_x * self.scroll_speed
        y = self.get_current_y(screen_h, scroll_x)

        # Calculate initial draw_x for horizontal wrapping/positioning
        wrap_width = screen_w + img_w_for_blit
        x = (parallax_scroll + self.x_offset) % wrap_width
        draw_x = x - img_w_for_blit

        if self.environmental_reaction and environment_y is not None and self.environmental_reaction.reaction_type == EnvironmentalReactionType.PIVOT_ON_CREST:
            # Apply vertical following if configured, BEFORE calculating tilt
            if self.environmental_reaction.vertical_follow_factor > 0:
                y = environment_y - (img_h_for_positioning * (1 - self.environmental_reaction.vertical_follow_factor))

            current_tilt = self.get_current_tilt(screen_h, scroll_x, draw_x, img_w_for_blit, environment_layer_for_tilt)
            
            image_to_draw = pygame.transform.rotate(image_to_draw, current_tilt)
            # Use the already calculated draw_x for the center calculation
            rotated_rect = image_to_draw.get_rect(center=(draw_x + img_w_for_blit / 2, y + img_h_for_blit / 2))
            draw_x = rotated_rect.x
            y = rotated_rect.y

        if self.tile_horizontal:
            start_x = (parallax_scroll + self.x_offset) % img_w_for_blit
            current_x = start_x - img_w_for_blit
            while current_x < screen_w:
                screen.blit(image_to_draw, (current_x, y))
                current_x += img_w_for_blit
        else:
            screen.blit(image_to_draw, (draw_x, y))

    def get_y_at_x(self, screen_h: int, scroll_x: float, x_coord: int) -> float:
        effective_y = self.get_current_y(screen_h, scroll_x, x_coord)
        logging.debug(f"Environment: Layer '{self.asset_path.parent.name}' (z={self.z_depth}) at x_coord={x_coord}: effective_y={effective_y:.2f}")
        return effective_y

class Theatre:
    def __init__(self, scene_path: str = "assets/story/scene_sailboat.json", width: int = 1280, height: int = 720):
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', force=True)
        
        if not pygame.get_init():
            pygame.init()
            
        self.screen = pygame.display.set_mode((width, height))
        self.clock = pygame.time.Clock()
        self.scroll = 0
        self.scene_path = Path(scene_path)
        self.last_modified_time = 0
        self.layers: list[ParallaxLayer] = []
        self.sprite_base_dir = Path("assets/sprites")

        # Persistent state for environmental reactions
        self.previous_env_y: Dict[str, float] = {}
        self.env_y_direction: Dict[str, int] = {} # 1 for up, -1 for down, 0 for no change

        self.load_scene()
        logging.info(f"Theatre initialized. Main loop starting.")

    def load_scene(self):
        """Load or reload the scene from the JSON configuration."""
        try:
            with open(self.scene_path, 'r') as f:
                scene_config = json.load(f)
            
            # Reset state for new scene
            self.previous_env_y.clear()
            self.env_y_direction.clear()

            new_layers = []
            for layer_data in scene_config.get("layers", []):
                sprite_name = layer_data.get("sprite_name")
                if not sprite_name:
                    continue
                    
                overrides = {k: layer_data.get(k) for k in [
                    "z_depth", "vertical_percent", "target_height", 
                    "bob_amplitude", "bob_frequency", "scroll_speed", 
                    "tile_horizontal", "fill_down", "vertical_anchor", 
                    "is_background", "x_offset", "y_offset", "environmental_reaction"
                ]}
                filtered_overrides = {k: v for k, v in overrides.items() if v is not None}

                layer = ParallaxLayer.from_sprite_dir(str(self.sprite_base_dir / sprite_name), overrides=filtered_overrides)
                new_layers.append(layer)
                
            new_layers.sort(key=lambda layer: layer.z_depth)
            self.layers = new_layers
            self.last_modified_time = os.path.getmtime(self.scene_path)
            logging.info(f"Loaded {len(self.layers)} layers. Scene reloaded due to file change.")

        except Exception as e:
            logging.error(f"Error loading scene: {e}")

    def _detect_peaks_and_valleys(self, layer: ParallaxLayer, env_layer: ParallaxLayer, current_env_y: float):
        """Analyze environmental Y changes to detect and log peaks/valleys."""
        env_name = env_layer.asset_path.parent.name
        prev_y = self.previous_env_y.get(env_name)
        prev_dir = self.env_y_direction.get(env_name, 0)

        current_dir = 0
        if prev_y is not None:
            if current_env_y > prev_y:
                current_dir = -1 # Falling (on screen Y increases)
            elif current_env_y < prev_y:
                current_dir = 1  # Rising (on screen Y decreases)

        if prev_dir != 0 and current_dir != 0 and (prev_dir * current_dir < 0):
            peak_or_valley = "Peak  " if current_dir == -1 else "Valley"
            
            # Synchronized tilt calculation for logging
            img_w = layer.image.get_size()[0]
            parallax_scroll = self.scroll * layer.scroll_speed
            draw_x = (parallax_scroll + layer.x_offset) % (self.screen.get_width() + img_w) - img_w
            
            tilt = layer.get_current_tilt(self.screen.get_height(), self.scroll, draw_x, img_w, env_layer)
            
            logging.info(f"{peak_or_valley} Detected! Environment '{env_name}' (Env_y={current_env_y:.2f}) at scroll={self.scroll}. Reacting Sprite '{layer.asset_path.parent.name}': Tilt={tilt:.2f}")

        self.previous_env_y[env_name] = current_env_y
        self.env_y_direction[env_name] = current_dir

    def run(self):
        """The main theatre loop."""
        while True:
            # 1. Handle Events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return

            # 2. Check for scene file changes
            if os.path.getmtime(self.scene_path) != self.last_modified_time:
                logging.info(f"Detected change in {self.scene_path}. Reloading...")
                self.load_scene()

            # 3. Update State
            self.scroll += 3
            screen_w, screen_h = self.screen.get_size()
            
            # 4. Render
            self.screen.fill((200, 230, 255))
            
            # Map layers by name for reactive lookups
            layers_by_name = {l.asset_path.parent.name: l for l in self.layers}
            environment_y_data = {}

            # Phase 1: Pre-calculate environmental data
            for layer in self.layers:
                if not layer.environmental_reaction:
                    continue
                    
                target_name = layer.environmental_reaction.target_sprite_name
                env_layer = layers_by_name.get(target_name)
                
                if env_layer:
                    # Determine reacting sprite center X for sampling
                    img_w = layer.image.get_size()[0]
                    parallax_scroll = self.scroll * layer.scroll_speed
                    draw_x = (parallax_scroll + layer.x_offset) % (screen_w + img_w) - img_w
                    center_x = draw_x + img_w / 2
                    
                    env_y = env_layer.get_y_at_x(screen_h, self.scroll, int(center_x))
                    environment_y_data[layer] = env_y
                    
                    self._detect_peaks_and_valleys(layer, env_layer, env_y)

            # Phase 2: Draw all layers
            for layer in self.layers:
                env_y = environment_y_data.get(layer)
                env_layer_for_tilt = None
                if layer.environmental_reaction:
                    env_layer_for_tilt = layers_by_name.get(layer.environmental_reaction.target_sprite_name)
                
                layer.draw(self.screen, self.scroll, env_y, env_layer_for_tilt)

            pygame.display.flip()
            self.clock.tick(60)

def run_theatre(scene_path: str = "assets/story/scene_sailboat.json"):
    theatre = Theatre(scene_path)
    theatre.run()

if __name__ == "__main__":
    run_theatre()