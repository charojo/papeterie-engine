import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Theatre } from '../Theatre';

// Mock Layer class
vi.mock('../Layer', () => {
    return {
        Layer: class MockLayer {
            constructor(config, image) {
                this.config = config;
                this.image = image;
                this.z_depth = config.z_depth || 5;
                this.visible = true;
                this.isSelected = false;
                this.x_offset = config.x_offset || 0;
                this.y_offset = config.y_offset || 0;
                this.currentTilt = 0;
                this.environmental_reaction = config.environmental_reaction || null;
                this._currentYPhys = 500;
                this._currentXPhys = 0;
                this.lastDrawnX = 0;
            }

            draw = vi.fn();
            _getBaseY = vi.fn(() => 500);
            containsPoint = vi.fn(() => false);
            setPosition = vi.fn(function (x, y) {
                this.x_offset = x;
                this.y_offset = y;
            });
        }
    };
});

describe('Theatre', () => {
    let canvas;
    let ctx;
    let theatre;
    let sceneData;

    beforeEach(() => {
        // Mock canvas
        ctx = {
            fillStyle: '',
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            fillText: vi.fn(),
            strokeStyle: '',
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            font: ''
        };

        canvas = {
            getContext: vi.fn(() => ctx),
            width: 1920,
            height: 1080
        };

        sceneData = {
            name: 'test_scene',
            layers: [
                {
                    sprite_name: 'background',
                    z_depth: 1,
                    x_offset: 0,
                    y_offset: 0
                },
                {
                    sprite_name: 'boat',
                    z_depth: 5,
                    x_offset: 100,
                    y_offset: 50
                }
            ]
        };

        // Mock global fetch
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false
            })
        );

        // Mock Image
        global.Image = class {
            constructor() {
                this.crossOrigin = '';
                this.onload = null;
                this.onerror = null;
                this._src = '';
            }
            set src(value) {
                this._src = value;
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            }
            get src() {
                return this._src;
            }
        };

        // Mock requestAnimationFrame
        global.requestAnimationFrame = vi.fn((cb) => {
            setTimeout(() => cb(performance.now()), 16);
            return 123;
        });

        global.cancelAnimationFrame = vi.fn();

        theatre = new Theatre(canvas, sceneData, 'test_scene');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('initializes with correct properties', () => {
            expect(theatre.canvas).toBe(canvas);
            expect(theatre.ctx).toBe(ctx);
            expect(theatre.sceneData).toBe(sceneData);
            expect(theatre.sceneName).toBe('test_scene');
            expect(theatre.layers).toEqual([]);
            expect(theatre.scroll).toBe(0);
            expect(theatre.elapsedTime).toBe(0);
            expect(theatre.isRunning).toBe(false);
        });

        it('initializes interaction state', () => {
            expect(theatre.selectedSprite).toBeNull();
            expect(theatre.isDragging).toBe(false);
            expect(theatre.dragStartX).toBe(0);
            expect(theatre.dragStartY).toBe(0);
        });
    });

    describe('initialize', () => {
        it('loads layers from scene data', async () => {
            await theatre.initialize();

            expect(theatre.layers.length).toBe(2);
            // Verify layers were created (Layer mock is called internally)
        });

        it('sorts layers by z_depth', async () => {
            await theatre.initialize();

            expect(theatre.layers[0].z_depth).toBeLessThanOrEqual(theatre.layers[1].z_depth);
        });

        it('creates layersByName index', async () => {
            await theatre.initialize();

            expect(theatre.layersByName.size).toBe(2);
            expect(theatre.layersByName.has('background')).toBe(true);
            expect(theatre.layersByName.has('boat')).toBe(true);
        });

        it('filters out null layers', async () => {
            sceneData.layers.push({ sprite_name: null });
            await theatre.initialize();

            expect(theatre.layers.length).toBe(2);
        });
    });

    describe('start and stop', () => {
        it('starts the animation loop', () => {
            theatre.start();

            expect(theatre.isRunning).toBe(true);
            expect(global.requestAnimationFrame).toHaveBeenCalled();
        });

        it('does not start if already running', () => {
            theatre.start();
            const callCount = global.requestAnimationFrame.mock.calls.length;
            theatre.start();

            expect(global.requestAnimationFrame.mock.calls.length).toBe(callCount);
        });

        it('stops the animation loop', () => {
            theatre.start();
            theatre.stop();

            expect(theatre.isRunning).toBe(false);
            expect(global.cancelAnimationFrame).toHaveBeenCalled();
        });
    });

    describe('updateAndDraw', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('clears the canvas', () => {
            theatre.updateAndDraw(0.016);

            expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
        });

        it('draws all layers', () => {
            theatre.updateAndDraw(0.016);

            theatre.layers.forEach(layer => {
                expect(layer.draw).toHaveBeenCalled();
            });
        });

        it('calls onTelemetry callback if set', () => {
            const telemetryCallback = vi.fn();
            theatre.onTelemetry = telemetryCallback;

            theatre.updateAndDraw(0.016);

            expect(telemetryCallback).toHaveBeenCalled();
            const telemetry = telemetryCallback.mock.calls[0][0];
            expect(telemetry).toHaveLength(2);
            expect(telemetry[0].name).toBe('background');
        });

        it('draws debug overlay when debugMode is enabled', () => {
            theatre.debugMode = true;
            theatre.mouseX = 100;
            theatre.mouseY = 200;

            theatre.updateAndDraw(0.016);

            expect(ctx.fillText).toHaveBeenCalled();
        });
    });

    describe('setLayerVisibility', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('sets layer visibility by name', () => {
            theatre.setLayerVisibility('boat', false);

            const boatLayer = theatre.layersByName.get('boat');
            expect(boatLayer.visible).toBe(false);
        });

        it('handles non-existent layer gracefully', () => {
            expect(() => {
                theatre.setLayerVisibility('nonexistent', false);
            }).not.toThrow();
        });
    });

    describe('sprite selection', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('selects a sprite by name', () => {
            const callback = vi.fn();
            theatre.onSpriteSelected = callback;

            theatre.selectSprite('boat');

            expect(theatre.selectedSprite).toBe('boat');
            const boatLayer = theatre.layersByName.get('boat');
            expect(boatLayer.isSelected).toBe(true);
            expect(callback).toHaveBeenCalledWith('boat');
        });

        it('deselects previous sprite when selecting new one', () => {
            theatre.selectSprite('background');
            theatre.selectSprite('boat');

            const bgLayer = theatre.layersByName.get('background');
            expect(bgLayer.isSelected).toBe(false);
        });

        it('returns selected sprite name', () => {
            theatre.selectSprite('boat');

            expect(theatre.getSelectedSprite()).toBe('boat');
        });
    });

    describe('handleCanvasClick', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('selects sprite under cursor', () => {
            const boatLayer = theatre.layersByName.get('boat');
            boatLayer.containsPoint = vi.fn(() => true);

            const result = theatre.handleCanvasClick(100, 100);

            expect(result).toBe(true);
            expect(theatre.selectedSprite).toBe('boat');
        });

        it('returns false if no sprite under cursor', () => {
            const result = theatre.handleCanvasClick(100, 100);

            expect(result).toBe(false);
        });

        it('skips invisible layers', () => {
            const boatLayer = theatre.layersByName.get('boat');
            boatLayer.visible = false;
            boatLayer.containsPoint = vi.fn(() => true);

            const result = theatre.handleCanvasClick(100, 100);

            expect(result).toBe(false);
        });
    });

    describe('drag and drop', () => {
        beforeEach(async () => {
            await theatre.initialize();
            theatre.selectSprite('boat');
        });

        it('starts dragging when clicking on selected sprite', () => {
            const boatLayer = theatre.layersByName.get('boat');
            boatLayer.containsPoint = vi.fn(() => true);

            const result = theatre.handleDragStart(150, 75);

            expect(result).toBe(true);
            expect(theatre.isDragging).toBe(true);
            expect(theatre.dragStartX).toBe(150);
            expect(theatre.dragStartY).toBe(75);
        });

        it('does not start dragging if no sprite selected', () => {
            theatre.selectedSprite = null;

            const result = theatre.handleDragStart(150, 75);

            expect(result).toBe(false);
            expect(theatre.isDragging).toBe(false);
        });

        it('updates sprite position during drag', () => {
            const boatLayer = theatre.layersByName.get('boat');
            boatLayer.containsPoint = vi.fn(() => true);
            boatLayer.x_offset = 100;
            boatLayer.y_offset = 50;

            theatre.handleDragStart(150, 75);
            theatre.handleDragMove(200, 100);

            expect(boatLayer.setPosition).toHaveBeenCalledWith(150, 75);
        });

        it('calls onSpritePositionChanged on drag end', () => {
            const callback = vi.fn();
            theatre.onSpritePositionChanged = callback;

            const boatLayer = theatre.layersByName.get('boat');
            boatLayer.containsPoint = vi.fn(() => true);
            boatLayer.x_offset = 150;
            boatLayer.y_offset = 75;

            theatre.handleDragStart(150, 75);
            theatre.handleDragEnd();

            expect(callback).toHaveBeenCalledWith('boat', 150, 75, expect.any(Number));
            expect(theatre.isDragging).toBe(false);
        });
    });

    describe('setMousePosition', () => {
        it('updates mouse coordinates', () => {
            theatre.setMousePosition(100, 200);

            expect(theatre.mouseX).toBe(100);
            expect(theatre.mouseY).toBe(200);
        });
    });
});
