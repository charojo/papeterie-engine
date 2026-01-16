import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebugRenderer } from '../DebugRenderer';
import { ThemeManager } from '../ThemeManager';

// Mock ThemeManager
vi.mock('../ThemeManager', () => ({
    ThemeManager: {
        theme: {
            bgSurfaceGlass: '#ffffff',
            selectionAccent: '#00ccff',
            textMuted: '#999999',
            primary: '#ff00ff',
            textMain: '#000000',
            bgBase: '#ffffff',
            danger: '#ff0000',
            textOnPrimary: '#ffffff'
        }
    }
}));

describe('DebugRenderer', () => {
    let debugRenderer;
    let ctx;
    let canvasWidth = 800;
    let canvasHeight = 600;

    beforeEach(() => {
        debugRenderer = new DebugRenderer();
        ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            setTransform: vi.fn(),
            fillStyle: '',
            fillRect: vi.fn(),
            font: '',
            textBaseline: '',
            fillText: vi.fn(),
            measureText: vi.fn(() => ({ width: 50 })),
            strokeStyle: '',
            lineWidth: 0,
            beginPath: vi.fn(),
            arc: vi.fn(),
            stroke: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            fill: vi.fn()
        };
    });

    describe('drawOverlay', () => {
        it('draws debug info', () => {
            const state = {
                layers: [{}, {}],
                cameraZoom: 1.5,
                cameraPanX: 10,
                cameraPanY: 20,
                mouseX: 100,
                mouseY: 200,
                scroll: 500,
                elapsedTime: 12.34,
                dt: 0.016
            };

            debugRenderer.drawOverlay(ctx, canvasWidth, canvasHeight, state);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
            expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('FPS:'), expect.any(Number), expect.any(Number));
            expect(ctx.restore).toHaveBeenCalled();
        });
    });

    describe('checkOcclusion', () => {
        let selectedLayer;
        let otherLayer;
        let layers;

        beforeEach(() => {
            // Mock Layer (Simplified)
            const createLayer = (name, z, x, y, w, h) => ({
                config: { sprite_name: name },
                z_depth: z,
                visible: true,
                x_offset: x,
                y_offset: y,
                scroll_speed: 0, // Simplified
                getTransform: vi.fn(() => ({ x: 0, y: 0, scale: 1, rotation: 0, base_x: 0, base_y: 0 })),
                _getBaseDimensions: vi.fn(() => ({ width: w, height: h })),
                _currentYPhys: y
            });

            selectedLayer = createLayer('selected', 1, 100, 100, 50, 50); // z=1, pos(100,100), size(50x50)
            otherLayer = createLayer('overlay', 5, 100, 100, 50, 50); // z=5, same pos/size
            layers = [selectedLayer, otherLayer];
        });

        it('returns true when occluded by higher z-layer', () => {
            // Exact overlap, other is z=5, selected is z=1
            const result = debugRenderer.checkOcclusion(selectedLayer, layers, canvasWidth, canvasHeight, 0, 0);
            expect(result).toBe(true);
        });

        it('returns false when occluding layer is invisible', () => {
            otherLayer.visible = false;
            const result = debugRenderer.checkOcclusion(selectedLayer, layers, canvasWidth, canvasHeight, 0, 0);
            expect(result).toBe(false);
        });

        it('returns false when other layer has lower z-depth', () => {
            otherLayer.z_depth = 0;
            const result = debugRenderer.checkOcclusion(selectedLayer, layers, canvasWidth, canvasHeight, 0, 0);
            expect(result).toBe(false);
        });

        it('returns false when no overlap', () => {
            otherLayer.x_offset = 200; // Move away
            const result = debugRenderer.checkOcclusion(selectedLayer, layers, canvasWidth, canvasHeight, 0, 0);
            expect(result).toBe(false);
        });

        it('returns false if layers comparison is exact object equality', () => {
            // Testing the "other === selectedLayer" check
            const result = debugRenderer.checkOcclusion(selectedLayer, [selectedLayer], canvasWidth, canvasHeight, 0, 0);
            expect(result).toBe(false);
        });
    });

    describe('drawInteractionDebug', () => {
        it('draws debug visuals', () => {
            const data = {
                xStern: 10, yStern: 10, xBow: 20, yBow: 20,
                objSternX: 10, objSternY: 15, objBowX: 20, objBowY: 25,
                centerX: 15, targetEnvY: 20, tilt: 5, targetTilt: 6
            };
            const cameraZoom = 2;

            debugRenderer.drawInteractionDebug(ctx, data, cameraZoom);

            expect(ctx.save).toHaveBeenCalled();
            // Should draw 2 pairs of dots + lines, so multiple calls
            expect(ctx.beginPath).toHaveBeenCalled();
            expect(ctx.moveTo).toHaveBeenCalled();
            expect(ctx.lineTo).toHaveBeenCalled();
            expect(ctx.stroke).toHaveBeenCalled();
            expect(ctx.arc).toHaveBeenCalled();
            expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('Tilt:'), expect.any(Number), expect.any(Number));
            expect(ctx.restore).toHaveBeenCalled();
        });
    });
});
