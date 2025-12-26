import pygame
import sys
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
        
        base_y_from_top = screen_h * self.vertical_percent
        if self.vertical_anchor == "bottom":
            base_y = base_y_from_top - img_h_for_positioning
        elif self.vertical_anchor == "top":
            base_y = base_y_from_top
        else: # Default to "center"
            base_y = base_y_from_top - (img_h_for_positioning / 2)

        bob_offset = 0
        if self.bob_amplitude > 0 and self.bob_frequency > 0:
            bob_offset = math.sin(scroll_x * self.bob_frequency) * self.bob_amplitude
        y = base_y + bob_offset + self.y_offset

        current_tilt = 0
        if self.environmental_reaction and environment_y is not None and self.environmental_reaction.reaction_type == EnvironmentalReactionType.PIVOT_ON_CREST:
            # Apply vertical following if configured, BEFORE calculating tilt
            if self.environmental_reaction.vertical_follow_factor > 0:
                # Calculate the target y where the boat should be, ensuring it's 'vertical_follow_factor' into the wave
                # This means the top of the boat will be at environment_y - (boat_height * (1 - factor))
                y = environment_y - (img_h_for_positioning * (1 - self.environmental_reaction.vertical_follow_factor))

            # Now, calculate tilt based on wave slope
            if environment_layer_for_tilt is not None:
                # Calculate the reacting sprite's current horizontal center on the screen
                reacting_sprite_current_x = (parallax_scroll + self.x_offset + img_w_for_blit / 2)

                # Sample the environment's Y at points slightly ahead and behind the sprite's center
                sample_offset = 5.0 # Smaller fixed offset for more sensitive slope detection
                
                y_at_behind_point = environment_layer_for_tilt.get_y_at_x(screen_h, scroll_x, int(reacting_sprite_current_x - sample_offset))
                y_at_ahead_point = environment_layer_for_tilt.get_y_at_x(screen_h, scroll_x, int(reacting_sprite_current_x + sample_offset))
                
                # Slope calculation: (change in Y) / (change in X)
                # A higher Y value means lower on the screen.
                # If y_at_ahead_point is smaller (higher on screen) than y_at_behind_point, the wave is rising -> bow up (positive tilt)
                # If y_at_ahead_point is larger (lower on screen) than y_at_behind_point, the wave is falling -> bow down (negative tilt)
                
                # The difference `y_at_behind_point - y_at_ahead_point` will be positive when rising (bow up)
                # and negative when falling (bow down).
                delta_y = y_at_behind_point - y_at_ahead_point
                delta_x = 2 * sample_offset

                raw_slope = 0.0
                tilt_angle_deg = 0.0
                if delta_x != 0:
                    raw_slope = delta_y / delta_x
                    tilt_angle_rad = math.atan(raw_slope)
                    tilt_angle_deg = math.degrees(tilt_angle_rad) * 50.0  # Apply a scaling factor
                    
                current_tilt = max(-self.environmental_reaction.max_tilt_angle, 
                                   min(self.environmental_reaction.max_tilt_angle, 
                                       tilt_angle_deg)) 

                logging.debug(f"DEBUG (Tilt Calc): Sprite '{self.asset_path.parent.name}': Y_behind={y_at_behind_point:.2f}, Y_ahead={y_at_ahead_point:.2f}, Delta_Y={delta_y:.2f}, Raw_Slope={raw_slope:.4f}, Tilt_Deg={tilt_angle_deg:.2f}, Final_Tilt={current_tilt:.2f}")

            # Else (if no environment_layer_for_tilt), current_tilt remains 0
            
            image_to_draw = pygame.transform.rotate(image_to_draw, current_tilt)
            rotated_rect = image_to_draw.get_rect(center=(parallax_scroll + self.x_offset + img_w_for_blit / 2, y + img_h_for_blit / 2))
            draw_x = rotated_rect.x
            y = rotated_rect.y

        else:
            draw_x = (parallax_scroll + self.x_offset) % (screen_w + img_w_for_blit) - img_w_for_blit

        if self.tile_horizontal:
            start_x = (parallax_scroll + self.x_offset) % img_w_for_blit
            current_x = start_x - img_w_for_blit
            while current_x < screen_w:
                screen.blit(image_to_draw, (current_x, y))
                current_x += img_w_for_blit
        else:
            wrap_width = screen_w + img_w_for_blit
            x = (parallax_scroll + self.x_offset) % wrap_width
            draw_x = x - img_w_for_blit # Corrected this line
            screen.blit(image_to_draw, (draw_x, y))

    def get_y_at_x(self, screen_h: int, scroll_x: int, x_coord: int) -> float:
        img_h_for_blit = self.image.get_size()[1]
        img_h_for_positioning = self.original_image_size[1] if self.fill_down else img_h_for_blit

        parallax_scroll = scroll_x * self.scroll_speed
        
        base_y_from_top = screen_h * self.vertical_percent
        if self.vertical_anchor == "bottom":
            base_y = base_y_from_top - img_h_for_positioning
        elif self.vertical_anchor == "top":
            base_y = base_y_from_top
        else: # Default to "center"
            base_y = base_y_from_top - (img_h_for_positioning / 2)

        bob_offset = 0
        if self.bob_amplitude > 0 and self.bob_frequency > 0:
            if self.tile_horizontal:
                spatial_phase = (scroll_x * self.scroll_speed) + (x_coord * 0.01)
                bob_offset = math.sin(spatial_phase * self.bob_frequency) * self.bob_amplitude
            else:
                bob_offset = math.sin(scroll_x * self.bob_frequency) * self.bob_amplitude
            
        effective_y = base_y + bob_offset + self.y_offset
        logging.debug(f"Environment: Layer '{self.asset_path.parent.name}' (z={self.z_depth}) at x_coord={x_coord}: effective_y={effective_y:.2f}") # Reverted to debug
        return effective_y

def run_theatre(scene_path: str = "assets/story/scene1.json"):
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', force=True)
    
    pygame.init()
    screen = pygame.display.set_mode((1280, 720))
    clock = pygame.time.Clock()
    scroll = 0
    
    scene_file_path = Path(scene_path)
    last_modified_time = 0
    scene_config = {}
    scene_layers = []
    sprite_base_dir = Path("assets/sprites")

    # Initialize persistent state variables here
    previous_env_y: Dict[str, float] = {}
    env_y_direction: Dict[str, int] = {} # 1 for up, -1 for down, 0 for no change
    max_positive_tilts: Dict[str, float] = {}
    min_negative_tilts: Dict[str, float] = {}

    def load_scene():
        # Use nonlocal to modify variables in the enclosing run_theatre scope
        nonlocal scene_config, scene_layers, last_modified_time, previous_env_y, env_y_direction, max_positive_tilts, min_negative_tilts
        try:
            with open(scene_file_path, 'r') as f:
                scene_config = json.load(f)
            
            # Clear previous state for new scene
            previous_env_y.clear()
            env_y_direction.clear()
            max_positive_tilts.clear()
            min_negative_tilts.clear()

            new_scene_layers = []
            for layer_data in scene_config.get("layers", []):
                sprite_name = layer_data.get("sprite_name")
                if sprite_name:
                    sprite_dir = sprite_base_dir / sprite_name
                    
                    overrides = {
                        "z_depth": layer_data.get("z_depth"),
                        "vertical_percent": layer_data.get("vertical_percent"),
                        "target_height": layer_data.get("target_height"),
                        "bob_amplitude": layer_data.get("bob_amplitude"),
                        "bob_frequency": layer_data.get("bob_frequency"),
                        "scroll_speed": layer_data.get("scroll_speed"),
                        "tile_horizontal": layer_data.get("tile_horizontal"),
                        "fill_down": layer_data.get("fill_down"),
                        "vertical_anchor": layer_data.get("vertical_anchor"),
                        "is_background": layer_data.get("is_background"),
                        "x_offset": layer_data.get("x_offset"),
                        "y_offset": layer_data.get("y_offset"),
                        "environmental_reaction": layer_data.get("environmental_reaction")
                    }
                    filtered_overrides = {k: v for k, v in overrides.items() if v is not None}

                    layer = ParallaxLayer.from_sprite_dir(str(sprite_dir), overrides=filtered_overrides)
                    new_scene_layers.append(layer)
                    
            new_scene_layers.sort(key=lambda layer: layer.z_depth, reverse=False)
            scene_layers = new_scene_layers
            last_modified_time = os.path.getmtime(scene_file_path)
            logging.info(f"Loaded {len(scene_layers)} layers. Scene reloaded due to file change.")

            layers_by_name_debug = {layer.asset_path.parent.name: layer.z_depth for layer in scene_layers}
            logging.info(f"DEBUG (load_scene): layers_by_name: {layers_by_name_debug}")

        except Exception as e:
            logging.error(f"Error reloading scene: {e}")

    logging.info(f"Theatre initialized. Loading scene: {scene_path}")
    import os
    load_scene()

    logging.info(f"Loaded {len(scene_layers)} layers. Starting main theatre loop.")
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT: return
        
        current_modified_time = os.path.getmtime(scene_file_path)
        if current_modified_time != last_modified_time:
            logging.info(f"Detected change in {scene_file_path}. Reloading scene...")
            load_scene()

        scroll += 3
        screen.fill((200, 230, 255))
        
        layers_to_draw = []
        environment_y_data = {}
        screen_w, screen_h = screen.get_size()
        
        layers_by_name = {layer.asset_path.parent.name: layer for layer in scene_layers}

        for layer in scene_layers:
            if layer.environmental_reaction:
                target_sprite_name = layer.environmental_reaction.target_sprite_name
                env_layer = layers_by_name.get(target_sprite_name)
                
                if env_layer:
                    reacting_sprite_current_x = (scroll * layer.scroll_speed) + layer.x_offset + layer.image.get_size()[0] / 2
                    
                    current_env_y = env_layer.get_y_at_x(screen_h, scroll, int(reacting_sprite_current_x))
                    environment_y_data[layer] = current_env_y

                    env_layer_name = env_layer.asset_path.parent.name
                    prev_y = previous_env_y.get(env_layer_name) 
                    prev_direction = env_y_direction.get(env_layer_name, 0)

                    current_direction = 0
                    if prev_y is not None:
                        if current_env_y > prev_y:
                            current_direction = -1
                        elif current_env_y < prev_y:
                            current_direction = 1
                        
                    if prev_direction != 0 and current_direction != 0 and (prev_direction * current_direction < 0):
                        peak_or_valley = "Peak  " if current_direction == -1 else "Valley"
                        
                        img_h_for_positioning = layer.original_image_size[1] if layer.fill_down else layer.image.get_size()[1]
                        
                        base_y_from_top = screen_h * layer.vertical_percent
                        if layer.vertical_anchor == "bottom":
                            base_y = base_y_from_top - img_h_for_positioning
                        elif layer.vertical_anchor == "top":
                            base_y = base_y_from_top
                        else:
                            base_y = base_y_from_top - (img_h_for_positioning / 2)

                        bob_offset = 0
                        if layer.bob_amplitude > 0 and layer.bob_frequency > 0:
                            bob_offset = math.sin(scroll * layer.bob_frequency) * layer.bob_amplitude
                        reacting_sprite_current_y = base_y + bob_offset + layer.y_offset

                        reacting_sprite_bottom_y = reacting_sprite_current_y + img_h_for_positioning
                        y_diff_for_log = (reacting_sprite_bottom_y - current_env_y) / (img_h_for_positioning / 2)
                        current_tilt_for_log = max(-layer.environmental_reaction.max_tilt_angle, min(layer.environmental_reaction.max_tilt_angle, y_diff_for_log * layer.environmental_reaction.max_tilt_angle))
                        
                        logging.info(f"{peak_or_valley} Detected! Environment '{env_layer_name}' (Env_y={current_env_y:.2f}) at x_coord={int(reacting_sprite_current_x)}. Reacting Sprite '{layer.asset_path.parent.name}': Tilt={current_tilt_for_log:.2f}")

                    previous_env_y[env_layer_name] = current_env_y
                    env_y_direction[env_layer_name] = current_direction
                    prev_y_display = 'None' if prev_y is None else f'{prev_y:.2f}'
                    logging.debug(f"DEBUG (Frame End - {env_layer_name}): current_env_y: {current_env_y:.2f}, prev_y: {prev_y_display}, current_direction: {current_direction}, prev_direction: {prev_direction}")

                else:
                    environment_y_data[layer] = None
            layers_to_draw.append(layer)

        for layer in layers_to_draw:
            env_y = environment_y_data.get(layer)
            env_layer_for_tilt = layers_by_name.get(layer.environmental_reaction.target_sprite_name) if layer.environmental_reaction else None
            layer.draw(screen, scroll, environment_y=env_y, environment_layer_for_tilt=env_layer_for_tilt)

        pygame.display.flip()
        clock.tick(60)

if __name__ == "__main__":
    run_theatre()