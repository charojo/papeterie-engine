import pygame
import sys
from pathlib import Path
import math

class ParallaxLayer:
    def __init__(self, asset_path, z_depth, vertical_percent, target_height=None, bob_amplitude=0, bob_frequency=0):
        self.z_depth = z_depth
        self.asset_path = Path(asset_path)
        self.vertical_percent = vertical_percent
        self.bob_amplitude = bob_amplitude
        self.bob_frequency = bob_frequency
        
        if self.asset_path.exists():
            original_image = pygame.image.load(str(self.asset_path)).convert_alpha()
            
            # AUTO-SCALING LOGIC
            if target_height:
                w, h = original_image.get_size()
                aspect_ratio = w / h
                target_width = int(target_height * aspect_ratio)
                self.image = pygame.transform.smoothscale(original_image, (target_width, target_height))
            else:
                self.image = original_image
        else:
            self.image = pygame.Surface((100, 50))
            self.image.fill((255, 0, 255))
            
    def draw(self, screen, scroll_x):
        screen_w, screen_h = screen.get_size()
        img_w, img_h = self.image.get_size()
        
        # Define a wrap_width that is larger than the screen, so the boat can
        # fully disappear before reappearing on the other side.
        wrap_width = screen_w + img_w
        
        # Calculate the parallax-adjusted scroll position
        parallax_scroll = scroll_x / self.z_depth
        
        # Use modulo with the wrap_width to create a repeating loop
        x = parallax_scroll % wrap_width
        
        # Adjust the final drawing position so the boat starts off-screen
        draw_x = x - img_w

        # 2. FIX POSITION: Calculate Y dynamically
        base_y = (screen_h * self.vertical_percent) - img_h
        
        # 3. ADD BOBBING
        bob_offset = 0
        if self.bob_amplitude > 0 and self.bob_frequency > 0:
            bob_offset = math.sin(scroll_x * self.bob_frequency) * self.bob_amplitude
            
        y = base_y + bob_offset
        
        # Draw the single boat image at its calculated position
        screen.blit(self.image, (draw_x, y))

def run_theatre():
    pygame.init()
    screen = pygame.display.set_mode((1280, 720))
    clock = pygame.time.Clock()
    scroll = 0
    
    # Let's place the boat at 70% down the screen (the "water line")
    boat = ParallaxLayer(
        "sprites/boat/boat.png", 
        z_depth=2, 
        vertical_percent=0.7, 
        target_height=150,
        bob_amplitude=5,
        bob_frequency=0.05
    )
    
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT: return
        
        scroll += 3 # Adjust this for speed
        screen.fill((200, 230, 255)) # Sky
        
        boat.draw(screen, scroll)

        pygame.display.flip()
        clock.tick(60)

if __name__ == "__main__":
    run_theatre()