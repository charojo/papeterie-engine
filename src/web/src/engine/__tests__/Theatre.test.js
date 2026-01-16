import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Theatre } from '../Theatre';
import { AssetLoader } from '../AssetLoader';
import { SceneRenderer } from '../SceneRenderer';
import { SelectionManager } from '../SelectionManager';
import { InteractionManager } from '../InteractionManager';
import { DebugRenderer } from '../DebugRenderer';
import { AudioManager } from '../AudioManager';


// Mock Dependencies
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
                this.scroll_speed = config.scroll_speed || 0.0;
                this.environmental_reaction = config.environmental_reaction || null;
            }

            draw = vi.fn();
            getTransform = vi.fn(() => ({ x: 0, y: 0, scale: 1, rotation: 0, base_x: 0, base_y: 500 }));
            _getBaseY = vi.fn(() => 500);
            _getBaseDimensions = vi.fn(() => ({ width: 100, height: 100 }));
            containsPoint = vi.fn(() => false);
            getHandleAtPoint = vi.fn(() => null);
            setPosition = vi.fn(function (x, y) {
                this.x_offset = x;
                this.y_offset = y;
            });
            setRotation = vi.fn();
            setScale = vi.fn();
            resetState = vi.fn();
        }
    };
});

vi.mock('../AssetLoader', () => {
    const MockAssetLoader = vi.fn();
    MockAssetLoader.prototype.loadSprite = vi.fn();
    MockAssetLoader.prototype.fetchMetadata = vi.fn();
    MockAssetLoader.prototype.fetchAndMergeMetadata = vi.fn((config) => Promise.resolve(config));
    return { AssetLoader: MockAssetLoader };
});

vi.mock('../SceneRenderer', () => {
    const MockSceneRenderer = vi.fn();
    MockSceneRenderer.prototype.render = vi.fn();
    MockSceneRenderer.prototype.checkAndDrawOcclusion = vi.fn();
    MockSceneRenderer.prototype.onTelemetry = null;
    return { SceneRenderer: MockSceneRenderer };
});

vi.mock('../SelectionManager', () => {
    const MockSelectionManager = vi.fn();
    MockSelectionManager.prototype.select = vi.fn();
    MockSelectionManager.prototype.getSelected = vi.fn(() => null);
    MockSelectionManager.prototype.handleClick = vi.fn(() => null);
    MockSelectionManager.prototype.selectedSprite = null;
    MockSelectionManager.prototype.selectedSprites = new Set();
    return { SelectionManager: MockSelectionManager };
});

vi.mock('../InteractionManager', () => {
    const MockInteractionManager = vi.fn();
    MockInteractionManager.prototype.handleDragStart = vi.fn(() => false);
    MockInteractionManager.prototype.handleDragMove = vi.fn();
    MockInteractionManager.prototype.handleDragEnd = vi.fn();
    MockInteractionManager.prototype.setCropMode = vi.fn();
    MockInteractionManager.prototype.isDragging = false;
    MockInteractionManager.prototype.dragStartX = 0;
    MockInteractionManager.prototype.dragStartY = 0;
    return { InteractionManager: MockInteractionManager };
});

vi.mock('../DebugRenderer', () => {
    const MockDebugRenderer = vi.fn();
    MockDebugRenderer.prototype.drawOverlay = vi.fn();
    MockDebugRenderer.prototype.drawOcclusionIndicator = vi.fn();
    MockDebugRenderer.prototype.checkOcclusion = vi.fn();
    MockDebugRenderer.prototype.drawInteractionDebug = vi.fn();
    return { DebugRenderer: MockDebugRenderer };
});

vi.mock('../AudioManager', () => {
    const MockAudioManager = vi.fn();
    MockAudioManager.prototype.setBasePath = vi.fn();
    MockAudioManager.prototype.resetSchedule = vi.fn();
    MockAudioManager.prototype.loadSound = vi.fn(() => Promise.resolve());
    MockAudioManager.prototype.scheduleAt = vi.fn();
    MockAudioManager.prototype.stopAll = vi.fn();
    MockAudioManager.prototype.update = vi.fn();
    MockAudioManager.prototype.scheduled = [];
    return { AudioManager: MockAudioManager };
});

describe('Theatre', () => {
    let canvas;
    let ctx;
    let theatre;
    let sceneData;
    let assetLoaderMock;
    let rendererMock;
    let selectionManagerMock;
    let interactionManagerMock;

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
            scale: vi.fn(),
            fillText: vi.fn(),
            strokeStyle: '',
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            font: '',
            setTransform: vi.fn(),
            getContext: vi.fn()
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
        vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
            return setTimeout(() => cb(performance.now()), 16);
        }));

        vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => {
            clearTimeout(id);
        }));

        AssetLoader.mockClear();
        SceneRenderer.mockClear();
        SelectionManager.mockClear();
        InteractionManager.mockClear();
        DebugRenderer.mockClear();
        AudioManager.mockClear();

        theatre = new Theatre(canvas, sceneData, 'test_scene');

        // Grab mock instances
        assetLoaderMock = AssetLoader.mock.instances[0];
        rendererMock = SceneRenderer.mock.instances[0];
        selectionManagerMock = SelectionManager.mock.instances[0];
        interactionManagerMock = InteractionManager.mock.instances[0];

        // Default mocks
        assetLoaderMock.loadSprite.mockResolvedValue({ width: 100, height: 100 });
        assetLoaderMock.fetchAndMergeMetadata.mockImplementation((c) => Promise.resolve(c));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('initializes with correct properties', () => {
            expect(theatre.canvas).toBe(canvas);
            expect(theatre.sceneData).toBe(sceneData);
            expect(theatre.sceneName).toBe('test_scene');
            expect(theatre.layers).toEqual([]);
            expect(theatre.scroll).toBe(0);
            expect(theatre.elapsedTime).toBe(0);
            expect(theatre.isRunning).toBe(false);

            expect(AssetLoader).toHaveBeenCalled();
            expect(SceneRenderer).toHaveBeenCalled();
            expect(SelectionManager).toHaveBeenCalled();
            expect(InteractionManager).toHaveBeenCalled();
        });
    });

    describe('initialize', () => {
        it('loads layers using AssetLoader', async () => {
            await theatre.initialize();

            expect(assetLoaderMock.loadSprite).toHaveBeenCalledWith('background');
            expect(assetLoaderMock.loadSprite).toHaveBeenCalledWith('boat');
            expect(theatre.layers.length).toBe(2);
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

        it('calls renderFrame(0) after init', async () => {
            await theatre.initialize();
            expect(rendererMock.render).toHaveBeenCalled();
        });
    });

    describe('start and stop', () => {
        it('starts the animation loop', () => {
            theatre.start();

            expect(theatre.isRunning).toBe(true);
            expect(global.requestAnimationFrame).toHaveBeenCalled();
        });

        it('stops the animation loop', () => {
            theatre.start();
            theatre.stop();

            expect(theatre.isRunning).toBe(false);
            expect(global.cancelAnimationFrame).toHaveBeenCalled();
        });
    });

    describe('setTime', () => {
        it('updates elapsedTime to the specified value', () => {
            theatre.setTime(5);
            expect(theatre.elapsedTime).toBe(5);
        });

        it('syncs scroll position to match elapsed time at 180 px/sec', () => {
            theatre.setTime(5);
            // scroll = time * 180
            expect(theatre.scroll).toBe(900);
        });

        it('triggers a render frame', () => {
            theatre.setTime(5);
            expect(rendererMock.render).toHaveBeenCalled();
        });
    });

    describe('pause control', () => {
        beforeEach(() => {
            theatre.start();
        });

        it('toggles pause state', () => {
            theatre.pause();
            expect(theatre.isPaused).toBe(true);
            theatre.resume();
            expect(theatre.isPaused).toBe(false);
        });

        it('continues render loop when paused (dt=0)', () => {
            theatre.pause();
            theatre.loop(1000);
            expect(rendererMock.render).toHaveBeenCalledWith(0, expect.anything());
        });

        it('advances time when running (dt>0)', () => {
            theatre.lastTime = 1000;
            theatre.loop(2000); // 1 sec later
            expect(rendererMock.render).toHaveBeenCalledWith(1.0, expect.anything());
            expect(theatre.elapsedTime).toBeGreaterThan(0);
        });
    });

    describe('renderFrame', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('delegates to renderer.render', () => {
            theatre.renderFrame(0.016);
            expect(rendererMock.render).toHaveBeenCalledWith(0.016, expect.objectContaining({
                layers: theatre.layers,
                cameraZoom: 1.0,
                scroll: 0
            }));
        });

        it('checks for occlusion if sprite is selected', () => {
            // Setup selected sprite mock
            selectionManagerMock.getSelected.mockReturnValue('boat');

            theatre.renderFrame(0.016);

            expect(rendererMock.checkAndDrawOcclusion).toHaveBeenCalled();
        });
    });

    describe('camera properties', () => {
        it('forces render when camera changes to enable live preview', () => {
            theatre.isPaused = true;
            theatre.cameraZoom = 1.5;
            expect(rendererMock.render).toHaveBeenCalled();
        });

        it('validates input', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
            theatre.cameraZoom = -1;
            expect(theatre.cameraZoom).not.toBe(-1);
            spy.mockRestore();
        });
    });

    describe('sprite selection delegation', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('delegates selectSprite to SelectionManager', () => {
            const callback = vi.fn();
            theatre.onSpriteSelected = callback;

            theatre.selectSprite('boat');
            expect(selectionManagerMock.select).toHaveBeenCalledWith('boat', theatre.layersByName, false);
        });

        it('returns selected sprite from SelectionManager', () => {
            selectionManagerMock.getSelected.mockReturnValue('boat');
            expect(theatre.getSelectedSprite()).toBe('boat');
        });
    });

    describe('handleCanvasClick', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('delegates to selectionManager and selects result', () => {
            selectionManagerMock.handleClick.mockReturnValue('boat');

            const result = theatre.handleCanvasClick(100, 100);

            expect(selectionManagerMock.handleClick).toHaveBeenCalled();
            expect(selectionManagerMock.select).toHaveBeenCalledWith('boat', theatre.layersByName, false, false);
            expect(result).toBe(true);
        });
    });

    describe('drag and drop delegation', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('delegates to interactionManager', () => {
            interactionManagerMock.handleDragStart.mockReturnValue(true);

            const result = theatre.handleDragStart(150, 75);

            expect(interactionManagerMock.handleDragStart).toHaveBeenCalledWith(150, 75);
            expect(result).toBe(true);
        });

        it('delegates drag move', () => {
            theatre.handleDragMove(200, 100);
            expect(interactionManagerMock.handleDragMove).toHaveBeenCalledWith(200, 100);
        });

        it('delegates drag end', () => {
            theatre.handleDragEnd();
            expect(interactionManagerMock.handleDragEnd).toHaveBeenCalled();
        });
    });

    describe('updateScene', () => {
        beforeEach(async () => {
            await theatre.initialize();
        });

        it('merges new config with existing layers', async () => {
            const newScene = {
                layers: [
                    { sprite_name: 'boat', x_offset: 999 }
                ]
            };

            await theatre.updateScene(newScene);

            const boat = theatre.layersByName.get('boat');
            // MockLayer doesn't really merge config in constructor but in real implementation it does.
            // We can check if new Layer was created
            expect(boat.config.x_offset).toBe(999);
        });

        it('loads new layers', async () => {
            const newScene = {
                layers: [
                    { sprite_name: 'new_sprite' }
                ]
            };

            await theatre.updateScene(newScene);
            expect(assetLoaderMock.loadSprite).toHaveBeenCalledWith('new_sprite');
            expect(theatre.layers.length).toBe(1); // Since we replaced list logic with filtering
        });
    });
});

