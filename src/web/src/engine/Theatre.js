import { Layer } from './Layer.js';
import { AudioManager } from './AudioManager.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Theatre');

// Safe global access with fallback for tests/environments without RAF
const _requestAnimationFrame = (cb) => (globalThis.requestAnimationFrame || ((c) => setTimeout(() => c(Date.now()), 16)))(cb);
const _cancelAnimationFrame = (id) => (globalThis.cancelAnimationFrame || ((i) => clearTimeout(i)))(id);


export class Theatre {
    constructor(canvas, sceneData, sceneName, assetBaseUrl = "http://localhost:8000/assets", userType = "default", repo = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sceneData = sceneData;
        this.sceneName = sceneName;
        this.assetBaseUrl = assetBaseUrl;
        this.userType = userType;
        this.repo = repo; // Asset Repository

        this.audioManager = new AudioManager();
        this.audioManager.setBasePath(`${assetBaseUrl}/sounds/`);

        this.layers = [];
        this.scroll = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        this.lastTime = 0;

        // Optimization: Index layers by name
        this.layersByName = new Map();
        this.envYData = new Map();
        this.lastUpdateTime = 0;
        this.lastTelemetryTime = 0;

        // Telemetry for environmental reactions
        this.previousEnvY = {};
        this.envYDirection = {};

        // Interaction state
        this.selectedSprite = null;
        this.isDragging = false;
        this.activeHandle = null; // { type: 'scale' | 'rotate', id?: string }
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.initialScale = 1.0;
        this.initialRotation = 0;
        this.isCropMode = false;

        // Camera state (private backing fields)
        this._cameraZoom = 1.0;
        this._cameraPanX = 0;
        this._cameraPanY = 0;

        // Event callbacks
        this.onTimeUpdate = null;

        this.soloSprite = null;

        // Sprite Cache: Map<string, Promise<HTMLImageElement>>
        this.spriteCache = new Map();

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
            // If paused, force a draw so we see the zoom immediately
            if (this.isPaused) this.updateAndDraw(0);
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
            if (this.isPaused) this.updateAndDraw(0);
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
            if (this.isPaused) this.updateAndDraw(0);
        }
    }

    setTime(time) {
        this.elapsedTime = time;
        // Sync scroll to match elapsed time (180 px/sec is the fixed scroll rate)
        // This ensures environmental reactions sample correct wave positions when seeking
        this.scroll = time * 180;

        // Also update audio? 
        // Audio scheduling in update() handles sequential play. 
        // If we seek, we might need to reset played flags?
        // Simple seek logic for audio:
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
        this.updateAndDraw(0);
    }

    async initialize() {
        this._isInitializing = true;
        log.debug(`[${this.sceneName}] Initializing scene with ${this.sceneData?.layers?.length || 0} layers`);


        // Load layers
        // We use map -> Promise.all to load in parallel
        // We catch errors inside the map so Promise.all doesn't fail fast
        const layerPromises = (this.sceneData.layers || []).map(async (layerData) => {
            const spriteName = layerData.sprite_name;
            if (!spriteName) return null;

            let image = null;

            try {
                image = await this._loadSprite(spriteName);
            } catch (err) {
                log.error(`Failed to load sprite '${spriteName}':`, err);
                // Return a null image, Layer class should handle it (or we skip it)
            }

            const config = await this._fetchAndMergeMetadata({ ...layerData }, image);
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

        // OPTIMIZATION: Reuse Map for environment data
        this.envYData = new Map();

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
        // FIXED: Do NOT set isRunning=true here, because it prevents start() from actually starting the RAF loop!
        // this.isRunning = true; 

        // One initial draw to ensure something is visible before loop starts
        this.updateAndDraw(0);
        this._isInitializing = false;
    }

    start() {
        if (this.isRunning) return;
        // Resume specific audio context if needed (browsers require user interaction usually)
        this.isRunning = true;
        this.lastTime = performance.now();
        log.debug('Starting render loop');
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    /**
     * Robustly load a sprite image, handling userType prioritization and fallbacks.
     * @param {string} spriteName
     * @returns {Promise<HTMLImageElement|null>}
     */
    async _loadSprite(spriteName) {
        if (this.spriteCache.has(spriteName)) {
            return this.spriteCache.get(spriteName);
        }

        const loadPromise = (async () => {
            // 1. Try Repository First (Local Mode or Optimized Server Mode)
            if (this.repo) {
                try {
                    const repoUrl = await this.repo.getSpriteImage(spriteName);
                    if (repoUrl) {
                        const img = await this._loadImage(repoUrl);
                        log.debug(`[${this.sceneName}] Loaded sprite '${spriteName}' from Repository`);
                        return img;
                    }
                } catch (e) {
                    log.warn(`Repo load failed for ${spriteName}`, e);
                }
            }

            // 2. Fallback to Legacy Fetch Logic
            const paths = this.userType === 'community'
                ? ['community', 'default']
                : ['default', 'community'];

            let image = null;
            let lastError = null;

            for (const user of paths) {
                const assetUrl = `${this.assetBaseUrl}/users/${user}/sprites/${spriteName}/${spriteName}.png`;
                try {
                    log.debug(`[${this.sceneName}] Loading sprite '${spriteName}' from: ${assetUrl}`);
                    image = await this._loadImage(assetUrl);
                    log.debug(`Loaded sprite '${spriteName}' from ${user}`);
                    return image;
                } catch (err) {
                    log.warn(`Failed to load sprite '${spriteName}' from ${user}.`);
                    lastError = err;
                }
            }

            // Last ditch fallback - check if assetBaseUrl is actually correct (local dev mismatch)
            if (this.assetBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
                const fallbackUser = paths[0];
                const assetUrl = `${this.assetBaseUrl}/users/${fallbackUser}/sprites/${spriteName}/${spriteName}.png`;
                const altUrl = assetUrl.replace(/https?:\/\/[^/]+/, window.location.origin);
                log.warn(`Retrying with origin fallback: ${altUrl}`);
                try {
                    image = await this._loadImage(altUrl);
                    log.debug('Success on origin fallback');
                    return image;
                } catch {
                    log.error(`Origin fallback failed for ${spriteName}`);
                }
            }

            log.error(`CRITICAL: Failed to load sprite '${spriteName}' from all paths.`, lastError);
            return null; // Return null so we can proceed without crashing
        })();

        this.spriteCache.set(spriteName, loadPromise);
        return loadPromise;
    }

    _loadImage(url, retry = true) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // specific for canvas manipulation
            img.onload = () => resolve(img);
            img.onerror = () => {
                if (retry) {
                    // Retry with cache buster
                    log.warn(`Retrying image load with cache buster: ${url}`);
                    const bustUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
                    const retryImg = new Image();
                    retryImg.crossOrigin = "Anonymous";
                    retryImg.onload = () => {
                        log.debug(`Recovered image with cache buster: ${url}`);
                        resolve(retryImg);
                    };
                    retryImg.onerror = (err) => {
                        log.error(`Image load retry failed: ${url}`, err);
                        reject(new Error(`Failed to load image: ${url}`));
                    };
                    retryImg.src = bustUrl;
                } else {
                    // console.error(`[Theatre] Image load error for URL: ${url}`, e);
                    reject(new Error(`Failed to load image: ${url}`));
                }
            };
            img.src = url;
        });
    }

    /**
     * Internal helper to fetch metadata and merge with scene config.
     * Metadata serves as the "base" which scene overrides.
     */
    async _fetchAndMergeMetadata(config, image) {
        // 1. Try Repository based metadata
        if (this.repo && config.sprite_name) {
            try {
                const meta = await this.repo.getSpriteMetadata(config.sprite_name);
                if (meta) {
                    const merged = { ...meta, ...config };
                    log.debug(`[${this.sceneName}] Merged metadata for ${config.sprite_name} (from Repo)`);
                    return merged;
                }
            } catch (e) {
                log.warn(`Repo metadata fetch failed for ${config.sprite_name}`, e);
            }
        }

        // 2. Legacy URL fetching (only if image.src is http/https)
        if (!image || !image.src) return config;

        // If blob URL (Local Mode) AND step 1 failed, we can't do anything else.
        if (image.src.startsWith('blob:')) return config;

        try {
            const cleanSrc = image.src.split('?')[0];
            const metaUrl = cleanSrc.replace(/\.png$/, '.prompt.json');
            const metaRes = await fetch(metaUrl);
            if (metaRes.ok) {
                const meta = await metaRes.json();
                // MERGE: Scene (config) is AUTHORITATIVE over Metadata (meta)
                const merged = { ...meta, ...config };
                log.debug(`[${this.sceneName}] Merged metadata for ${config.sprite_name}`, {
                    meta_scale: meta.scale,
                    scene_scale: config.scale,
                    final_scale: merged.scale
                });
                return merged;
            }
        } catch (err) {
            log.warn(`Failed to fetch metadata for ${config.sprite_name}`, err);
        }
        return config;
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            _cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.audioManager.stopAll(); // Stop sound on pause/stop? Or maybe just pause?
        // For editor experience, stop is safer.
    }

    pause() {
        this.isPaused = true;
        this.audioManager.stopAll(); // Or pause?
    }

    resume() {
        this.isPaused = false;
        this.lastTime = performance.now(); // Reset lastTime prevents huge dt jump
        // Audio might need resume logic if we support it
    }

    togglePause() {
        if (this.isPaused) this.resume();
        else this.pause();
    }

    setCropMode(enabled) {
        this.isCropMode = enabled;
        // Trigger redraw to show/hide handles if we used that flag
        if (this.isPaused || this.selectedSprite) this.updateAndDraw(0);
    }

    async updateScene(newSceneData) {
        if (this._isInitializing) {
            log.debug(`[${this.sceneName}] updateScene suppressed during initialization`);
            this.sceneData = newSceneData; // Store it for post-init but don't re-create layers yet
            return;
        }

        this.sceneData = newSceneData;
        log.debug(`[${this.sceneName}] Updating scene data... (${newSceneData?.layers?.length || 0} layers)`);

        // Smart update: Sync layers with new config, preserving state/images where possible
        const newLayerConfigs = newSceneData.layers || [];

        // 1. Map existing layers by name for quick lookup
        const existingLayers = new Map();
        this.layers.forEach(l => {
            if (l.config.sprite_name) existingLayers.set(l.config.sprite_name, l);
        });

        // 2. Build new layer list
        const newLayers = [];

        for (const layerData of newLayerConfigs) {
            const spriteName = layerData.sprite_name;
            if (!spriteName) continue;

            let layer = existingLayers.get(spriteName);

            if (layer) {
                // FIXED: Merge new layerData with EXISTING config which already has metadata
                const mergedConfig = { ...layer.config, ...layerData };
                log.debug(`[${this.sceneName}] Updating existing layer: ${spriteName}`, {
                    prev: layer.config.scale,
                    new: layerData.scale,
                    final: mergedConfig.scale
                });

                const wasSelected = layer.isSelected;
                layer = new Layer(mergedConfig, layer.image);
                layer.isSelected = wasSelected;
            } else {
                // New Layer - Needs load (using cache if possible)
                const img = await this._loadSprite(spriteName);
                if (!img) {
                    log.warn('Failed to load new sprite from all paths', spriteName);
                    continue;
                }
                const config = await this._fetchAndMergeMetadata({ ...layerData }, img);
                layer = new Layer(config, img);
            }
            newLayers.push(layer);
        }

        this.layers = newLayers;
        this.layers.sort((a, b) => a.z_depth - b.z_depth);

        // Re-index
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
            // Draw static frame for interaction, dt=0
            this.updateAndDraw(0);
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

            this.updateAndDraw(dt);
        }

        this.animationFrameId = _requestAnimationFrame(this.loop);
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

    updateAndDraw(dt) {
        const { width, height } = this.canvas;

        // Debug: Log render state occasionally
        if (!this._lastDebugTime || (performance.now() - this._lastDebugTime > 2000)) {
            log.debug(`Render: ${width}x${height} | Zoom=${this.cameraZoom.toFixed(3)} Pan=(${this.cameraPanX.toFixed(1)}, ${this.cameraPanY.toFixed(1)}) | Layers=${this.layers.length}`);
            this._lastDebugTime = performance.now();
        }

        // Clear screen
        this.ctx.fillStyle = "#1a1a1a";
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.save();
        this._applyCameraTransform(width, height);

        // Draw scene background
        this.ctx.fillStyle = "rgb(200, 230, 255)";
        this.ctx.fillRect(0, 0, width, height);

        // Draw layers and collect telemetry
        const { telemetry, selectedLayer, selectedEnvLayer } = this._drawLayers(dt, width, height);

        // Draw selected layer on top
        if (selectedLayer) {
            this._drawSelectedLayer(selectedLayer, selectedEnvLayer, width, height, telemetry);
        }

        // Emit telemetry to React
        this._emitTelemetry(telemetry);

        // Debug overlay
        if (this.debugMode) {
            this._drawDebugOverlay(width, height);
        }

        this.ctx.restore();
    }

    /**
     * Apply camera transform (zoom/pan) to canvas context.
     */
    _applyCameraTransform(width, height) {
        // Validate camera state
        if (!Number.isFinite(this.cameraZoom) || !Number.isFinite(this.cameraPanX) || !Number.isFinite(this.cameraPanY)) {
            log.error('CRITICAL: Camera state is invalid!', this.cameraZoom, this.cameraPanX, this.cameraPanY);
            this.cameraZoom = 1.0;
            this.cameraPanX = 0;
            this.cameraPanY = 0;
        }

        this.ctx.translate(width / 2, height / 2);
        this.ctx.scale(this.cameraZoom, this.cameraZoom);
        this.ctx.translate(-width / 2 + this.cameraPanX, -height / 2 + this.cameraPanY);
    }

    /**
     * Draw all layers except selected, collecting telemetry.
     */
    _drawLayers(dt, width, height) {
        const telemetry = [];
        let selectedLayer = null;
        let selectedEnvLayer = null;

        for (const layer of this.layers) {
            const isSelected = this.selectedSprite === layer.config.sprite_name;

            if (isSelected) {
                selectedLayer = layer;
                if (layer.environmental_reaction) {
                    const targetName = layer.environmental_reaction.target_sprite_name;
                    selectedEnvLayer = this.layersByName ? this.layersByName.get(targetName) : null;
                }
                continue;
            }

            let envLayerForTilt = null;
            if (layer.environmental_reaction) {
                const targetName = layer.environmental_reaction.target_sprite_name;
                envLayerForTilt = this.layersByName ? this.layersByName.get(targetName) : null;
            }

            const isSolo = this.soloSprite === layer.config.sprite_name;
            let effectiveDt = dt;
            let effectiveTime = this.elapsedTime;

            if (this.soloSprite && !isSolo) {
                effectiveDt = 0;
                effectiveTime = 0;
            }

            layer.draw(
                this.ctx,
                width,
                height,
                this.scroll,
                effectiveTime,
                effectiveDt,
                envLayerForTilt,
                this.isPaused,
                this.isCropMode
            );

            // Collect telemetry
            const currentY = layer._currentYPhys !== undefined ? layer._currentYPhys : (layer._getBaseY(height) + layer.y_offset);
            telemetry.push({
                name: layer.config.sprite_name,
                x: layer.lastDrawnX || 0,
                y: currentY,
                tilt: layer.currentTilt || 0,
                z_depth: layer.z_depth,
                visible: layer.visible
            });
        }

        return { telemetry, selectedLayer, selectedEnvLayer };
    }

    /**
     * Draw selected layer on top with occlusion detection.
     */
    _drawSelectedLayer(selectedLayer, selectedEnvLayer, width, height, telemetry) {
        const isOccluded = this._checkOcclusion(selectedLayer, width, height);

        selectedLayer.draw(
            this.ctx,
            width,
            height,
            this.scroll,
            this.elapsedTime,
            0, // dt=0 to freeze behaviors for editing
            selectedEnvLayer,
            true,
            this.isCropMode
        );

        if (isOccluded) {
            this._drawOcclusionIndicator(selectedLayer, width, height);
        }

        // Add to telemetry
        const currentY = selectedLayer._currentYPhys !== undefined ? selectedLayer._currentYPhys : (selectedLayer._getBaseY(height) + selectedLayer.y_offset);
        telemetry.push({
            name: selectedLayer.config.sprite_name,
            x: selectedLayer.lastDrawnX || 0,
            y: currentY,
            tilt: selectedLayer.currentTilt || 0,
            z_depth: selectedLayer.z_depth,
            visible: selectedLayer.visible
        });
    }

    /**
     * Check if selected layer is occluded by higher Z-depth layers.
     */
    _checkOcclusion(selectedLayer, width, height) {
        for (const other of this.layers) {
            if (other.config.sprite_name === this.selectedSprite) continue;
            if (other.z_depth > selectedLayer.z_depth && other.visible) {
                const otherTf = other.getTransform(height, width, 0, this.elapsedTime);
                const selTf = selectedLayer.getTransform(height, width, 0, this.elapsedTime);
                const { width: oW, height: oH } = other._getBaseDimensions(height);
                const { width: sW, height: sH } = selectedLayer._getBaseDimensions(height);

                const actualOW = oW * otherTf.scale;
                const actualOH = oH * otherTf.scale;
                const actualSW = sW * selTf.scale;
                const actualSH = sH * selTf.scale;

                const oX = (other.scroll_speed * this.scroll) + other.x_offset + otherTf.x + (otherTf.base_x || 0);
                const oY = otherTf.base_y + otherTf.y;
                const sX = (selectedLayer.scroll_speed * this.scroll) + selectedLayer.x_offset + selTf.x + (selTf.base_x || 0);
                const sY = selTf.base_y + selTf.y;

                if (oX < sX + actualSW && oX + actualOW > sX && oY < sY + actualSH && oY + actualOH > sY) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Draw "HIDDEN BEHIND LAYERS" indicator.
     */
    _drawOcclusionIndicator(selectedLayer, width, height) {
        this.ctx.save();
        const selTf = selectedLayer.getTransform(height, width, 0, this.elapsedTime);
        const { width: sW } = selectedLayer._getBaseDimensions(height);
        const sX = (selectedLayer.scroll_speed * this.scroll) + selectedLayer.x_offset + selTf.x + (selTf.base_x || 0);
        const sY = selTf.base_y + selTf.y;

        this.ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
        this.ctx.font = "bold 12px Inter, system-ui, sans-serif";
        this.ctx.textBaseline = "bottom";
        const label = "HIDDEN BEHIND LAYERS";
        const metrics = this.ctx.measureText(label);

        this.ctx.fillRect(sX + (sW * selTf.scale) / 2 - metrics.width / 2 - 4, sY - 20, metrics.width + 8, 18);
        this.ctx.fillStyle = "white";
        this.ctx.fillText(label, sX + (sW * selTf.scale) / 2 - metrics.width / 2, sY - 6);

        // Draw eye-slash icon
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(sX + (sW * selTf.scale) / 2, sY - 30, 4, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.moveTo(sX + (sW * selTf.scale) / 2 - 6, sY - 36);
        this.ctx.lineTo(sX + (sW * selTf.scale) / 2 + 6, sY - 24);
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * Emit telemetry data to React callback.
     */
    _emitTelemetry(telemetry) {
        if (this.onTelemetry && (performance.now() - this.lastTelemetryTime > 50)) {
            this.onTelemetry(telemetry);
            this.lastTelemetryTime = performance.now();
        }
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

    // --- Sprite Selection and Interaction ---

    selectSprite(name, isSync = false) {
        if (!isSync && this.selectedSprite === name) {
            // Toggle off only if NOT a sync call
            const layer = this.layersByName.get(name);
            if (layer) layer.isSelected = false;
            this.selectedSprite = null;
            if (this.onSpriteSelected) this.onSpriteSelected(null);
            return;
        }

        const layer = this.layersByName.get(name);
        if (layer) {
            // Deselect previous
            if (this.selectedSprite && this.selectedSprite !== name) {
                const prevLayer = this.layersByName.get(this.selectedSprite);
                if (prevLayer) prevLayer.isSelected = false;
            }
            // Select new
            this.selectedSprite = name;
            layer.isSelected = true;
            if (!isSync && this.onSpriteSelected) {
                this.onSpriteSelected(name);
            }
        } else {
            // Deselect all if name is null
            if (this.selectedSprite) {
                const prevLayer = this.layersByName.get(this.selectedSprite);
                if (prevLayer) prevLayer.isSelected = false;
            }
            this.selectedSprite = null;
            if (!isSync && this.onSpriteSelected) this.onSpriteSelected(null);
        }
    }

    getSelectedSprite() {
        return this.selectedSprite;
    }

    getHandleAtPoint(screenX, screenY) {
        if (!this.selectedSprite) return null;
        const layer = this.layersByName.get(this.selectedSprite);
        if (!layer) return null;
        const worldPos = this.screenToWorld(screenX, screenY);
        return layer.getHandleAtPoint(worldPos.x, worldPos.y, this.canvas.width, this.canvas.height, this.scroll, this.elapsedTime);
    }

    handleCanvasClick(x, y) {
        const worldPos = this.screenToWorld(x, y);

        // Find sprite under cursor (reverse order for top-most first)
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (!layer.visible || layer.is_background) continue;

            if (layer.containsPoint(worldPos.x, worldPos.y, this.canvas.width, this.canvas.height, this.scroll, this.elapsedTime)) {
                this.selectSprite(layer.config.sprite_name);
                return true;
            }
        }
        this.selectSprite(null);
        return false;
    }

    handleDragStart(x, y) {
        const worldPos = this.screenToWorld(x, y);

        if (!this.selectedSprite) return false;
        const layer = this.layersByName.get(this.selectedSprite);
        if (!layer) return false;

        // 1. Check for handles first
        const handle = layer.getHandleAtPoint(worldPos.x, worldPos.y, this.canvas.width, this.canvas.height, this.scroll, this.elapsedTime);
        if (handle) {
            this.activeHandle = handle;
            this.isDragging = true;
            this.dragStartX = worldPos.x;
            this.dragStartY = worldPos.y;
            this.initialScale = layer._baseScale;
            this.initialRotation = layer.getTransform(this.canvas.height, this.canvas.width, 0, this.elapsedTime).rotation;
            return true;
        }

        // 2. Check for body drag
        if (layer.containsPoint(worldPos.x, worldPos.y, this.canvas.width, this.canvas.height, this.scroll, this.elapsedTime)) {
            this.activeHandle = null;
            this.isDragging = true;
            this.dragStartX = worldPos.x;
            this.dragStartY = worldPos.y;

            // Store initial offsets
            this.dragOffsetX = layer.x_offset;
            this.dragOffsetY = layer.y_offset;
            return true;
        }
        return false;
    }

    handleDragMove(x, y) {
        if (!this.isDragging || !this.selectedSprite) return;
        const worldPos = this.screenToWorld(x, y);
        const layer = this.layersByName.get(this.selectedSprite);
        if (!layer) return;

        const dx = worldPos.x - this.dragStartX;
        const dy = worldPos.y - this.dragStartY;

        if (this.activeHandle) {
            if (this.activeHandle.type === 'scale') {
                // Simplified scaling: use distance from center to calculate new scale
                const tf = layer.getTransform(this.canvas.height, this.canvas.width, 0, this.elapsedTime);
                const { width: baseW, height: baseH } = layer._getBaseDimensions(this.canvas.height);
                const centerX = (layer.scroll_speed * this.scroll) + layer.x_offset + tf.x + (tf.base_x || 0) + (baseW * tf.scale) / 2;
                const centerY = tf.base_y + tf.y + (baseH * tf.scale) / 2;

                const initialDist = Math.sqrt(Math.pow(this.dragStartX - centerX, 2) + Math.pow(this.dragStartY - centerY, 2));
                const currentDist = Math.sqrt(Math.pow(worldPos.x - centerX, 2) + Math.pow(worldPos.y - centerY, 2));

                if (initialDist > 5) {
                    const newScale = this.initialScale * (currentDist / initialDist);
                    if (this.isCropMode) {
                        // Visual indicator for crop? 
                        // For now we just prevent setScale from affecting the actual sprite metadata/baseScale
                        // so it doesn't trigger the toast. 
                        // We could call layer.setCropPreview(newScale) if we had that.
                    } else {
                        layer.setScale(newScale, this.elapsedTime);
                    }
                }
            } else if (this.activeHandle.type === 'rotate') {
                const tf = layer.getTransform(this.canvas.height, this.canvas.width, 0, this.elapsedTime);
                const { width: baseW, height: baseH } = layer._getBaseDimensions(this.canvas.height);
                const centerX = (layer.scroll_speed * this.scroll) + layer.x_offset + tf.x + (tf.base_x || 0) + (baseW * tf.scale) / 2;
                const centerY = tf.base_y + tf.y + (baseH * tf.scale) / 2;

                const initialAngle = Math.atan2(this.dragStartY - centerY, this.dragStartX - centerX);
                const currentAngle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);

                const angleDiff = (currentAngle - initialAngle) * (180 / Math.PI);
                layer.setRotation(this.initialRotation + angleDiff, this.elapsedTime);
            }
        } else {
            // Body drag
            layer.setPosition(this.dragOffsetX + dx, this.dragOffsetY + dy);
        }
    }

    handleDragEnd() {
        if (!this.isDragging || !this.selectedSprite) return;

        const layer = this.layersByName.get(this.selectedSprite);
        if (layer) {
            if (this.activeHandle) {
                if (this.activeHandle.type === 'scale') {
                    if (this.isCropMode) {
                        // Handle crop commit if we implement it, for now just log
                        // console.log("[Theatre] Crop committed (placeholder)");
                    } else if (this.onSpriteScaleChanged) {
                        this.onSpriteScaleChanged(this.selectedSprite, layer._baseScale, this.elapsedTime);
                    }
                } else if (this.activeHandle.type === 'rotate' && this.onSpriteRotationChanged) {
                    const tf = layer.getTransform(this.canvas.height, this.canvas.width, 0, this.elapsedTime);
                    this.onSpriteRotationChanged(this.selectedSprite, tf.rotation);
                }
            } else if (this.onSpritePositionChanged) {
                this.onSpritePositionChanged(this.selectedSprite, layer.x_offset, layer.y_offset, this.elapsedTime);
            }
        }

        this.isDragging = false;
        this.activeHandle = null;
    }

    _drawDebugOverlay(width, height) {
        this.ctx.fillStyle = "rgba(255, 0, 255, 0.5)";
        this.ctx.font = "12px monospace";
        this.ctx.fillText(`Scroll: ${this.scroll.toFixed(1)}`, 10, 20);
        this.ctx.fillText(`Time: ${this.elapsedTime.toFixed(1)}s`, 10, 35);
        if (this.mouseX !== undefined) {
            this.ctx.fillText(`Mouse: ${Math.round(this.mouseX)}, ${Math.round(this.mouseY)}`, 10, 50);
        }

        // Draw horizontal markers for each layer
        this.layers.forEach((layer, i) => {
            const y = layer._currentYPhys !== undefined ? layer._currentYPhys : layer._getBaseY(height);
            this.ctx.strokeStyle = `rgba(255, 0, 255, ${0.2 + (i / this.layers.length) * 0.5})`;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
            this.ctx.fillText(layer.config.sprite_name, 5, y - 2);
        });

        if (this.selectedSprite && this.mouseX !== undefined) {
            const layer = this.layersByName.get(this.selectedSprite);
            if (layer) {
                const surfaceY = layer.getYAtX(width, height, this.scroll, this.mouseX, this.elapsedTime);
                if (surfaceY !== height) { // height is the fallback if not found
                    this.ctx.fillStyle = "rgb(255, 0, 255)";
                    this.ctx.beginPath();
                    this.ctx.arc(this.mouseX, surfaceY, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }
}
