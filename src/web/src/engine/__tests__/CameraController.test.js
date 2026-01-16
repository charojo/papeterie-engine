import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraController } from '../CameraController.js';

describe('CameraController', () => {
    let controller;
    let mockTheatre;

    // Suppress expected validation errors and warnings
    const originalError = console.error;
    const originalWarn = console.warn;
    beforeEach(() => {
        console.error = vi.fn();
        console.warn = vi.fn();
        mockTheatre = {
            cameraZoom: 1.0,
            cameraPanX: 0,
            cameraPanY: 0
        };
        controller = new CameraController(mockTheatre);
    });

    afterEach(() => {
        console.error = originalError;
        console.warn = originalWarn;
    });

    describe('initialization', () => {
        it('initializes with default values', () => {
            expect(controller.zoom).toBe(1.0);
            expect(controller.panX).toBe(0);
            expect(controller.panY).toBe(0);
        });

        it('returns state object', () => {
            const state = controller.state;
            expect(state).toEqual({
                zoom: 1.0,
                pan: { x: 0, y: 0 }
            });
        });
    });

    describe('setZoom', () => {
        it('sets valid zoom values', () => {
            controller.setZoom(2.0);
            expect(controller.zoom).toBe(2.0);
        });

        it('clamps zoom to min/max bounds', () => {
            controller.setZoom(0.01);
            expect(controller.zoom).toBe(0.05); // minZoom

            controller.setZoom(100);
            expect(controller.zoom).toBe(20); // maxZoom
        });

        it('throws on NaN zoom', () => {
            expect(() => controller.setZoom(NaN)).toThrow('Invalid zoom');
        });

        it('throws on negative zoom', () => {
            expect(() => controller.setZoom(-1)).toThrow('Invalid zoom');
        });

        it('throws on Infinity zoom', () => {
            expect(() => controller.setZoom(Infinity)).toThrow('Invalid zoom');
        });

        it('syncs to Theatre', () => {
            controller.setZoom(1.5);
            expect(mockTheatre.cameraZoom).toBe(1.5);
        });
    });

    describe('setPan', () => {
        it('sets valid pan values', () => {
            controller.setPan(100, 200);
            expect(controller.panX).toBe(100);
            expect(controller.panY).toBe(200);
        });

        it('throws on NaN pan', () => {
            expect(() => controller.setPan(NaN, 0)).toThrow('Invalid pan');
            expect(() => controller.setPan(0, NaN)).toThrow('Invalid pan');
        });

        it('syncs to Theatre', () => {
            controller.setPan(50, 75);
            expect(mockTheatre.cameraPanX).toBe(50);
            expect(mockTheatre.cameraPanY).toBe(75);
        });
    });

    describe('pan (relative)', () => {
        it('applies relative pan delta', () => {
            controller.pan(10, 20);
            // At zoom 1.0, delta is applied directly (inverted)
            expect(controller.panX).toBe(-10);
            expect(controller.panY).toBe(-20);
        });

        it('scales delta by zoom factor', () => {
            controller.setZoom(2.0);
            controller.pan(20, 40);
            // At zoom 2.0, delta is halved
            expect(controller.panX).toBe(-10);
            expect(controller.panY).toBe(-20);
        });

        it('ignores NaN deltas gracefully', () => {
            controller.pan(NaN, 10);
            expect(controller.panX).toBe(0); // Should not change
        });
    });

    describe('reset', () => {
        it('resets to default values', () => {
            controller.setZoom(2.0);
            controller.setPan(100, 200);
            controller.reset();

            expect(controller.zoom).toBe(1.0);
            expect(controller.panX).toBe(0);
            expect(controller.panY).toBe(0);
        });
    });

    describe('subscribe', () => {
        it('notifies listeners on change', () => {
            const listener = vi.fn();
            controller.subscribe(listener);

            controller.setZoom(1.5);
            expect(listener).toHaveBeenCalledWith({
                zoom: 1.5,
                pan: { x: 0, y: 0 }
            });
        });

        it('returns unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = controller.subscribe(listener);

            unsubscribe();
            controller.setZoom(2.0);

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('pivot zoom', () => {
        it('maintains world position under anchor when zooming', () => {
            const rect = { width: 1920, height: 1080 };
            const anchorX = 960; // Center
            const anchorY = 540;

            // Zoom in at center - pan should stay at 0
            controller.setZoom(2.0, anchorX, anchorY, rect);

            expect(controller.zoom).toBe(2.0);
            // When zooming at center, pan should be close to 0
            expect(Math.abs(controller.panX)).toBeLessThan(1);
            expect(Math.abs(controller.panY)).toBeLessThan(1);
        });
    });

    describe('static factory', () => {
        it('creates and binds to Theatre', () => {
            const theatre = { cameraZoom: 0, cameraPanX: 0, cameraPanY: 0 };
            const ctrl = CameraController.forTheatre(theatre);

            expect(ctrl.theatre).toBe(theatre);
            expect(theatre.cameraZoom).toBe(1.0);
        });
    });
});
