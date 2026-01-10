import { describe, it, expect, beforeEach } from 'vitest';
import { AudioManager } from '../AudioManager.js';

describe('AudioManager', () => {
    let audioManager;

    beforeEach(() => {
        audioManager = new AudioManager();
    });

    describe('constructor', () => {
        it('initializes with empty sounds map', () => {
            expect(audioManager.sounds.size).toBe(0);
        });

        it('initializes with empty scheduled array', () => {
            expect(audioManager.scheduled).toEqual([]);
        });

        it('sets default base path', () => {
            expect(audioManager.basePath).toBe('/assets/sounds/');
        });
    });

    describe('setBasePath', () => {
        it('updates the base path', () => {
            audioManager.setBasePath('/custom/path/');
            expect(audioManager.basePath).toBe('/custom/path/');
        });
    });

    describe('scheduleAt', () => {
        it('adds event to scheduled array', () => {
            audioManager.scheduleAt('test', 5.0, { volume: 0.8 });
            expect(audioManager.scheduled).toHaveLength(1);
            expect(audioManager.scheduled[0]).toMatchObject({
                name: 'test',
                time: 5.0,
                volume: 0.8,
                played: false
            });
        });

        it('sorts scheduled events by time', () => {
            audioManager.scheduleAt('b', 10.0);
            audioManager.scheduleAt('a', 2.0);
            audioManager.scheduleAt('c', 5.0);

            expect(audioManager.scheduled[0].name).toBe('a');
            expect(audioManager.scheduled[1].name).toBe('c');
            expect(audioManager.scheduled[2].name).toBe('b');
        });

        it('sets played to false by default', () => {
            audioManager.scheduleAt('test', 5.0);
            expect(audioManager.scheduled[0].played).toBe(false);
        });
    });

    describe('resetSchedule', () => {
        it('clears scheduled array', () => {
            audioManager.scheduleAt('test', 5.0);
            audioManager.scheduleAt('test2', 10.0);
            audioManager.resetSchedule();
            expect(audioManager.scheduled).toEqual([]);
        });
    });

    describe('play', () => {
        it('does nothing for unknown sound (no error)', () => {
            // Should not throw
            expect(() => audioManager.play('unknown')).not.toThrow();
        });
    });

    describe('stopAll', () => {
        it('resets played flags on scheduled events', () => {
            audioManager.scheduleAt('test1', 5.0);
            audioManager.scheduled[0].played = true;

            audioManager.stopAll();
            expect(audioManager.scheduled[0].played).toBe(false);
        });

        it('handles empty sounds map', () => {
            expect(() => audioManager.stopAll()).not.toThrow();
        });
    });

    describe('update', () => {
        it('handles empty schedule', () => {
            expect(() => audioManager.update(5.0)).not.toThrow();
        });

        it('marks event as played when time passes (no audio loaded)', () => {
            audioManager.scheduleAt('test', 5.0);
            audioManager.update(5.05);
            // Event marked played even if audio not loaded
            expect(audioManager.scheduled[0].played).toBe(true);
        });

        it('resets played flag when scrubbing back', () => {
            audioManager.scheduleAt('test', 5.0);
            audioManager.update(5.05);
            expect(audioManager.scheduled[0].played).toBe(true);

            audioManager.update(4.0);
            expect(audioManager.scheduled[0].played).toBe(false);
        });
    });
});
