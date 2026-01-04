import { Layer } from './Layer.js';
import { AudioManager } from './AudioManager.js';

export class Theatre {
    constructor(canvas, sceneData, sceneName, assetBaseUrl = "http://localhost:8000/assets") {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sceneData = sceneData;
        this.sceneName = sceneName;
        this.assetBaseUrl = assetBaseUrl;

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
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // Event callbacks
        this.onSpriteSelected = null;
        this.onSpritePositionChanged = null;
        this.onTimeUpdate = null;

        // Bind for loop
        this.loop = this.loop.bind(this);
    }

    setTime(time) {
        this.elapsedTime = time;
        // Also update audio? 
        // Audio scheduling in update() handles sequential play. 
        // If we seek, we might need to reset played flags?
        // Simple seek logic for audio:
        this.audioManager.stopAll();
        // Reset played flags for future events
        this.audioManager.scheduled.forEach(s => {
            if (s.time >= time) s.played = false;
        });

        // Force redraw
        this.updateAndDraw(0);
    }

    async initialize() {
        console.log("Initializing Theatre for scene:", this.sceneName);
        this.layers = [];

        // Load layers
        const layerPromises = (this.sceneData.layers || []).map(async (layerData) => {
            const spriteName = layerData.sprite_name;
            if (!spriteName) return null;

            // Load from Global: /assets/sprites/{spriteName}/{spriteName}.png
            const globalUrl = `${this.assetBaseUrl}/sprites/${spriteName}/${spriteName}.png`;
            let image = null;

            try {
                image = await this._loadImage(globalUrl);
                // console.log(`Loaded global sprite: ${spriteName}`);
            } catch {
                console.warn(`Failed to load sprite '${spriteName}' from ${globalUrl}`);
                return null;
            }

            // Note: We are using the config from sceneData directly. 
            // In python, it loads sprite metadata (.prompt.json) effectively merges it. 
            // Here, we assume sceneData might be fully resolved OR we need to fetch metadata separately.
            // For this MVP, let's assume the sceneData passed in *contains* the specific overrides,
            // but the defaults come from the sprite's metadata. 
            // Ideally, we'd fetch `${spriteName}.prompt.json` too.
            // TODO: Fetch metadata for defaults. For now, we rely on what's in sceneData or defaults in Layer.js

            let config = { ...layerData };

            // Try to fetch metadata to fill gaps? 
            // Let's try fetching the .prompt.json
            try {
                const metaUrl = image.src.replace(/\.png$/, '.prompt.json');
                const metaRes = await fetch(metaUrl);
                if (metaRes.ok) {
                    const meta = await metaRes.json();
                    // Merge: Scene overrides Metadata
                    config = { ...meta, ...config };
                }
            } catch {
                console.warn("Could not load metadata for", spriteName);
            }

            return new Layer(config, image);
        });

        const layers = await Promise.all(layerPromises);
        this.layers = layers.filter(l => l !== null);

        // Sort by z_depth
        this.layers.sort((a, b) => a.z_depth - b.z_depth);

        // OPTIMIZATION: Index layers by name once, avoids map creation every frame
        this.layersByName = new Map();
        for (const layer of this.layers) {
            if (layer.config.sprite_name) {
                this.layersByName.set(layer.config.sprite_name, layer);
            }
        }

        // OPTIMIZATION: Reuse Map for environment data
        this.envYData = new Map();

        // Initialize Audio
        this.audioManager.resetSchedule();

        // 1. Load and schedule Global Scene sounds
        if (this.sceneData.sounds) {
            for (const sound of this.sceneData.sounds) {
                if (sound.sound_file) {
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
                }
            }
        }

        console.log(`Theatre initialized with ${this.layers.length} layers.`);
    }

    _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // specific for canvas manipulation
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    start() {
        if (this.isRunning) return;
        // Resume specific audio context if needed (browsers require user interaction usually)
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
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

    loop(timestamp) {
        if (!this.isRunning) return;

        const dt = (timestamp - this.lastTime) / 1000.0;
        this.lastTime = timestamp;

        if (this.isPaused) {
            // Draw static frame for interaction, dt=0
            this.updateAndDraw(0);
        } else {
            this.elapsedTime += dt;

            // Throttle React state updates to ~30fps to avoid "Maximum update depth exceeded"
            if (this.onTimeUpdate && (timestamp - this.lastUpdateTime > 33)) {
                this.onTimeUpdate(this.elapsedTime);
                this.lastUpdateTime = timestamp;
            }

            // Scroll speed: Python uses `self.scroll += 3` per frame (at 60fps supposedly, or just loop speed)
            // If python ticks at 60fps, that's 180 units per second.
            this.scroll += 180 * dt;

            // Update Audio
            this.audioManager.update(this.elapsedTime);

            this.updateAndDraw(dt);
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    updateAndDraw(dt) {
        const { width, height } = this.canvas;

        // Clear screen
        this.ctx.fillStyle = "rgb(200, 230, 255)"; // Default sky color
        this.ctx.fillRect(0, 0, width, height);

        const telemetry = [];

        // Draw Layers
        for (const layer of this.layers) {
            let envLayerForTilt = null;

            if (layer.environmental_reaction) {
                const targetName = layer.environmental_reaction.target_sprite_name;
                envLayerForTilt = this.layersByName ? this.layersByName.get(targetName) : null;
            }

            layer.draw(
                this.ctx,
                width,
                height,
                this.scroll,
                this.elapsedTime,
                dt,
                envLayerForTilt
            );

            // Collect telemetry
            const currentY = layer._currentYPhys !== undefined ? layer._currentYPhys : (layer._getBaseY(height) + layer.y_offset);
            // layer._currentXPhys tracking for telemetry X position
            // Actually Layer.js getTransform returns 'x' offset. 
            // In draw(), finalX = tf.x. And parallaxX = (scrollX * speed) + x_offset.
            // Let's get the visual X (screen X not including scroll?). 
            // Telemetry usually wants "World" or "Screen" coords? 
            // Y is screen Y. X should be Screen X. 
            // But Layer.js 'draw' calculates positions on the fly. 
            // We can capture the last drawn X in Layer.js or recalculate here.
            // Simple approach: just report the transform x for now, as that's what 'Location' behavior affects.

            telemetry.push({
                name: layer.config.sprite_name,
                x: layer.lastDrawnX || 0, // We need to capture this in Layer.js draw()
                y: currentY,
                tilt: layer.currentTilt || 0,
                z_depth: layer.z_depth,
                visible: layer.visible
            });
        }

        if (this.onTelemetry && (performance.now() - this.lastTelemetryTime > 50)) {
            this.onTelemetry(telemetry);
            this.lastTelemetryTime = performance.now();
        }

        // --- Visual Debug Overlay ---
        if (this.debugMode) {
            this._drawDebugOverlay(width, height);
        }
    }

    setMousePosition(x, y) {
        this.mouseX = x;
        this.mouseY = y;
    }

    setLayerVisibility(name, visible) {
        if (!this.layersByName) return;
        const layer = this.layersByName.get(name);
        if (layer) {
            layer.visible = visible;
        }
    }

    // --- Sprite Selection and Interaction ---

    selectSprite(name) {
        if (this.selectedSprite === name) return; // Guard against redundant selections

        const layer = this.layersByName.get(name);
        if (layer) {
            // Deselect previous
            if (this.selectedSprite) {
                const prevLayer = this.layersByName.get(this.selectedSprite);
                if (prevLayer) prevLayer.isSelected = false;
            }
            // Select new
            this.selectedSprite = name;
            layer.isSelected = true;
            if (this.onSpriteSelected) {
                this.onSpriteSelected(name);
            }
        }
    }

    getSelectedSprite() {
        return this.selectedSprite;
    }

    handleCanvasClick(x, y) {
        // Find sprite under cursor (reverse order for top-most first)
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (!layer.visible) continue;

            if (layer.containsPoint(x, y, this.canvas.width, this.canvas.height, this.scroll)) {
                this.selectSprite(layer.config.sprite_name);
                return true;
            }
        }
        return false;
    }

    handleDragStart(x, y) {
        if (!this.selectedSprite) return false;

        const layer = this.layersByName.get(this.selectedSprite);
        if (!layer) return false;

        if (layer.containsPoint(x, y, this.canvas.width, this.canvas.height, this.scroll)) {
            this.isDragging = true;
            this.dragStartX = x;
            this.dragStartY = y;

            // Store initial offsets
            this.dragOffsetX = layer.x_offset;
            this.dragOffsetY = layer.y_offset;
            return true;
        }
        return false;
    }

    handleDragMove(x, y) {
        if (!this.isDragging || !this.selectedSprite) return;

        const layer = this.layersByName.get(this.selectedSprite);
        if (!layer) return;

        const dx = x - this.dragStartX;
        const dy = y - this.dragStartY;

        layer.setPosition(this.dragOffsetX + dx, this.dragOffsetY + dy);
    }

    handleDragEnd() {
        if (!this.isDragging || !this.selectedSprite) return;

        const layer = this.layersByName.get(this.selectedSprite);
        if (layer && this.onSpritePositionChanged) {
            this.onSpritePositionChanged(
                this.selectedSprite,
                layer.x_offset,
                layer.y_offset,
                this.elapsedTime
            );
        }

        this.isDragging = false;
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
    }
}
