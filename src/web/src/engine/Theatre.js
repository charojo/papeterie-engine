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

        // Telemetry for environmental reactions
        this.previousEnvY = {};
        this.envYDirection = {};

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

        // OPTIMIZATION: Clear simplified reuse Map instead of reallocation
        if (!this.envYData) this.envYData = new Map();
        this.envYData.clear();

        for (const layer of this.layers) {
            if (!layer.environmental_reaction) continue;

            const targetName = layer.environmental_reaction.target_sprite_name;
            // OPTIMIZATION: Use pre-computed map
            const envLayer = this.layersByName ? this.layersByName.get(targetName) : null;

            if (envLayer) {
                const imgW = layer.processedImage.width; // Base width
                // Note: layer.draw() handles scaling, but here we need center X for sampling.
                // We should technically predict the scale/position here or move this logic inside Layer or share it.
                // For MVP, we use base width/position logic similar to python
                // Python: draw_x calc is duplicated in run() and draw().

                const parallaxScroll = this.scroll * layer.scroll_speed;
                // Simplified wrap width calc (assuming screen width + img width)
                // This might DESYNC if Layer.draw has different logic.
                const wrapWidth = width + imgW;
                // Wait, if scale changes, wrapWidth changes. 
                // Python logic: `wrap_width = screen_w + img_w_for_blit` where `img_w_for_blit` is scaled.
                // So environmental reaction depends on CURRENT scale.

                const currentScale = layer.current_scale_calculated || 1.0;
                const scaledW = imgW * currentScale;
                const scaledWrapW = width + scaledW;

                const hDrift = layer.horizontal_drift * this.elapsedTime;

                const x = (parallaxScroll + layer.x_offset + hDrift) % scaledWrapW;
                const drawX = x - scaledW;
                const centerX = drawX + scaledW / 2;

                const envY = envLayer.getYAtX(height, this.scroll, centerX, this.elapsedTime);
                this.envYData.set(layer, envY);

                // Peak Detection (omitted for MVP unless critical for gameplay events)
            }
        }

        // Draw Layers
        for (const layer of this.layers) {
            const envY = this.envYData.get(layer) ?? null;
            let envLayerForTilt = null;

            if (layer.environmental_reaction) {
                const targetName = layer.environmental_reaction.target_sprite_name;
                // OPTIMIZATION: Use pre-computed map
                envLayerForTilt = this.layersByName ? this.layersByName.get(targetName) : null;
            }

            layer.draw(
                this.ctx,
                width,
                height,
                this.scroll,
                this.elapsedTime,
                envY,
                envLayerForTilt
            );
        }
    }
}
