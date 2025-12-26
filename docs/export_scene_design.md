# Export Scene to Movie File Design Document

## 1. Introduction

This document outlines the design for implementing a feature to export animated scenes from the Papeterie Engine into a shareable movie file format. This functionality will allow users to easily generate video clips of their custom animations for distribution and presentation.

## 2. Core Functionality

The primary goal is to enable the export of a specified segment of an animated scene (e.g., a certain number of seconds) as a video file. Key aspects include:

*   **Duration Control:** Users will be able to specify the duration of the video export.
*   **Output Format:** Support for common video formats (e.g., MP4, GIF) using `MoviePy`.
*   **Custom Filenames:** Ability to specify the output file name and path.
*   **Seamless Export:** The export process should ideally run without displaying the Pygame window, or at least minimize user interaction during rendering.

## 3. Key Technologies

*   **Python 3.10+**
*   **MoviePy (`moviepy>=2.0.0`):** This library is already a project dependency and is well-suited for video editing and generation from individual frames or Pygame surfaces. It can handle various video codecs and container formats.
*   **Pygame-ce (`pygame-ce>=2.5.6`):** The existing rendering engine will be used to generate individual frames for MoviePy to compile into a video.

## 4. Implementation Details

### 4.1. Triggering Export

Export functionality could be triggered via:
*   A new function within `src/renderer/theatre.py` (e.g., `export_movie(scene_config, duration_sec, output_filename)`).
*   A dedicated CLI argument when running `theatre.py` (e.g., `python src/renderer/theatre.py --export-scene story/scene1.json --duration 5 --output output.mp4`).

### 4.2. Movie Generation Logic

1.  **Rendering Loop Adaptation:** The existing `run_theatre` loop will need to be adapted or a new, similar loop created for headless rendering. Instead of `pygame.display.flip()`, frames will be captured.
2.  **Frame Capture:** Each frame rendered by Pygame will be converted into a format compatible with MoviePy (e.g., a NumPy array).
3.  **MoviePy Integration:**
    *   `moviepy.editor.VideoFileClip` or `moviepy.editor.ImageSequenceClip` can be used to construct a video from a sequence of frames.
    *   The `make_frame` function within MoviePy could be highly effective here, where our existing `draw` logic is essentially wrapped to provide frames on demand.
4.  **Duration and FPS:** The export function will take `duration_sec` and use the existing `clock.tick(60)` (or a configurable FPS) to determine the total number of frames to render.
5.  **Output Configuration:** Parameters like output filename, codec, and bitrate would be configurable through function arguments.

### 4.3. High-Level Flow (within `theatre.py`)

```python
from moviepy.editor import VideoFileClip, ImageSequenceClip # Example imports

def export_scene_to_movie(scene_path: str, duration_sec: int, output_filename: str, fps: int = 60):
    pygame.init()
    screen = pygame.display.set_mode((1280, 720)) # Hidden or dummy display for rendering
    # ... load scene layers ...

    # Define a function to generate frames
    def make_frame(t):
        # 't' is time in seconds from MoviePy
        # Calculate current scroll based on 't' and layers' scroll_speed
        current_scroll = int(t * fps * SCROLL_SPEED_FACTOR) # Need to define SCROLL_SPEED_FACTOR
        # Render scene for current_scroll onto a surface
        # ... existing draw logic ...
        # Convert Pygame surface to NumPy array for MoviePy
        return pygame.surfarray.array3d(screen).swapaxes(0,1) # R,G,B order

    clip = VideoFileClip(make_frame, duration=duration_sec)
    clip.write_videofile(output_filename, fps=fps)

    pygame.quit()
```

## 5. Considerations and Future Enhancements

*   **Performance:** Rendering high-resolution videos for extended durations can be CPU-intensive. Optimizations for frame generation might be necessary.
*   **User Feedback:** Providing progress indicators during export would enhance the user experience.
*   **Audio Export:** Integration of scene-specific audio (if implemented later) with the video export. 
*   **GIF Export:** `MoviePy` can also export to GIF, which would be a useful lightweight sharing option.
