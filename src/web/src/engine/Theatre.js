import { Layer } from './Layer.js';

export class Theatre {
    constructor(canvas, sceneData, sceneName, assetBaseUrl = "http://localhost:8000/assets") {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sceneData = sceneData;
        this.sceneName = sceneName;
        this.assetBaseUrl = assetBaseUrl;

        this.layers = [];
        this.scroll = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.animationFrameId = null;
        this.lastTime = 0;

        // Optimization: Index layers by name
        this.layersByName = new Map();
        this.envYData = new Map();

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

        // Bind for loop
        this.loop = this.loop.bind(this);
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
            } catch (e) {
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
            } catch (e) {
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
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        const dt = (timestamp - this.lastTime) / 1000.0;
        this.lastTime = timestamp;
        this.elapsedTime += dt;

        // Scroll speed: Python uses `self.scroll += 3` per frame (at 60fps supposedly, or just loop speed)
        // If python ticks at 60fps, that's 180 units per second.
        this.scroll += 180 * dt;

        this.updateAndDraw(dt);

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
            const currentX = layer._currentXPhys !== undefined ? layer._currentXPhys : (layer.x_offset); // Approximation, need exact render X?
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

        if (this.onTelemetry) {
            this.onTelemetry(telemetry);
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
