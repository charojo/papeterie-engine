// ## @DOC
// # ### Theatre Engine
// # The core rendering and orchestration engine for the "Paper Theatre".
// # - **Render Loop**: High-performance `requestAnimationFrame` loop using HTML5 Canvas.
// # - **Camera Control**: Global pan and zoom logic with coordinate space conversion.
// # - **Interaction**: Handles selection, dragging, and scaling of sprites in the world space.
// # - **Environmental Sampling**: Propagates global wave/physics data to individual layers.
import { Layer } from './Layer.js';
import { AudioManager } from './AudioManager.js';
import { SelectionManager } from './SelectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { DebugRenderer } from './DebugRenderer.js';
import { AssetLoader } from './AssetLoader.js';
import { SceneRenderer } from './SceneRenderer.js';
import { createLogger } from '../utils/logger.js';
import { ThemeManager } from './ThemeManager.js';

const log = createLogger('Theatre');

// Safe global access with fallback for tests/environments without RAF
const _requestAnimationFrame = (cb) => (globalThis.requestAnimationFrame || ((c) => setTimeout(() => c(Date.now()), 16)))(cb);
const _cancelAnimationFrame = (id) => (globalThis.cancelAnimationFrame || ((i) => clearTimeout(i)))(id);


export class Theatre {
    constructor(canvas, sceneData, sceneName, assetBaseUrl = "http://localhost:8000/assets", userType = "default") {
        this.canvas = canvas;
        this.sceneData = sceneData;
        this.sceneName = sceneName;

        this.audioManager = new AudioManager();
        this.audioManager.setBasePath(`${assetBaseUrl}/sounds/`);

        // [New] Managers
        this.selectionManager = new SelectionManager((name) => {
            if (this.onSpriteSelected) this.onSpriteSelected(name);
        });
        this.interactionManager = new InteractionManager(this);
        this.debugRenderer = new DebugRenderer();
        this.assetLoader = new AssetLoader(assetBaseUrl, userType, sceneName);
        this.renderer = new SceneRenderer(canvas, canvas.getContext('2d'), this.debugRenderer);


        this.layers = [];
        this.scroll = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        this.lastTime = 0;

        // Optimization: Index layers by name
        this.layersByName = new Map();
        this.lastUpdateTime = 0;

        // Interaction state
        this.isCropMode = false;
        this.debugMode = false;

        // Camera state (private backing fields)
        this._cameraZoom = 1.0;
        this._cameraPanX = 0;
        this._cameraPanY = 0;

        // Event callbacks
        this.onTimeUpdate = null;
        this.onSpriteSelected = null;

        this.soloSprite = null;

        this._isInitializing = false;

        // Bind for loop
        this.loop = this.loop.bind(this);
    }

    // Camera Accessors with Invariant Validation
    get cameraZoom() { return this._cameraZoom; }
    set cameraZoom(v) {
        // Invariant: zoom must be finite positive number
        if (!Number.isFinite(v) || v <= 0) {
            log.error(`Invalid cameraZoom rejected: ${v}`);
            return; // Silently reject instead of throwing to not break existing code
        }
        if (v !== this._cameraZoom) {
            log.debug(`[${this.sceneName}] cameraZoom: ${this._cameraZoom.toFixed(3)} -> ${v.toFixed(3)}`);
            this._cameraZoom = v;
            // If paused, force a render
            if (this.isPaused) this.renderFrame(0);
        }
    }

    get cameraPanX() { return this._cameraPanX; }
    set cameraPanX(v) {
        // Invariant: pan must be finite
        if (!Number.isFinite(v)) {
            log.error(`Invalid cameraPanX rejected: ${v}`);
            return;
        }
        if (v !== this._cameraPanX) {
            this._cameraPanX = v;
            if (this.isPaused) this.renderFrame(0);
        }
    }

    get cameraPanY() { return this._cameraPanY; }
    set cameraPanY(v) {
        // Invariant: pan must be finite
        if (!Number.isFinite(v)) {
            log.error(`Invalid cameraPanY rejected: ${v}`);
            return;
        }
        if (v !== this._cameraPanY) {
            this._cameraPanY = v;
            if (this.isPaused) this.renderFrame(0);
        }
    }

    // Proxy for selection manager
    get selectedSprite() {
        return this.selectionManager.getSelected();
    }

    set selectedSprite(name) {
        this.selectionManager.select(name, this.layersByName, true);
    }

    // Bridge for Telemetry callback
    set onTelemetry(cb) {
        this.renderer.onTelemetry = cb;
    }

    get onTelemetry() {
        return this.renderer.onTelemetry;
    }


    setTime(time) {
        this.elapsedTime = time;
        // Sync scroll to match elapsed time (180 px/sec is the fixed scroll rate)
        this.scroll = time * 180;

        this.audioManager.stopAll();
        // Reset played flags for future events
        this.audioManager.scheduled.forEach(s => {
            if (s.time >= time) s.played = false;
        });

        // Reset all layer states for seeking (clears smoothing, etc.)
        if (this.layers) {
            this.layers.forEach(layer => layer.resetState());
        }

        // Force redraw
        this.renderFrame(0);
    }

    async initialize() {
        this._isInitializing = true;
        log.debug(`[${this.sceneName}] Initializing scene with ${this.sceneData?.layers?.length || 0} layers`);


        // Load layers
        const layerPromises = (this.sceneData.layers || []).map(async (layerData) => {
            const spriteName = layerData.sprite_name;
            if (!spriteName) return null;

            let image = null;
            try {
                image = await this.assetLoader.loadSprite(spriteName);
            } catch (err) {
                log.error(`Failed to load sprite '${spriteName}':`, err);
            }

            const config = await this.assetLoader.fetchAndMergeMetadata({ ...layerData }, image);
            return new Layer(config, image);
        });

        const loadedLayers = await Promise.all(layerPromises);
        this.layers = loadedLayers.filter(l => l !== null);


        // Re-build index
        this.layersByName.clear();
        this.layers.forEach(l => {
            if (l.config.sprite_name) {
                this.layersByName.set(l.config.sprite_name, l);
            }
        });

        // Initialize Audio
        this.audioManager.resetSchedule();

        // 1. Load and schedule Global Scene sounds
        if (this.sceneData.sounds) {
            for (const sound of this.sceneData.sounds) {
                if (sound.sound_file) {
                    try {
                        await this.audioManager.loadSound(sound.sound_file, sound.sound_file);
                        // Schedule if it has a time offset
                        if (sound.time_offset !== undefined && sound.time_offset !== null) {
                            this.audioManager.scheduleAt(sound.sound_file, sound.time_offset, {
                                volume: sound.volume,
                                loop: sound.loop,
                                fade_in: sound.fade_in,
                                fade_out: sound.fade_out
                            });
                        }
                    } catch (e) {
                        log.warn('Failed to load sound:', sound.sound_file, e);
                    }
                }
            }
        }

        this.lastTime = performance.now();

        // One initial draw
        this.renderFrame(0);
        this._isInitializing = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        log.debug('Starting render loop');
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            _cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.audioManager.stopAll();
    }

    pause() {
        this.isPaused = true;
        this.audioManager.stopAll();
    }

    resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
    }

    togglePause() {
        if (this.isPaused) this.resume();
        else this.pause();
    }

    setCropMode(enabled) {
        this.isCropMode = enabled;
        this.interactionManager.setCropMode(enabled);
        if (this.isPaused || this.selectionManager.getSelected()) this.renderFrame(0);
    }

    async updateScene(newSceneData) {
        if (this._isInitializing) {
            log.debug(`[${this.sceneName}] updateScene suppressed during initialization`);
            this.sceneData = newSceneData;
            return;
        }

        this.sceneData = newSceneData;
        log.debug(`[${this.sceneName}] Updating scene data... (${newSceneData?.layers?.length || 0} layers)`);

        // Smart update: Sync layers with new config
        const newLayerConfigs = newSceneData.layers || [];
        const existingLayers = new Map();
        this.layers.forEach(l => {
            if (l.config.sprite_name) existingLayers.set(l.config.sprite_name, l);
        });

        const newLayers = [];

        for (const layerData of newLayerConfigs) {
            const spriteName = layerData.sprite_name;
            if (!spriteName) continue;

            let layer = existingLayers.get(spriteName);

            if (layer) {
                const mergedConfig = { ...layer.config, ...layerData };
                const wasSelected = layer.isSelected;
                layer = new Layer(mergedConfig, layer.image);
                layer.isSelected = wasSelected;
            } else {
                const img = await this.assetLoader.loadSprite(spriteName);
                if (!img) {
                    log.warn('Failed to load new sprite from all paths', spriteName);
                    continue;
                }
                const config = await this.assetLoader.fetchAndMergeMetadata({ ...layerData }, img);
                layer = new Layer(config, img);
            }
            newLayers.push(layer);
        }

        this.layers = newLayers;
        this.layers.sort((a, b) => a.z_depth - b.z_depth);

        this.layersByName.clear();
        for (const layer of this.layers) {
            this.layersByName.set(layer.config.sprite_name, layer);
        }
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        const dt = (timestamp - this.lastTime) / 1000.0;
        this.lastTime = timestamp;

        if (this.isPaused) {
            this.renderFrame(0);
        } else {
            this.elapsedTime += dt;

            // Throttle React state updates to ~30fps
            if (this.onTimeUpdate && (timestamp - this.lastUpdateTime > 33)) {
                this.onTimeUpdate(this.elapsedTime);
                this.lastUpdateTime = timestamp;
            }

            if (!this.soloSprite) {
                this.scroll += 180 * dt;
            }

            this.audioManager.update(this.elapsedTime);

            this.renderFrame(dt);
        }

        this.animationFrameId = _requestAnimationFrame(this.loop);
    }

    /**
     * Delegates rendering to SceneRenderer, packaging state.
     */
    renderFrame(dt) {
        this.renderer.render(dt, {
            layers: this.layers,
            cameraZoom: this.cameraZoom,
            cameraPanX: this.cameraPanX,
            cameraPanY: this.cameraPanY,
            scroll: this.scroll,
            elapsedTime: this.elapsedTime,
            isPaused: this.isPaused,
            isCropMode: this.isCropMode,
            debugMode: this.debugMode,
            selectionManager: this.selectionManager,
            soloSprite: this.soloSprite,
            layersByName: this.layersByName,
            mouseX: this.mouseX,
            mouseY: this.mouseY
        });

        // Handle Occlusion Indicator Drawing (Logic restored from previous monolithic implementation)
        const selected = this.selectionManager.getSelected();
        if (selected) {
            const layer = this.layersByName.get(selected);
            if (layer) {
                this.renderer.checkAndDrawOcclusion(
                    layer,
                    this.layers,
                    this.canvas.width,
                    this.canvas.height,
                    this.scroll,
                    this.elapsedTime
                );
            }
        }
    }

    setSoloMode(spriteName) {
        this.soloSprite = spriteName;
    }

    getSoloMode() {
        return this.soloSprite;
    }

    screenToWorld(x, y) {
        return {
            x: (x - this.canvas.width / 2) / this.cameraZoom - this.cameraPanX + this.canvas.width / 2,
            y: (y - this.canvas.height / 2) / this.cameraZoom - this.cameraPanY + this.canvas.height / 2
        };
    }

    setMousePosition(x, y) {
        const worldPos = this.screenToWorld(x, y);
        this.mouseX = worldPos.x;
        this.mouseY = worldPos.y;
    }

    setLayerVisibility(name, visible) {
        if (!this.layersByName) return;
        const layer = this.layersByName.get(name);
        if (layer) {
            layer.visible = visible;
        }
    }

    // --- Sprite Selection and Interaction ---

    selectSprite(name, isSync = false) {
        this.selectionManager.select(name, this.layersByName, isSync);
    }

    getSelectedSprite() {
        return this.selectionManager.getSelected();
    }

    getHandleAtPoint(screenX, screenY) {
        const selected = this.selectionManager.getSelected();
        if (!selected) return null;
        const layer = this.layersByName.get(selected);
        if (!layer) return null;
        const worldPos = this.screenToWorld(screenX, screenY);
        return layer.getHandleAtPoint(worldPos.x, worldPos.y, this.canvas.width, this.canvas.height, this.scroll, this.elapsedTime);
    }

    handleCanvasClick(x, y, isShift = false) {
        const worldPos = this.screenToWorld(x, y);

        const hitName = this.selectionManager.handleClick(
            worldPos.x,
            worldPos.y,
            this.layers,
            this.canvas.width,
            this.canvas.height,
            this.scroll,
            this.elapsedTime
        );

        this.selectionManager.select(hitName, this.layersByName, false, isShift);
        return !!hitName;
    }

    handleDragStart(x, y) {
        return this.interactionManager.handleDragStart(x, y);
    }

    handleDragMove(x, y) {
        this.interactionManager.handleDragMove(x, y);
    }

    handleDragEnd() {
        this.interactionManager.handleDragEnd();
    }
}
