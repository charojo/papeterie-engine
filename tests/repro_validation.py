from src.compiler.models import SceneConfig

# Mock data based on sailboat
data = {
    "name": "Opening Scene",
    "duration_sec": 10,
    "layers": [
        {
            "sprite_name": "stars",
            "behaviors": [
                {"type": "background", "enabled": True, "scroll_speed": 0.0, "coordinate": "y"}
            ],
        },
        {
            "sprite_name": "boat",
            "environmental_reaction": {
                "reaction_type": "pivot_on_crest",
                "target_sprite_name": "wave1",
                "max_tilt_angle": 10.0,
                "vertical_follow_factor": 0.15,
                "tilt_lift_factor": 0.5,
            },
            "behaviors": [
                {
                    "type": "location",
                    "time_offset": 0,
                    "enabled": True,
                    "interpolate": False,
                    "x": 0,
                    "y": 0,
                    "vertical_percent": 0.69,
                }
            ],
            "visible": True,
        },
    ],
    "sounds": [],
}

try:
    print("Validating...")
    config = SceneConfig(**data)
    print("Success!")
    print(config.model_dump_json(indent=2))
except Exception as e:
    print(f"Validation Error: {e}")
