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
            getImageData: vi.fn(() => ({
                data: [255, 0, 0, 255],
                width: 1,
                height: 1
            }))
        })),
        width: 100,
        height: 100
    }))
};

describe('Layer Extended', () => {
    let mockImage;
    beforeEach(() => {
        mockImage = {
            width: 100,
            height: 100,
            naturalWidth: 100,
            naturalHeight: 100
        };
        vi.clearAllMocks();
    });

    describe('Additional Behavior Types', () => {
        it('applies Oscillate to X, SCALE, and ROTATION', () => {
            const configs = [
                { type: EventType.OSCILLATE, coordinate: CoordinateType.X, frequency: 1, amplitude: 10 },
                { type: EventType.OSCILLATE, coordinate: CoordinateType.SCALE, frequency: 1, amplitude: 10 },
                { type: EventType.OSCILLATE, coordinate: CoordinateType.ROTATION, frequency: 1, amplitude: 10 }
            ];

            configs.forEach(cfg => {
                const layer = new Layer({ behaviors: [cfg] }, mockImage);
                const tf = layer.getTransform(1000, 1000, 0.25, 0.25);
                if (cfg.coordinate === CoordinateType.X) expect(tf.x).toBeCloseTo(10, 4);
                if (cfg.coordinate === CoordinateType.SCALE) expect(tf.scale).toBeCloseTo(1.1, 4);
                if (cfg.coordinate === CoordinateType.ROTATION) expect(tf.rotation).toBeCloseTo(10, 4);
            });
        });

        it('applies Drift to X and SCALE', () => {
            const configs = [
                { type: EventType.DRIFT, coordinate: CoordinateType.X, velocity: 100 },
                { type: EventType.DRIFT, coordinate: CoordinateType.SCALE, velocity: 0.5 }
            ];

            configs.forEach(cfg => {
                const layer = new Layer({ behaviors: [cfg] }, mockImage);
                const tf = layer.getTransform(1000, 1000, 1.0, 1.0);
                if (cfg.coordinate === CoordinateType.X) expect(tf.x).toBe(100);
                if (cfg.coordinate === CoordinateType.SCALE) expect(tf.scale).toBe(1.5);
            });
        });

        it('applies Pulse with spike waveform and scale coordinate', () => {
            const behavior = {
                type: EventType.PULSE,
                frequency: 1,
                min_value: 0.5,
                max_value: 1.0,
                waveform: 'spike',
                coordinate: CoordinateType.SCALE
            };
            const layer = new Layer({ behaviors: [behavior] }, mockImage);

            // dt=0.75 -> cycle = 0.75, sin = -1, val = 0, final = 0.5
            const tf = layer.getTransform(1000, 1000, 0.75, 0.75);
            expect(tf.scale).toBeCloseTo(0.5, 4);
        });

        it('Pulse activation threshold', () => {
            const config = {
                behaviors: [{
                    type: EventType.PULSE,
                    frequency: 1,
                    min_value: 0.1,
                    coordinate: CoordinateType.OPACITY,
                    activation_threshold_scale: 0.5
                }],
                scale: 1.0
            };
            // Base scale 1.0 > 0.5, pulse should not apply
            const layer = new Layer(config, mockImage);
            const tf = layer.getTransform(1000, 1000, 0.5, 0.5);
            expect(tf.opacity).toBe(1.0);
        });
    });

    describe('Location Keyframes Extended', () => {
        it('interpolates vertical_percent', () => {
            const config = {
                behaviors: [
                    { type: EventType.LOCATION, time_offset: 0, vertical_percent: 0.0, interpolate: true },
                    { type: EventType.LOCATION, time_offset: 2, vertical_percent: 1.0, interpolate: true }
                ]
            };
            const layer = new Layer(config, mockImage);
            // t=1.0 (50%) -> vertical_percent=0.5
            // screenH=1000. baseY = 1000*0.5 - 50 = 450
            const tf = layer.getTransform(1000, 1000, 0, 1.0);
            expect(tf.base_y).toBe(450);
        });

        it('applies static location behavior (no time_offset)', () => {
            const config = {
                behaviors: [
                    { type: EventType.LOCATION, x: 50, y: 50 }
                ]
            };
            const layer = new Layer(config, mockImage);
            const tf = layer.getTransform(1000, 1000, 0, 0);
            expect(tf.x).toBe(50);
            expect(tf.y).toBe(50);
        });
    });

    describe('Rendering & Image Processing', () => {
        it('handles tile_border in image processing', () => {
            const _layer = new Layer({ tile_border: 10 }, mockImage);
            expect(global.document.createElement).toHaveBeenCalled();
            // Should have cropped by 20px (10 on each side)
        });

        it('handles target_height in dimensions', () => {
            const layer = new Layer({ target_height: 200 }, mockImage);
            const dims = layer._getBaseDimensions(1000);
            expect(dims.height).toBe(200);
            expect(dims.width).toBe(200); // aspect 1:1
        });

        it('handles vertical_anchor top/bottom', () => {
            const layerTop = new Layer({ vertical_anchor: 'top', vertical_percent: 0.1 }, mockImage);
            expect(layerTop._getBaseY(1000)).toBe(100);

            const layerBottom = new Layer({ vertical_anchor: 'bottom', vertical_percent: 0.9 }, mockImage);
            expect(layerBottom._getBaseY(1000)).toBe(800); // 900 - 100
        });

        it('draws background correctly', () => {
            const layer = new Layer({ is_background: true }, mockImage);
            const ctx = { drawImage: vi.fn() };
            layer.draw(ctx, 1000, 1000, 0, 0, 0);
            expect(ctx.drawImage).toHaveBeenCalled();
        });

        it('draws with rotation and tiling/fill_down', () => {
            const layer = new Layer({
                tile_horizontal: true,
                fill_down: true,
                behaviors: [{ type: EventType.OSCILLATE, coordinate: CoordinateType.ROTATION, frequency: 1, amplitude: 45 }]
            }, mockImage);
            const ctx = {
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                rotate: vi.fn(),
                drawImage: vi.fn(),
                fillRect: vi.fn()
            };
            // t=0.25 -> rotation=45
            layer.draw(ctx, 1000, 1000, 0, 0.25, 0.25);
            expect(ctx.rotate).toHaveBeenCalled();
            expect(ctx.fillRect).toHaveBeenCalled();
        });

        it('applies transparency when selected (Rule 1b)', () => {
            const layer = new Layer({
                fill_down: true
            }, mockImage);
            layer.isSelected = true; // Selected sprite
            layer.processedImage = { width: 100, height: 100 };
            layer.fillColor = 'rgba(0,0,0,1)';

            const ctx = {
                drawImage: vi.fn(),
                fillRect: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                rotate: vi.fn(),
                stroke: vi.fn(),
                _globalAlpha: 1.0,
                set globalAlpha(v) { this._globalAlpha = v; },
                get globalAlpha() { return this._globalAlpha; },
                set fillStyle(v) { },
                set strokeStyle(v) { },
                set lineWidth(v) { },
                set filter(v) { },
                setLineDash: vi.fn(),
                strokeRect: vi.fn(),
                beginPath: vi.fn(),
                arc: vi.fn(),
                fill: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn()
            };

            const alphaSpy = vi.spyOn(ctx, 'globalAlpha', 'set');

            layer.draw(ctx, 1000, 1000, 0, 0, 0);

            // Rule 1b:
            // 1. fillRect SHOULD be called (fill_down remains active)
            expect(ctx.fillRect).toHaveBeenCalled();

            // 2. Global alpha should have been set to 0.2 at some point
            expect(alphaSpy).toHaveBeenCalledWith(0.2);

            // 3. Global alpha should be reset to 1.0 at the end
            expect(ctx.globalAlpha).toBe(1.0);
        });

        it('draws with selection highlight', () => {
            const layer = new Layer({ tile_horizontal: true }, mockImage);
            layer.isSelected = true;
            const ctx = {
                drawImage: vi.fn(),
                strokeRect: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                rotate: vi.fn(),
                beginPath: vi.fn(),
                arc: vi.fn(),
                stroke: vi.fn(),
                set strokeStyle(v) { },
                set lineWidth(v) { },
                set globalAlpha(v) { },
                set fillStyle(v) { },
                set filter(v) { },
                setLineDash: vi.fn(),

                fill: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn()
            };
            layer.draw(ctx, 1000, 1000, 0, 0, 0, null, true);
            expect(ctx.strokeRect).toHaveBeenCalled();
        });

        it('setPosition updates offsets', () => {
            const layer = new Layer({}, mockImage);
            layer.setPosition(123, 456);
            expect(layer.x_offset).toBe(123);
            expect(layer.y_offset).toBe(456);
        });
    });

    describe('Legacy & Edge Cases', () => {
        it('handles missing image in containsPoint', () => {
            const layer = new Layer({}, null);
            expect(layer.containsPoint(0, 0, 1000, 1000, 0)).toBe(false);
        });

        it('Background behavior sets is_background and scroll_speed', () => {
            const layer = new Layer({ behaviors: [{ type: EventType.BACKGROUND, scroll_speed: 2.0 }] }, mockImage);
            expect(layer.is_background).toBe(true);
            expect(layer.scroll_speed).toBe(2.0);
        });
    });
});
