export class AudioManager {
    constructor() {
        this.sounds = new Map(); // name -> { audio: HTMLAudioElement, loaded: boolean }
        this.scheduled = [];     // { name, time, ...options, played: boolean }
        this.basePath = '/assets/sounds/';
    }

    setBasePath(path) {
        this.basePath = path;
    }

    async loadSound(name, filename) {
        if (this.sounds.has(name)) return;

        return new Promise((resolve, reject) => {
            const audio = new Audio(`${this.basePath}${filename}`);
            const soundEntry = { audio, loaded: false };
            this.sounds.set(name, soundEntry);

            audio.addEventListener('canplaythrough', () => {
                soundEntry.loaded = true;
                resolve();
            }, { once: true });

            audio.addEventListener('error', (e) => {
                console.warn(`Failed to load sound: ${filename}`, e);
                // resolve anyway to not block
                resolve();
            }, { once: true });
        });
    }

    resetSchedule() {
        this.scheduled = [];
        // Also stop all currently playing sounds
        this.stopAll();
    }

    scheduleAt(name, time, options = {}) {
        this.scheduled.push({ name, time, ...options, played: false });
        // Sort by time
        this.scheduled.sort((a, b) => a.time - b.time);
    }

    update(currentTime) {
        // Find events that haven't been played and are due
        // We iterate through all ensuring we don't miss any if we jumped frames
        // But for "events", we might need a "just happened" check if seeking backwards.
        // For now, simple forward playback logic:

        for (const s of this.scheduled) {
            if (currentTime >= s.time && !s.played) {
                // If we are *way* past the time (e.g. initial load or seek), 
                // we might want to skip or play only if within a window.
                // For now, let's play if within 100ms or if it's a loop.
                const timeDiff = currentTime - s.time;

                if (timeDiff < 0.2 || s.loop) {
                    this.play(s.name, s);
                }

                s.played = true;
            } else if (currentTime < s.time) {
                // Since sorted, we can break early? 
                // No, just in case unsorted edits happen, safe to iterate or ensure sort.
                s.played = false; // Reset if we scrubbed back
            }
        }
    }

    play(name, { volume = 1.0, loop = false, fade_in = 0, fade_out = 0 } = {}) {
        const entry = this.sounds.get(name);
        if (entry && entry.loaded) {
            const audio = entry.audio;
            audio.currentTime = 0;
            audio.volume = volume; // TODO: Implement fade_in
            audio.loop = loop;

            // Simple fade in logic could go here or in update loop
            // For MVP, just direct play
            audio.play().catch(e => console.warn("Audio play failed (interaction needed?):", e));
        }
    }

    stopAll() {
        this.sounds.forEach(entry => {
            entry.audio.pause();
            entry.audio.currentTime = 0;
        });
        // Reset state for scheduled items
        this.scheduled.forEach(s => s.played = false);
    }
}
