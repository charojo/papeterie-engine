import pygame
import sys

class ParallaxLayer:
    def __init__(self, color, z_depth, y_pos, height):
        self.color = color
        self.z_depth = z_depth  # 1 = Front (Fast), 10 = Back (Slow)
        self.y_pos = y_pos
        self.height = height

    def draw(self, screen, scroll_x):
        # The Parallax Formula: Inverse depth
        # We use a width of 1280 for the screen
        width = 1280
        x = -(scroll_x / self.z_depth) % width
        
        # Draw two rectangles to create a seamless infinite loop
        pygame.draw.rect(screen, self.color, (x, self.y_pos, width, self.height))
        pygame.draw.rect(screen, self.color, (x - width, self.y_pos, width, self.height))

def run_theatre():
    pygame.init()
    screen = pygame.display.set_mode((1280, 720))
    pygame.display.set_caption("Papeterie Engine: Studio Mode")
    clock = pygame.time.Clock()
    scroll = 0
    
    # Placeholder Layers: Blue tones for sea levels
    layers = [
        ParallaxLayer((20, 40, 80), 10, 200, 600),   # Deep Background
        ParallaxLayer((40, 80, 150), 5, 400, 400),   # Midground
        ParallaxLayer((100, 150, 240), 2, 550, 250), # Foreground
    ]

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
        
        scroll += 4  # Movement speed
        screen.fill((200, 230, 255)) # Sky Blue
        
        for layer in layers:
            layer.draw(screen, scroll)
            
        pygame.display.flip()
        clock.tick(60)

if __name__ == "__main__":
    run_theatre()