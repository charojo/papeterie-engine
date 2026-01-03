import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Layer, EventType, CoordinateType } from '../Layer';

// Mock canvas and ImageData
global.document = {
    createElement: vi.fn(() => ({
        getContext: vi.fn(() => ({
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            fillRect: vi.fn(),
            getImageData: vi.fn((x, y, w, h) => {
                // Create a mock wave: top at y=10
                const data = new Uint8ClampedArray(w * h * 4);
                // Fill with transparent by default
                // Fill bottom half with opaque
                for (let row = 0; row < h; row++) {
                    for (let col = 0; col < w; col++) {
                        if (row >= 10) {
                            data[(row * w + col) * 4 + 3] = 255;
                        } else {
                            data[(row * w + col) * 4 + 3] = 0;
                        }
                    }
                }
                return { data, width: w, height: h };
            })
        })),
        width: 100,
        height: 100
    }))
};

describe('Layer', () => {
    let mockImage;
    beforeEach(() => {
        mockImage = {
            width: 100,
            height: 100,
            naturalWidth: 100,
            naturalHeight: 100
        };
    });

    describe('Initialization', () => {
        it('calculates _getBaseY correctly for center anchor', () => {
            const layer = new Layer({ vertical_percent: 0.5 }, mockImage);
            expect(layer._getBaseY(1000)).toBe(450); // (0.5 * 1000) - (100 / 2)
        });

        it('calculates _getBaseY correctly with height_scale', () => {
            const layer = new Layer({ vertical_percent: 0.5, height_scale: 0.2 }, mockImage);
            // imgH = 1000 * 0.2 = 200
            // baseY = 1000 * 0.5 = 500
            // return 500 - (200 / 2) = 400
            expect(layer._getBaseY(1000)).toBe(400);
        });

        it('migrates legacy config to events', () => {
            const config = {
                bob_frequency: 2.0,
                bob_amplitude: 10.0,
                vertical_drift: 5.0,
                twinkle_amplitude: 0.5,
                twinkle_frequency: 1.0,
                twinkle_min_scale: 0.8
            };
            const layer = new Layer(config, mockImage);
            expect(layer.eventRuntimes.length).toBe(3); // Oscillate, Drift, Pulse

            // Verify Oscillate
            const osc = layer.eventRuntimes.find(r => r.constructor.name === 'OscillateRuntime');
            expect(osc).toBeDefined();
            expect(osc.config.frequency).toBe(2.0);

            // Verify Drift
            const drift = layer.eventRuntimes.find(r => r.constructor.name === 'DriftRuntime');
            expect(drift).toBeDefined();
            expect(drift.config.velocity).toBe(5.0);

            // Verify Pulse
            const pulse = layer.eventRuntimes.find(r => r.constructor.name === 'PulseRuntime');
            expect(pulse).toBeDefined();
            expect(pulse.config.min_value).toBe(0.5); // 1.0 - 0.5
        });
    });

    describe('Event Runtimes', () => {
        it('applies Oscillate behavior', () => {
            const config = {
                behaviors: [{
                    type: EventType.OSCILLATE,
                    frequency: 1.0,
                    amplitude: 10.0,
                    coordinate: CoordinateType.Y
                }]
            };
            const layer = new Layer(config, mockImage);

            // at t=0.25s (1/4 cycle), sin should be 1.0 * amplitude
            const tf = layer.getTransform(1000, 0.25, 0.25); // dt, elapsed
            // Note: Our implementation increments timeAccum by dt.
            // But getTransform logic calls runtime.apply(this, dt, transform).
            // OscillateRuntime uses this.timeAccum += dt.
            // So if we pass dt=0.25, timeAccum becomes 0.25.

            // Base Y (center) = 500 - 50 = 450
            // Offset = sin(0.25 * 1 * 2pi) * 10 = sin(pi/2) * 10 = 10
            expect(tf.y).toBeCloseTo(10.0, 4);
        });

        it('applies Drift behavior with Cap', () => {
            const config = {
                behaviors: [{
                    type: EventType.DRIFT,
                    velocity: 100.0,
                    coordinate: CoordinateType.Y
                }]
            };
            const layer = new Layer(config, mockImage);

            // 1 second => +100 drift
            const tf = layer.getTransform(1000, 1.0);

            expect(tf.y).toBe(100.0);
        });

        it('applies Pulse behavior (opacity)', () => {
            const config = {
                behaviors: [{
                    type: EventType.PULSE,
                    frequency: 1.0,
                    min_value: 0.5,
                    max_value: 1.0,
                    coordinate: CoordinateType.OPACITY
                }]
            };
            const layer = new Layer(config, mockImage);

            // t = 0.5s -> cycle = 0.5 -> sin(pi) = 0?
            // Pulse logic: value = (sin(cycle * 2pi) + 1)/2
            // t=0.0 -> sin(0)=0 -> val=0.5 -> final=0.5 + 0.5(0.5) = 0.75?
            // Wait, (0 + 1)/2 = 0.5.
            // finalVal = min + (0.5 * (max-min)) = 0.5 + 0.25 = 0.75

            // t=0.25 -> sin(pi/2)=1 -> val=1.0 -> final=0.5 + 0.5 = 1.0
            // t=0.75 -> sin(3pi/2)=-1 -> val=0 -> final=0.5 + 0 = 0.5

            const tf = layer.getTransform(1000, 0.75);
            expect(tf.opacity).toBeCloseTo(0.5, 4);
        });
    });

    describe('Location Interpolation', () => {
        it('interpolates between keyframes', () => {
            const config = {
                behaviors: [
                    { type: 'location', time_offset: 0, x: 0, y: 0, interpolate: true },
                    { type: 'location', time_offset: 2, x: 100, y: 100, interpolate: true }
                ]
            };
            const layer = new Layer(config, mockImage);

            // at t=1.0 (50%)
            const tf = layer.getTransform(1000, 0.0, 1.0);
            expect(tf.x).toBeCloseTo(50.0);
            expect(tf.y).toBeCloseTo(50.0);
        });

        it('holds last keyframe value after time passes', () => {
            const config = {
                behaviors: [
                    { type: 'location', time_offset: 0, x: 0, y: 0 },
                    { type: 'location', time_offset: 2, x: 100, y: 100 }
                ]
            };
            const layer = new Layer(config, mockImage);

            // at t=3.0
            const tf = layer.getTransform(1000, 0.0, 3.0);
            expect(tf.x).toBeCloseTo(100.0);
        });
    });

    describe('Interaction & Hit Testing', () => {
        it('samples Y-at-X accurately with scaling', () => {
            const layer = new Layer({
                vertical_percent: 0.5,
                height_scale: 1.0, // imgH = screenH
                y_offset: 100
            }, mockImage);

            // baseY = (0.5 * 1000) - (1000 / 2) = 0
            // from static logic, x_offset is 0 from config
            const y = layer.getYAtX(1000, 0, 50, 0);
            expect(y).toBe(200);
        });

        it('containsPoint returns true for hit', () => {
            // For drawX = ((scrollOffset) % wrapW) - imgW to put image at X=50
            // screenW=1000, imgW=100 -> wrapW=1100.
            // (scrollOffset % 1100) - 100 = 50 => scrollOffset % 1100 = 150.
            // So x_offset should be 150.
            const layer = new Layer({ x_offset: 150, y_offset: 50 }, mockImage);
            // BaseY = 450. Y Offset = 50 -> 500.
            // Img w=100, h=100.
            // Rect: x=[50, 150], y=[500, 600]

            // Point inside
            expect(layer.containsPoint(100, 550, 1000, 1000, 0)).toBe(true);
            // Point outside
            expect(layer.containsPoint(10, 550, 1000, 1000, 0)).toBe(false);
        });

        it('handles tiling in containsPoint', () => {
            const layer = new Layer({ tile_horizontal: true, y_offset: 0 }, mockImage);
            // BaseY = 450.
            // Tiled horizontally repeatedly.

            // x=50 (1st tile)
            expect(layer.containsPoint(50, 480, 1000, 1000, 0)).toBe(true);
            // x=150 (2nd tile)
            expect(layer.containsPoint(150, 480, 1000, 1000, 0)).toBe(true);
        });
    });

    describe('Environmental Reaction (Draw)', () => {
        it('handles tilt_lift_factor in draw', () => {
            const boatLayer = new Layer({
                sprite_name: 'boat',
                vertical_percent: 0.5,
                environmental_reaction: {
                    reaction_type: 'pivot_on_crest',
                    target_sprite_name: 'wave1',
                    vertical_follow_factor: 1.0,
                    tilt_lift_factor: 2.0
                }
            }, mockImage);

            const envLayer = {
                getYAtX: vi.fn(() => 500)
            };

            const ctx = {
                drawImage: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                rotate: vi.fn(),
                fillRect: vi.fn()
            };

            // First draw to initialize tilt
            boatLayer.draw(ctx, 1000, 1000, 0, 0, null, envLayer);

            // Mock a tilt change
            boatLayer.currentTilt = 10;

            // Draw again
            boatLayer.draw(ctx, 1000, 1000, 0, 0.016, null, envLayer);

            // desiredY = 500 + 0 - (100 * (1 - 1)) = 500
            // lift = 10 * 2.0 = 20
            // desiredY = 500 - 20 = 480
            // Smoothing moves towards 480.
            expect(boatLayer._currentYPhys).toBeLessThan(500);
        });
    });
});
