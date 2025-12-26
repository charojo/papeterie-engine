import pygame
import sys
from pathlib import Path
import math
import json
import logging

class ParallaxLayer:
    def __init__(self, asset_path, z_depth, vertical_percent, target_height=None, bob_amplitude=0, bob_frequency=0.0, scroll_speed=1.0, is_background=False, tile_horizontal=False, tile_border=0, height_scale=None):
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
        
        if self.asset_path.exists():
            original_image = pygame.image.load(str(self.asset_path)).convert_alpha()
            
            # 1. BORDER CROPPING
            if self.tile_border > 0:
                w, h = original_image.get_size()
                crop_rect = pygame.Rect(self.tile_border, 0, w - (2 * self.tile_border), h)
                original_image = original_image.subsurface(crop_rect)

            # 2. SCALING LOGIC (target_height vs height_scale)
            if self.height_scale is not None:
                # height_scale takes precedence if present
                # Check if display surface exists, otherwise default to a reasonable height
                screen_surface = pygame.display.get_surface()
                screen_h = screen_surface.get_height() if screen_surface else 720 

                target_h = int(screen_h * self.height_scale)
                w, h = original_image.get_size()
                aspect_ratio = w / h
                target_w = int(target_h * aspect_ratio)
                self.image = pygame.transform.smoothscale(original_image, (target_w, target_h))
            elif target_height:
                w, h = original_image.get_size()
                aspect_ratio = w / h
                target_width = int(target_height * aspect_ratio)
                self.image = pygame.transform.smoothscale(original_image, (target_width, target_height))
            else:
                self.image = original_image
        else:
            self.image = pygame.Surface((100, 50))
            self.image.fill((255, 0, 255))

    @classmethod
    def from_sprite_dir(cls, sprite_dir_path: str):
        sprite_dir = Path(sprite_dir_path)
        sprite_name = sprite_dir.name
        meta_path = sprite_dir / f"{sprite_name}.meta"
        asset_path = sprite_dir / f"{sprite_name}.png"

        with open(meta_path, 'r') as f:
            meta = json.load(f)
            logging.info(f"Loaded sprite '{sprite_name}' with metadata: {meta}")

        return cls(
            asset_path=str(asset_path),
            z_depth=meta.get("z_depth", 1),
            vertical_percent=meta.get("vertical_percent", 0.5),
            target_height=meta.get("target_height"),
            bob_amplitude=meta.get("bob_amplitude", 0),
            bob_frequency=meta.get("bob_frequency", 0.0),
            scroll_speed=meta.get("scroll_speed", 1.0 / meta.get("z_depth", 1)),
            is_background=meta.get("is_background", False),
            tile_horizontal=meta.get("tile_horizontal", False),
            tile_border=meta.get("tile_border", 0),
            height_scale=meta.get("height_scale")
        )
            
    def draw(self, screen, scroll_x):
        screen_w, screen_h = screen.get_size()

        if self.is_background:
            img_w, img_h = self.image.get_size()
            
            # Aspect ratio correction logic (Cover scaling)
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

        # Common calculations for all scrolling sprites
        img_w, img_h = self.image.get_size()
        image_to_draw = self.image
        parallax_scroll = scroll_x * self.scroll_speed
        
        base_y = (screen_h * self.vertical_percent) - (img_h / 2)
        bob_offset = 0
        if self.bob_amplitude > 0 and self.bob_frequency > 0:
            bob_offset = math.sin(scroll_x * self.bob_frequency) * self.bob_amplitude
        y = base_y + bob_offset

        if self.tile_horizontal:
            # Tiling logic for wide sprites like clouds
            start_x = parallax_scroll % img_w
            current_x = start_x - img_w
            while current_x < screen_w:
                screen.blit(image_to_draw, (current_x, y))
                current_x += img_w
        else:
            # Single-sprite logic for sprites like the boat
            wrap_width = screen_w + img_w
            x = parallax_scroll % wrap_width
            draw_x = x - img_w
            screen.blit(image_to_draw, (draw_x, y))

def run_theatre(scene_path: str = "story/scene1.json"):
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    pygame.init()
    screen = pygame.display.set_mode((1280, 720))
    clock = pygame.time.Clock()
    scroll = 0
    
    logging.info(f"Theatre initialized. Loading scene: {scene_path}")
    
    with open(scene_path, 'r') as f:
        scene_config = json.load(f)

    # Load all layers from the scene config
    scene_layers = []
    sprite_base_dir = Path("sprites")
    for layer_data in scene_config.get("layers", []):
        sprite_name = layer_data.get("sprite_name")
        if sprite_name:
            sprite_dir = sprite_base_dir / sprite_name
            layer = ParallaxLayer.from_sprite_dir(str(sprite_dir))
            scene_layers.append(layer)
            
    # Sort layers by z_depth to draw background first
    scene_layers.sort(key=lambda layer: layer.z_depth, reverse=True)

    logging.info(f"Loaded {len(scene_layers)} layers. Starting main theatre loop.")
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT: return
        
        scroll += 3 # Adjust this for speed
        screen.fill((200, 230, 255)) # Sky
        
        # Draw all the layers in order
        for layer in scene_layers:
            layer.draw(screen, scroll)

        pygame.display.flip()
        clock.tick(60)

if __name__ == "__main__":
    run_theatre()