import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Layer } from '../Layer';

// Mock canvas and ImageData
global.document = {
    createElement: vi.fn(() => ({
        getContext: vi.fn(() => ({
            drawImage: vi.fn(),
            getImageData: vi.fn((x, y, w, h) => {
                // Create a mock wave: top at y=10
                const data = new Uint8ClampedArray(w * h * 4);
                for (let row = 10; row < h; row++) {
                    for (let col = 0; col < w; col++) {
                        data[(row * w + col) * 4 + 3] = 255;
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

    it('samples Y-at-X accurately with scaling', () => {
        const layer = new Layer({
            vertical_percent: 0.5,
            height_scale: 1.0, // imgH = screenH
            y_offset: 100
        }, mockImage);

        // baseY = (0.5 * 1000) - (1000 / 2) = 0
        // baseY + y_offset = 100
        // Mock image has top at y=10 (in local pixels)
        // Ratio = 1000 / 100 = 10
        // foundY = (baseY + y_offset) + (y_local * ratio) = 100 + (10 * 10) = 200

        const y = layer.getYAtX(1000, 0, 50, 0);
        expect(y).toBe(200);
    });

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
        boatLayer.draw(ctx, 1000, 1000, 10, 0, null, envLayer);

        // desiredY = 500 + 0 - (100 * (1 - 1)) = 500
        // lift = 10 * 2.0 = 20
        // desiredY = 500 - 18 = 482
        // Since smoothing is 0.1, it moves from 455 towards 482.
        // nextValue = 455 + (482 - 455) * 0.1 = 457.7
        expect(boatLayer._currentYPhys).toBeCloseTo(457.7, 1);
    });
});
