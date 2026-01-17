// ## @DOC
// # ### Audio Subsystem
// # Manages spatialized audio and event-based sound scheduling.
// # - **Asset Delivery**: Handles loading and caching of sound files from the backend.
// # - **Timeline Sync**: Schedules sound effects to trigger at specific timestamps in a scene.
// # - **Spatialization**: Future-ready hooks for volume and panning relative to camera position.
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

        return new Promise((resolve) => {
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
        for (const s of this.scheduled) {
            if (currentTime >= s.time && !s.played) {
                const timeDiff = currentTime - s.time;
                if (timeDiff < 0.2 || s.loop) {
                    this.play(s.name, s);
                }
                s.played = true;
            } else if (currentTime < s.time) {
                s.played = false;
            }
        }

        this.sounds.forEach(entry => {
            // Initialize pending fade
            if (entry._pendingFade) {
                entry.fadeStartTime = currentTime;
                entry.fadeTargetVolume = entry._pendingFade.volume;
                entry.fadeDuration = entry._pendingFade.duration;
                delete entry._pendingFade;
            }

            // Apply fade
            if (entry.fadeTargetVolume !== undefined && entry.fadeStartTime !== undefined) {
                const elapsed = currentTime - entry.fadeStartTime;
                if (elapsed >= entry.fadeDuration) {
                    entry.audio.volume = entry.fadeTargetVolume;
                    delete entry.fadeTargetVolume;
                    delete entry.fadeStartTime;
                    delete entry.fadeDuration;
                } else {
                    const progress = Math.max(0, elapsed / entry.fadeDuration);
                    entry.audio.volume = progress * entry.fadeTargetVolume;
                }
            }
        });
    }

    play(name, { volume = 1.0, loop = false, fade_in = 0, fade_out: _fade_out = 0 } = {}) {
        const entry = this.sounds.get(name);
        if (entry && entry.loaded) {
            const audio = entry.audio;
            audio.currentTime = 0;
            audio.loop = loop;

            if (fade_in > 0) {
                audio.volume = 0;
                entry._pendingFade = { volume, duration: fade_in };
            } else {
                audio.volume = volume;
                delete entry.fadeTargetVolume;
                delete entry.fadeStartTime;
                delete entry.fadeDuration;
                delete entry._pendingFade;
            }

            audio.play().catch(e => console.warn("Audio play failed (interaction needed?):", e));
        }
    }

    stopAll() {
        this.sounds.forEach(entry => {
            entry.audio.pause();
            entry.audio.currentTime = 0;
            delete entry.fadeTargetVolume;
            delete entry.fadeStartTime;
            delete entry.fadeDuration;
            delete entry._pendingFade;
        });
        // Reset state for scheduled items
        this.scheduled.forEach(s => s.played = false);
    }
}
