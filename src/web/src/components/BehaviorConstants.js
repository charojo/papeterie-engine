export const BehaviorTypes = {
    OSCILLATE: "oscillate",
    DRIFT: "drift",
    PULSE: "pulse",
    BACKGROUND: "background",
    LOCATION: "location",
    SOUND: "sound"
};

export const CoordinateTypes = ["y", "x", "scale", "rotation", "opacity"];

export function createDefaultBehavior(type) {
    if (type === BehaviorTypes.OSCILLATE) {
        return { type, enabled: true, frequency: 1.0, amplitude: 10, coordinate: "y", phase_offset: 0 };
    } else if (type === BehaviorTypes.DRIFT) {
        return { type, enabled: true, velocity: 10, coordinate: "y", drift_cap: null };
    } else if (type === BehaviorTypes.PULSE) {
        return { type, enabled: true, frequency: 1.0, min_value: 0.5, max_value: 1.0, coordinate: "opacity", waveform: "sine" };
    } else if (type === BehaviorTypes.BACKGROUND) {
        return { type, enabled: true, scroll_speed: 0.0, coordinate: "y" };
    } else if (type === BehaviorTypes.LOCATION) {
        return { type, enabled: true, x: 0, y: 0 };
    } else if (type === BehaviorTypes.SOUND) {
        return { type, enabled: true, sound_file: "splash.mp3", volume: 1.0, time_offset: 0 };
    }
    return { type, enabled: true };
}
