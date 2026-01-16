import { createLogger } from '../utils/logger.js';
import { ThemeManager } from './ThemeManager.js';

const log = createLogger('Layer');

/**
 * Behavior Runtime Version - Must match theatre.py BEHAVIOR_RUNTIME_VERSION
 * Increment when changing behavior logic to track JS/Python parity.
 */
export const BEHAVIOR_RUNTIME_VERSION = '2.1.0';

export const EventType = {
    OSCILLATE: "oscillate",
    DRIFT: "drift",
    PULSE: "pulse",
    BACKGROUND: "background",
    LOCATION: "location",
    SPARKLE: "sparkle"
};

export const CoordinateType = {
    X: "x",
    Y: "y",
    SCALE: "scale",
    ROTATION: "rotation",
    OPACITY: "opacity",
    BRIGHTNESS: "brightness"
};

import { behaviorFactory, BehaviorContext } from './BehaviorFactory.js';

export class EventRuntime {
    constructor(config) {
        this.config = config;
        this.active = config.enabled ?? true;
    }
    apply(_transform, _context) { }
}

export class OscillateRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        this.timeAccum = 0.0;
    }
    apply(transform, context) {
        if (!this.active) return;
        const { elapsedTime } = context;

        const freq = this.config.frequency || 0;
        const amp = this.config.amplitude || 0;
        const phaseOffset = this.config.phase_offset || 0;

        const phase = (elapsedTime * freq * 2 * Math.PI) + phaseOffset;
        const offset = Math.sin(phase) * amp;

        const coord = this.config.coordinate || CoordinateType.Y;
        if (coord === CoordinateType.Y) transform.y += offset;
        else if (coord === CoordinateType.X) transform.x += offset;
        else if (coord === CoordinateType.SCALE) transform.scale += offset / 100.0;
        else if (coord === CoordinateType.ROTATION) transform.rotation += offset;
    }
}

export class DriftRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        this.currentValue = 0.0;
        this.reachedCap = false;
    }
    apply(transform, context) {
        if (!this.active) return;
        const { elapsedTime } = context;

        const vel = this.config.velocity || 0;
        // Drift is physically integrative, but we can approximate it as a function of time
        // for seeking purposes, as long as we don't have complex acceleration.
        const totalDrift = vel * elapsedTime;
        this.currentValue = totalDrift;

        // Cap logic
        if (this.config.drift_cap !== null && this.config.drift_cap !== undefined) {
            const coord = this.config.coordinate || CoordinateType.Y;
            if (coord === CoordinateType.Y) {
                const targetY = transform.base_y + transform.y + this.currentValue;
                if (vel > 0 && targetY > this.config.drift_cap) {
                    this.currentValue -= (targetY - this.config.drift_cap);
                    this.reachedCap = true;
                } else if (vel < 0 && targetY < this.config.drift_cap) {
                    this.currentValue -= (targetY - this.config.drift_cap);
                    this.reachedCap = true;
                }
            } else if (coord === CoordinateType.X) {
                const targetX = transform.base_x + transform.x + this.currentValue;
                if (vel > 0 && targetX > this.config.drift_cap) {
                    this.currentValue -= (targetX - this.config.drift_cap);
                    this.reachedCap = true;
                } else if (vel < 0 && targetX < this.config.drift_cap) {
                    this.currentValue -= (targetX - this.config.drift_cap);
                    this.reachedCap = true;
                }
            }
        }

        const coord = this.config.coordinate || CoordinateType.Y;
        if (coord === CoordinateType.Y) transform.y += this.currentValue;
        else if (coord === CoordinateType.X) transform.x += this.currentValue;
        else if (coord === CoordinateType.SCALE) transform.scale += this.currentValue;
    }
}

export class PulseRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        this.timeAccum = 0.0;
    }
    apply(transform, context) {
        if (!this.active) return;
        const { elapsedTime } = context;

        // Threshold check
        if (this.config.activation_threshold_scale !== undefined && this.config.activation_threshold_scale !== null) {
            if (transform.scale > this.config.activation_threshold_scale) return;
        }

        const freq = this.config.frequency || 1.0;
        const cycle = (elapsedTime * freq) % 1.0;

        let value = 0.0;
        const waveform = this.config.waveform || "sine";

        if (waveform === "sine") {
            value = (Math.sin(cycle * 2 * Math.PI) + 1) / 2;
        } else if (waveform === "spike") {
            value = Math.pow((Math.sin(cycle * 2 * Math.PI) + 1.0) / 2.0, 10);
        }

        const minVal = this.config.min_value ?? 0.0;
        const maxVal = this.config.max_value ?? 1.0;

        const finalVal = minVal + (value * (maxVal - minVal));

        const coord = this.config.coordinate || CoordinateType.OPACITY;
        if (coord === CoordinateType.OPACITY) transform.opacity *= finalVal;
        else if (coord === CoordinateType.SCALE) transform.scale *= finalVal;
    }
}

// BackgroundRuntime is a no-op at runtime for transform, but properties are applied in init
export class BackgroundRuntime extends EventRuntime {
    apply(_transform, _context) {
        // No transform modifications for background
    }
}

export class SparkleRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        this.reset();
    }

    reset() {
        this.nextSparkleTime = 0;
        this.isSparkling = false;
        this.sparkleStartTime = 0;
        // Default config
        this.minInterval = this.config.min_interval ?? 0.5;
        this.maxInterval = this.config.max_interval ?? 2.0;
        this.duration = this.config.duration ?? 0.2; // Short duration for the sparkle
        this.maxBrightness = this.config.max_brightness ?? 2.0;
    }

    // Determine next interval
    _scheduleNext(currentTime) {
        const interval = this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
        this.nextSparkleTime = currentTime + interval;
        this.isSparkling = false;
    }

    apply(transform, context) {
        if (!this.active) return;
        const { elapsedTime } = context;

        // Initialize if first run or reset
        if (this.nextSparkleTime === 0 && !this.isSparkling) {
            this._scheduleNext(elapsedTime);
        }

        if (this.isSparkling) {
            const progress = (elapsedTime - this.sparkleStartTime) / this.duration;

            if (progress >= 1.0) {
                // Sparkle finished
                transform.brightness = 1.0;
                this._scheduleNext(elapsedTime);
            } else {
                // Calculate brightness based on progress (Triangle wave: 0 -> 1 -> 0)
                // Peak at 0.5
                let val;
                if (progress < 0.5) {
                    val = progress * 2.0; // 0 to 1
                } else {
                    val = 2.0 * (1.0 - progress); // 1 to 0
                }

                // Map 0..1 to 1.0..maxBrightness
                transform.brightness = 1.0 + (val * (this.maxBrightness - 1.0));
            }

        } else {
            // Waiting for next sparkle
            if (elapsedTime >= this.nextSparkleTime) {
                this.isSparkling = true;
                this.sparkleStartTime = elapsedTime;
                // Apply first frame of sparkle
                transform.brightness = 1.0;
            } else {
                transform.brightness = 1.0;
            }
        }
    }
}


export class LocationRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        // Any defined time_offset (including 0) makes it a keyframe
        this.isKeyframe = config.time_offset !== undefined;
    }

    apply(transform, _context) {
        if (!this.active) return;

        // For non-keyframe location behaviors (time_offset undefined), apply immediately
        if (!this.isKeyframe) {
            if (this.config.x !== undefined) transform.x += this.config.x;
            if (this.config.y !== undefined) transform.y += this.config.y;
        }
        // Keyframe-based locations are handled in Layer.getTransform via context.elapsedTime
    }

    // Static method to apply time-based location behaviors
    static applyKeyframes(transform, context) {
        const { layer, elapsedTime, screenH } = context;
        // Get all location behaviors sorted by time
        const locationBehaviors = layer.eventRuntimes
            .filter(rt => rt instanceof LocationRuntime && rt.isKeyframe)
            .map(rt => rt.config)
            .sort((a, b) => a.time_offset - b.time_offset);

        if (locationBehaviors.length === 0) return;

        // Find the keyframes to interpolate between
        let prevKeyframe = null;
        let nextKeyframe = null;

        for (let i = 0; i < locationBehaviors.length; i++) {
            const kf = locationBehaviors[i];
            if (kf.time_offset <= elapsedTime) {
                prevKeyframe = kf;
            }
            if (kf.time_offset > elapsedTime && !nextKeyframe) {
                nextKeyframe = kf;
                break;
            }
        }

        // Apply position based on keyframes
        if (prevKeyframe && nextKeyframe && nextKeyframe.interpolate) {
            const timeDiff = nextKeyframe.time_offset - prevKeyframe.time_offset;
            const t = timeDiff > 0 ? (elapsedTime - prevKeyframe.time_offset) / timeDiff : 0;
            const smoothT = Math.min(1, Math.max(0, t)); // Clamp to [0, 1]

            if (prevKeyframe.x !== undefined && nextKeyframe.x !== undefined) {
                const interpolatedX = prevKeyframe.x + (nextKeyframe.x - prevKeyframe.x) * smoothT;
                transform.x += interpolatedX;
            }
            if (prevKeyframe.y !== undefined && nextKeyframe.y !== undefined) {
                const interpolatedY = prevKeyframe.y + (nextKeyframe.y - prevKeyframe.y) * smoothT;
                transform.y += interpolatedY;
            }
            if (prevKeyframe.vertical_percent !== undefined && nextKeyframe.vertical_percent !== undefined) {
                const interpolatedVP = prevKeyframe.vertical_percent + (nextKeyframe.vertical_percent - prevKeyframe.vertical_percent) * smoothT;
                // Recalculate base_y
                const newBaseY = layer._calculateBaseY(screenH, interpolatedVP);
                transform.base_y = newBaseY + layer.y_offset;
            } else if (prevKeyframe.vertical_percent !== undefined) {
                const newBaseY = layer._calculateBaseY(screenH, prevKeyframe.vertical_percent);
                transform.base_y = newBaseY + layer.y_offset;
            }

            if (prevKeyframe.horizontal_percent !== undefined && nextKeyframe.horizontal_percent !== undefined) {
                const interpolatedHP = prevKeyframe.horizontal_percent + (nextKeyframe.horizontal_percent - prevKeyframe.horizontal_percent) * smoothT;
                // Recalculate base_x (we need screenW pass here? handle in getTransform)
                // Wait, getTransform only passes screenH. We need screenW for horizontal percent.
                // We'll store the percent in transform and calculate base_x later or update getTransform signature.
                // Actually, let's update getTransform signature to accept screenW.
                // But for now, let's store it in transform to be resolved.
                transform.horizontal_percent = interpolatedHP;
            } else if (prevKeyframe.horizontal_percent !== undefined) {
                transform.horizontal_percent = prevKeyframe.horizontal_percent;
            }

            // Scale and Rotation interpolation
            // SAFEGUARD: Never allow scale to be 0 or negative - minimum is 0.001
            if (prevKeyframe.scale !== undefined && nextKeyframe.scale !== undefined) {
                const interpolatedScale = prevKeyframe.scale + (nextKeyframe.scale - prevKeyframe.scale) * smoothT;
                // Only apply if positive; otherwise preserve existing scale
                if (interpolatedScale > 0) {
                    transform.scale = interpolatedScale;
                }
            } else if (prevKeyframe.scale !== undefined && prevKeyframe.scale > 0) {
                transform.scale = prevKeyframe.scale;
            }
            // If prevKeyframe.scale is 0 or undefined, keep the existing transform.scale (baseScale)

            if (prevKeyframe.rotation !== undefined && nextKeyframe.rotation !== undefined) {
                transform.rotation = prevKeyframe.rotation + (nextKeyframe.rotation - prevKeyframe.rotation) * smoothT;
            } else if (prevKeyframe.rotation !== undefined) {
                transform.rotation = prevKeyframe.rotation;
            }
        } else if (prevKeyframe) {
            // Use the most recent keyframe
            if (prevKeyframe.x !== undefined) transform.x += prevKeyframe.x;
            if (prevKeyframe.y !== undefined) transform.y += prevKeyframe.y;
            if (prevKeyframe.vertical_percent !== undefined) {
                const newBaseY = layer._calculateBaseY(screenH, prevKeyframe.vertical_percent);
                transform.base_y = newBaseY + layer.y_offset;
            }
            if (prevKeyframe.horizontal_percent !== undefined) {
                transform.horizontal_percent = prevKeyframe.horizontal_percent;
            }
            // SAFEGUARD: Only apply scale if it's a positive value
            if (prevKeyframe.scale !== undefined && prevKeyframe.scale > 0) {
                transform.scale = prevKeyframe.scale;
            }
            // If prevKeyframe.scale is 0 or undefined, keep the existing transform.scale (baseScale)

            if (prevKeyframe.rotation !== undefined) {
                transform.rotation = prevKeyframe.rotation;
            }
        }
    }
}

// Register core behaviors with the factory
behaviorFactory.register(EventType.OSCILLATE, OscillateRuntime);
behaviorFactory.register(EventType.DRIFT, DriftRuntime);
behaviorFactory.register(EventType.PULSE, PulseRuntime);
behaviorFactory.register(EventType.BACKGROUND, BackgroundRuntime);
behaviorFactory.register(EventType.LOCATION, LocationRuntime);
behaviorFactory.register(EventType.SPARKLE, SparkleRuntime);

export class Layer {
    constructor(config, image) {
        this.config = config;
        this.image = image;

        // Find initial LocationBehavior (ONLY undefined time_offset considered static base)
        const behaviors = config.behaviors || config.events || [];
        const initialLocation = behaviors.find(
            b => b.type === 'location' && b.time_offset === undefined
        );

        // Read positioning from LocationBehavior first, fall back to flat config
        this.z_depth = Number(initialLocation?.z_depth ?? config.z_depth ?? 0);
        this.vertical_percent = initialLocation?.vertical_percent ?? config.vertical_percent ?? 0.5;
        this.horizontal_percent = initialLocation?.horizontal_percent ?? config.horizontal_percent ?? undefined;
        this.x_offset = Number(initialLocation?.x ?? config.x_offset ?? 0);
        this.y_offset = Number(initialLocation?.y ?? config.y_offset ?? 0);

        // Scale from LocationBehavior (used as base scale, behaviors may modify)
        this._baseScale = Number(initialLocation?.scale ?? config.scale ?? 1.0);
        this._baseRotation = Number(initialLocation?.rotation ?? config.rotation ?? 0.0);

        // Other props (not in LocationBehavior)
        // Other props (not in LocationBehavior)
        this.scroll_speed = Number(config.scroll_speed ?? 0.0);
        this.is_background = config.is_background ?? false;
        this.tile_horizontal = config.tile_horizontal ?? false;
        this.tile_border = config.tile_border ?? 0;
        this.fill_down = config.fill_down ?? false;
        this.vertical_anchor = config.vertical_anchor ?? "center";
        this.height_scale = config.height_scale;

        // Process Image
        this.processedImage = this._processImage(image);
        this.original_image_size = {
            width: this.processedImage ? this.processedImage.width : 0,
            height: this.processedImage ? this.processedImage.height : 0
        };

        // Initialize Events
        this.eventRuntimes = [];
        this._initEvents(config);

        this.visible = true;
        this.isSelected = false; // For visual highlighting during interaction
        this.environmental_reaction = config.environmental_reaction || null;

        log.debug(`[${this.config.sprite_name}] Initialized: z=${this.z_depth}, scale=${this._baseScale}, pos=(${this.x_offset}, ${this.y_offset}), v_percent=${this.vertical_percent}`);
    }

    _initEvents(config) {
        this.eventRuntimes = [];
        const events = config.behaviors || config.events || [];

        events.forEach(evt => {
            const runtime = behaviorFactory.create(evt);
            if (runtime) {
                this.eventRuntimes.push(runtime);

                // Side effects for specific behaviors
                if (evt.type === EventType.DRIFT) {
                    // Extract scroll_speed from DriftBehavior with X coordinate
                    if (evt.coordinate === CoordinateType.X && evt.velocity !== undefined) {
                        this.scroll_speed = evt.velocity;
                    }
                } else if (evt.type === EventType.BACKGROUND) {
                    this.is_background = true;
                    if (evt.scroll_speed !== undefined) {
                        this.scroll_speed = evt.scroll_speed;
                    }
                }
            }
        });
    }

    resetState() {
        this.currentTilt = undefined;
        this._currentYPhys = undefined;
        this.lastDrawnX = undefined;
        // Runtimes are now largely stateless, but we can reset cumulative values if any remain
        this.eventRuntimes.forEach(rt => {
            if (rt instanceof DriftRuntime) {
                rt.currentValue = 0;
                rt.reachedCap = false;
            }
            if (rt.timeAccum !== undefined) rt.timeAccum = 0;
            // Reset Sparkle runtime state
            if (rt instanceof SparkleRuntime) {
                rt.reset();
            }
        });
    }

    // --- Interaction Methods ---

    containsPoint(x, y, screenW, screenH, scrollX, elapsedTime = 0) {
        if (!this.processedImage || !this.visible) return false;
        if (this.is_background) return false; // Backgrounds not selectable

        const tf = this.getTransform(screenH, screenW, 0, elapsedTime);
        const { width: baseW, height: baseH } = this._getBaseDimensions(screenH);
        const imgW = baseW * Math.max(0.001, tf.scale);
        const imgH = baseH * Math.max(0.001, tf.scale);

        // Use the ACTUAL rendered rotation and Y position if available (from environmental reaction)
        const finalRot = (this.currentTilt !== undefined) ? (tf.rotation + this.currentTilt) : tf.rotation;

        const parallaxScroll = this.scroll_speed * scrollX;
        const scrollOffset = (parallaxScroll + this.x_offset + tf.x + (tf.base_x || 0));

        // Use _currentYPhys if available, otherwise fall back to calculated base
        let finalY = (this._currentYPhys !== undefined) ? this._currentYPhys : (tf.base_y + tf.y);

        const checkPointStyle = (drawX, drawY) => {
            const cx = drawX + imgW / 2;
            const cy = drawY + imgH / 2;

            // Transform point into local rotated space
            const dx = x - cx;
            const dy = y - cy;
            const rad = -finalRot * Math.PI / 180;
            const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
            const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

            return Math.abs(lx) <= imgW / 2 && Math.abs(ly) <= imgH / 2;
        };

        // Handle tiling
        if (this.tile_horizontal) {
            const startX = scrollOffset % imgW;
            // Draw many tiles to support zooming out
            // We draw 50 tiles left and 50 tiles right of the main frame
            for (let i = -50; i <= 50; i++) {
                const currX = startX + (i * imgW);
                if (checkPointStyle(currX, finalY)) return true;
            }
        } else {
            // No wrapping for single sprites - use true world coordinates
            const drawX = scrollOffset;
            if (checkPointStyle(drawX, finalY)) return true;
        }

        return false;
    }

    setPosition(x, y) {
        // Update position offsets for interactive dragging
        this.x_offset = x;
        this.y_offset = y;
    }

    _processImage(originalImage) {
        if (!originalImage) return null;

        const w = originalImage.naturalWidth || originalImage.width;
        const h = originalImage.naturalHeight || originalImage.height;

        // If no tiling and no fill down, we can use the original image directly
        if (this.tile_border <= 0 && !this.fill_down) return originalImage;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let targetW = w;
        let sourceX = 0;

        if (this.tile_border > 0) {
            sourceX = this.tile_border;
            targetW = w - (2 * this.tile_border);
        }

        canvas.width = targetW;
        canvas.height = h;

        // Draw the (possibly cropped) image to the canvas
        ctx.drawImage(originalImage, sourceX, 0, targetW, h, 0, 0, targetW, h);

        if (this.fill_down) {
            // Get bottom-middle pixel color for filling downward
            try {
                const pixelData = ctx.getImageData(Math.floor(targetW / 2), h - 1, 1, 1).data;
                this.fillColor = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;
            } catch (e) {
                log.warn("Failed to sample fill color:", e);
                this.fillColor = "transparent";
            }
        }

        return canvas;
    }

    _getBaseDimensions(screenH) {
        let imgW = this.processedImage ? this.processedImage.width : 0;
        let imgH = this.processedImage ? this.processedImage.height : 0;

        if (this.height_scale) {
            imgH = screenH * this.height_scale;
            const aspect = (this.processedImage.width / this.processedImage.height);
            imgW = imgH * aspect;
            log.debug(`[${this.config.sprite_name}] Base dims (height_scale=${this.height_scale}): ${imgW.toFixed(1)}x${imgH.toFixed(1)} (screenH=${screenH})`);
        } else if (this.config.target_height) {
            imgH = this.config.target_height;
            const aspect = (this.processedImage.width / this.processedImage.height);
            imgW = imgH * aspect;
            log.debug(`[${this.config.sprite_name}] Base dims (target_height=${this.config.target_height}): ${imgW.toFixed(1)}x${imgH.toFixed(1)}`);
        } else {
            log.debug(`[${this.config.sprite_name}] Base dims (original): ${imgW.toFixed(1)}x${imgH.toFixed(1)}`);
        }
        return { width: imgW, height: imgH };
    }

    _calculateBaseY(screenH, verticalPercent) {
        const { height } = this._getBaseDimensions(screenH);
        const baseY = screenH * verticalPercent;

        if (this.vertical_anchor === "bottom") return baseY - height;
        else if (this.vertical_anchor === "top") return baseY;
        else return baseY - (height / 2);
    }

    _getBaseY(screenH) {
        return this._calculateBaseY(screenH, this.vertical_percent);
    }

    _calculateBaseX(screenW, screenH, horizontalPercent) {
        if (horizontalPercent === undefined || horizontalPercent === null) return 0;
        const { width } = this._getBaseDimensions(screenH);

        const baseX = screenW * horizontalPercent;
        return baseX - (width / 2); // Center on percent
    }

    _getBaseX(screenW, screenH) {
        return this._calculateBaseX(screenW, screenH, this.horizontal_percent);
    }

    getTransform(screenH, screenW, dt, elapsedTime = 0) {
        const transform = {
            x: 0.0,
            y: 0.0,
            base_y: this._getBaseY(screenH) + this.y_offset,
            base_x: this._getBaseX(screenW, screenH),
            scale: this._baseScale ?? 1.0,
            rotation: this._baseRotation ?? 0.0,
            opacity: 1.0,
            brightness: 1.0, // Default brightness
            horizontal_percent: this.horizontal_percent // Default
        };

        const context = new BehaviorContext({
            layer: this,
            dt,
            elapsedTime,
            screenW,
            screenH
        });

        // Apply events
        this.eventRuntimes.forEach(runtime => {
            runtime.apply(transform, context);
        });

        // Apply time-based location keyframes
        LocationRuntime.applyKeyframes(transform, context);

        // Resolve horizontal_percent if modified by keyframes
        if (transform.horizontal_percent !== undefined && transform.horizontal_percent !== null) {
            transform.base_x = this._calculateBaseX(screenW, screenH, transform.horizontal_percent);
        }

        return transform;
    }

    getYAtX(screenW, screenH, scrollX, targetX, elapsedTime) {
        if (!this.processedImage) return screenH;

        // 1. Calculate the actual drawn width (base scaling * transform scale)
        const tf = this.getTransform(screenH, screenW, 0, elapsedTime);
        const { width: baseW } = this._getBaseDimensions(screenH);
        const drawnW = baseW * Math.max(0.001, tf.scale);
        const baseY = tf.base_y + tf.y;

        // 2. Map screen X to local normalized X (0 to drawnW)
        const parallaxScroll = this.scroll_speed * scrollX;
        const scrollOffset = (parallaxScroll + this.x_offset + tf.x + (tf.base_x || 0));

        let localX = (targetX - scrollOffset) % drawnW;
        if (localX < 0) localX += drawnW;

        // 3. Map localX to actual pixels in the source image
        // ratio is [local pixels] / [source pixels]
        const ratio = drawnW / this.processedImage.width;
        const xInt = Math.floor(localX / ratio);

        if (xInt < 0 || xInt >= this.processedImage.width) return screenH;

        // 4. Lazy initialize collision data
        if (!this._collisionData) {
            const c = document.createElement('canvas');
            c.width = this.processedImage.width;
            c.height = this.processedImage.height;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(this.processedImage, 0, 0);
            this._collisionData = ctx.getImageData(0, 0, c.width, c.height);
        }

        const data = this._collisionData.data;
        const h = this.processedImage.height;
        const width = this.processedImage.width;

        // 5. Scan vertical column for first non-transparent pixel
        for (let y = 0; y < h; y++) {
            const alpha = data[(y * width + xInt) * 4 + 3];
            if (alpha > 10) {
                // Found it. Map local Y back to screen Y.
                // localY_scaled = y * ratio
                const foundY = baseY + (y * ratio);
                return foundY;
            }
        }

        return screenH;
    }

    draw(ctx, screenW, screenH, scrollX, elapsedTime, dt, envLayer = null, _isPaused = false, _cropMode = false) {
        // Use the actual dt value - when paused, dt should be 0 to freeze behaviors
        // Only use fallback for environmental smoothing calculations, not behavior accumulation
        const frameDtForSmoothing = dt > 0 ? dt : (1 / 60);
        if (!this.processedImage || !this.visible) return;

        if (this.is_background) {
            this._drawBackground(ctx, screenW, screenH);
            return;
        }

        // Reset debug data for this frame
        this._debugInteractionData = null;

        const tf = this.getTransform(screenH, screenW, dt, elapsedTime);

        const finalX = tf.x + (tf.base_x || 0); // Include base_x from horizontal_percent
        let finalY = tf.base_y + tf.y;
        let finalScale = Math.max(0.001, tf.scale);
        let finalRot = tf.rotation;

        const finalAlpha = Math.max(0, Math.min(1.0, tf.opacity));
        const finalBrightness = Math.max(0, tf.brightness ?? 1.0);

        // Draw the sprite
        // Rule 1b: Transparency on Selection
        if (this.isSelected) {
            ctx.globalAlpha = 0.2;
        } else {
            ctx.globalAlpha = finalAlpha;
        }

        // Apply brightness filter if needed
        if (finalBrightness !== 1.0) {
            ctx.filter = `brightness(${finalBrightness * 100}%)`;
        }

        // --- Calculate Initial Drawn Dimensions ---
        let { width: imgW, height: imgH } = this._getBaseDimensions(screenH);
        imgW *= finalScale;
        imgH *= finalScale;

        // --- Environmental Reaction Logic (Hull Contact Model) ---
        if (this.environmental_reaction && envLayer) {
            const reaction = this.environmental_reaction;
            const hullFactor = reaction.hull_length_factor ?? 0.5;

            // 1. Determine local center and sampling offsets
            const parallaxX = (scrollX * this.scroll_speed) + this.x_offset;
            const centerX = parallaxX + finalX + (imgW / 2);

            const offsetW = imgW * (hullFactor / 2);
            const xStern = centerX - offsetW;
            const xBow = centerX + offsetW;

            // 2. Sample environment heights
            const yStern = envLayer.getYAtX(screenW, screenH, scrollX, xStern, elapsedTime);
            const yBow = envLayer.getYAtX(screenW, screenH, scrollX, xBow, elapsedTime);

            // 3. Calculate target position and tilt
            const targetEnvY = (yStern + yBow) / 2.0;
            // Old debug block removed


            // Slope-based angle
            const hullDist = xBow - xStern;
            let angleDeg = 0;
            if (hullDist > 0) {
                const slope = (yBow - yStern) / hullDist;
                // JS atan(slope) -> nose down is positive CW
                angleDeg = Math.atan(slope) * (180 / Math.PI);
            }

            // Apply sensitivity and ramp-in (matches backend 5x factor)
            const startRamp = (scrollX > 0) ? Math.min(1.0, scrollX / 300.0) : 0;
            const targetTilt = angleDeg * 5.0 * startRamp;
            const limit = reaction.max_tilt_angle || 30.0;
            const clampedTilt = Math.max(-limit, Math.min(limit, targetTilt));

            // Smoothing / Inertia
            if (this.currentTilt === undefined) {
                this.currentTilt = clampedTilt;
            } else {
                // Use frame-rate independent smoothing: 0.1 at 60fps
                // Use frameDtForSmoothing to ensure smoothing works even when paused
                const smoothingFactor = 1.0 - Math.pow(0.9, frameDtForSmoothing * 60);
                this.currentTilt += (clampedTilt - this.currentTilt) * smoothingFactor;
            }
            finalRot += this.currentTilt;

            // Update debug data with final targets if needed
            if (this._debugInteractionData) {
                this._debugInteractionData.targetTilt = targetTilt;
            }

            // Vertical Position smoothing
            const followFactor = reaction.vertical_follow_factor ?? 1.0;
            if (followFactor >= 0) {
                // Determine img height for positioning (account for fill_down logic if needed)
                const imgHPos = this.fill_down ? (this.processedImage.height * (imgH / this.processedImage.height)) : imgH;

                // Desired final_y relative to the environment surface
                // Adjust for anchor: targetEnvY is where the ANCHOR point should be
                let anchorOffset = 0;
                if (this.vertical_anchor === "bottom") anchorOffset = -imgHPos;
                else if (this.vertical_anchor === "center") anchorOffset = -imgHPos / 2;
                // else top: 0

                let desiredY = targetEnvY + this.y_offset + anchorOffset - (imgHPos * (1.0 - followFactor));


                // Vertical lift based on tilt
                const lift = this.currentTilt * (reaction.tilt_lift_factor ?? 0.0);
                desiredY -= lift;

                if (this._currentYPhys === undefined) {
                    this._currentYPhys = desiredY;
                } else {
                    const ySmoothingFactor = 1.0 - Math.pow(0.9, frameDtForSmoothing * 60);
                    this._currentYPhys += (desiredY - this._currentYPhys) * ySmoothingFactor;
                }
                finalY = this._currentYPhys;
            }

            // --- Update Debug Data (Always if interacting) ---
            // Calculate where the "Hull Points" of the object actually ARE (transformed)
            // Center of rotation is center of sprite
            const rotCX = centerX;
            const rotCY = finalY + (imgH / 2); // Center Y relative to drawn Y (top-left)

            // Local Offsets
            // Stern: x = -offsetW, y = +imgH/2 (Bottom of sprite)
            // Bow:   x = +offsetW, y = +imgH/2 (Bottom of sprite)
            const rad = finalRot * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            // Stern (Left)
            const sternLX = -offsetW;
            const sternLY = imgH / 2; // Bottom relative to center
            const objSternX = rotCX + (sternLX * cos - sternLY * sin);
            const objSternY = rotCY + (sternLX * sin + sternLY * cos);

            // Bow (Right)
            const bowLX = offsetW;
            const bowLY = imgH / 2;
            const objBowX = rotCX + (bowLX * cos - bowLY * sin);
            const objBowY = rotCY + (bowLX * sin + bowLY * cos);

            this._debugInteractionData = {
                xStern, yStern, xBow, yBow, // Environment Points
                centerX, targetEnvY, tilt: this.currentTilt, targetTilt,
                objSternX, objSternY, objBowX, objBowY // Object Points
            };
        }

        // Final position - centering for rotation matches Pygame's center-of-image anchor
        const parallaxScroll = this.scroll_speed * scrollX;
        const scrollOffset = (parallaxScroll + this.x_offset + finalX);
        this.lastDrawnX = scrollOffset; // Store for telemetry

        if (this.tile_horizontal) {
            const startX = scrollOffset % imgW;
            // Draw many tiles to support zooming out
            for (let i = -50; i <= 50; i++) {
                const currX = startX + (i * imgW);
                if (finalRot !== 0) {
                    ctx.save();
                    ctx.translate(currX + imgW / 2, finalY + imgH / 2);
                    ctx.rotate(finalRot * Math.PI / 180);
                    ctx.drawImage(this.processedImage, -imgW / 2, -imgH / 2, imgW, imgH);

                    if (this.fill_down) {
                        ctx.fillStyle = this.fillColor;
                        ctx.fillRect(-imgW / 2, imgH / 2, imgW, screenH * 10); // Increased fill height for zoom-out
                    }
                    ctx.restore();
                } else {
                    ctx.drawImage(this.processedImage, currX, finalY, imgW, imgH);
                    if (this.fill_down) {
                        ctx.fillStyle = this.fillColor;
                        ctx.fillRect(currX, finalY + imgH, imgW, screenH * 10);
                    }
                }
            }
        } else {
            // No wrapping for single sprites
            const drawX = scrollOffset;

            if (finalRot !== 0) {
                const cx = drawX + imgW / 2;
                const cy = finalY + imgH / 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(finalRot * Math.PI / 180);
                ctx.drawImage(this.processedImage, -imgW / 2, -imgH / 2, imgW, imgH);

                if (this.fill_down) {
                    ctx.fillStyle = this.fillColor;
                    ctx.fillRect(-imgW / 2, imgH / 2, imgW, screenH * 2);
                }
                ctx.restore();
            } else {
                ctx.drawImage(this.processedImage, drawX, finalY, imgW, imgH);
                if (this.fill_down) {
                    ctx.fillStyle = this.fillColor;
                    ctx.fillRect(drawX, finalY + imgH, imgW, screenH * 10); // Use 10x screenH to support zoom out
                }
            }
        }


        // Reset filter
        if (finalBrightness !== 1.0) {
            ctx.filter = 'none';
        }

        // Rule 1b: Reset Alpha so handles are opaque
        ctx.globalAlpha = 1.0;

        // Draw interactive handles when sprite is selected (always show for editing)
        // This allows users to see and interact with the sprite bounds at any time
        const showHandles = this.isSelected;
        if (showHandles) {
            const theme = ThemeManager.theme;
            const accentColor = theme.selectionAccent;
            const glowColor = theme.selectionGlow;

            const handleSize = 8;
            const rotateHandleSize = 10;
            const handleGlow = glowColor;
            const handleFill = accentColor;

            const drawHandles = (x, y, w, h) => {
                ctx.save();
                ctx.translate(x + w / 2, y + h / 2);
                ctx.rotate(finalRot * Math.PI / 180);

                // Main bounding box
                ctx.strokeStyle = accentColor;
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.strokeRect(-w / 2, -h / 2, w, h);
                ctx.setLineDash([]);

                // Scale handles (corners and edges)
                const handles = [
                    { x: -w / 2, y: -h / 2, cursor: 'nwse-resize', id: 'tl' },
                    { x: w / 2, y: -h / 2, cursor: 'nesw-resize', id: 'tr' },
                    { x: -w / 2, y: h / 2, cursor: 'nesw-resize', id: 'bl' },
                    { x: w / 2, y: h / 2, cursor: 'nwse-resize', id: 'br' },
                    { x: 0, y: -h / 2, cursor: 'ns-resize', id: 'mt' },
                    { x: 0, y: h / 2, cursor: 'ns-resize', id: 'mb' },
                    { x: -w / 2, y: 0, cursor: 'ew-resize', id: 'ml' },
                    { x: w / 2, y: 0, cursor: 'ew-resize', id: 'mr' }
                ];

                handles.forEach(c => {
                    ctx.fillStyle = handleGlow;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, handleSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = handleFill;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, handleSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Rotate handle (top center)
                const rotY = -h / 2 - 25;
                ctx.beginPath();
                ctx.moveTo(0, -h / 2);
                ctx.lineTo(0, rotY);
                ctx.stroke();

                ctx.fillStyle = handleGlow;
                ctx.beginPath();
                ctx.arc(0, rotY, rotateHandleSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = handleFill;
                ctx.beginPath();
                ctx.arc(0, rotY, rotateHandleSize / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            };

            if (this.tile_horizontal) {
                const startX = scrollOffset % imgW;
                let currX = startX;
                if (currX > 0) currX -= imgW;
                while (currX < screenW) {
                    drawHandles(currX, finalY, imgW, imgH);
                    currX += imgW;
                }
            } else {
                // No wrapping for single sprites
                const drawX = scrollOffset;
                drawHandles(drawX, finalY, imgW, imgH);
            }
        }

        ctx.globalAlpha = 1.0;

        // Debug data is now consumed by Theatre.js for top-level rendering
    }

    getHandleAtPoint(x, y, screenW, screenH, scrollX) {
        if (!this.isSelected || this.is_background) return null;

        const tf = this.getTransform(screenH, screenW, 0, 0);
        const { width: baseW, height: baseH } = this._getBaseDimensions(screenH);
        const imgW = baseW * Math.max(0.001, tf.scale);
        const imgH = baseH * Math.max(0.001, tf.scale);
        const finalRot = tf.rotation;

        const parallaxScroll = this.scroll_speed * scrollX;
        const scrollOffset = (parallaxScroll + this.x_offset + tf.x + (tf.base_x || 0));

        const checkHandles = (drawX, drawY) => {
            const cx = drawX + imgW / 2;
            const cy = drawY + imgH / 2;

            // Transform point into local rotated space
            const dx = x - cx;
            const dy = y - cy;
            const rad = -finalRot * Math.PI / 180;
            const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
            const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

            const handleTolerance = 15;

            // Rotate handle
            const rotY = -imgH / 2 - 25;
            if (Math.abs(lx) < handleTolerance && Math.abs(ly - rotY) < handleTolerance) {
                return { type: 'rotate' };
            }

            // Scale handles (corners)
            if (Math.abs(lx - (-imgW / 2)) < handleTolerance && Math.abs(ly - (-imgH / 2)) < handleTolerance) return { type: 'scale', id: 'tl' };
            if (Math.abs(lx - (imgW / 2)) < handleTolerance && Math.abs(ly - (-imgH / 2)) < handleTolerance) return { type: 'scale', id: 'tr' };
            if (Math.abs(lx - (-imgW / 2)) < handleTolerance && Math.abs(ly - (imgH / 2)) < handleTolerance) return { type: 'scale', id: 'bl' };
            if (Math.abs(lx - (imgW / 2)) < handleTolerance && Math.abs(ly - (imgH / 2)) < handleTolerance) return { type: 'scale', id: 'br' };

            // Scale handles (edges)
            if (Math.abs(lx - 0) < handleTolerance && Math.abs(ly - (-imgH / 2)) < handleTolerance) return { type: 'scale', id: 'mt' };
            if (Math.abs(lx - 0) < handleTolerance && Math.abs(ly - (imgH / 2)) < handleTolerance) return { type: 'scale', id: 'mb' };
            if (Math.abs(lx - (-imgW / 2)) < handleTolerance && Math.abs(ly - 0) < handleTolerance) return { type: 'scale', id: 'ml' };
            if (Math.abs(lx - (imgW / 2)) < handleTolerance && Math.abs(ly - 0) < handleTolerance) return { type: 'scale', id: 'mr' };

            return null;
        };

        if (this.tile_horizontal) {
            const startX = scrollOffset % imgW;
            for (let i = -50; i <= 50; i++) {
                const currX = startX + (i * imgW);
                const h = checkHandles(currX, tf.base_y + tf.y);
                if (h) return h;
            }
        } else {
            // No wrapping for single sprites
            const drawX = scrollOffset;
            return checkHandles(drawX, tf.base_y + tf.y);
        }

        return null;
    }

    setRotation(deg, time = 0) {
        const behaviors = this.config.behaviors || [];
        const locs = behaviors.filter(b => b.type === 'location' && (
            b.time_offset === undefined ||
            b.time_offset === 0 ||
            (time > 0 && Math.abs(b.time_offset - time) < 0.2)
        ));
        locs.forEach(loc => {
            loc.rotation = deg;
        });
        if (locs.length === 0 && (time === undefined || time < 0.1)) {
            this.config.rotation = deg;
        }
    }

    setScale(s, time = 0) {
        this._baseScale = s;
        const behaviors = this.config.behaviors || [];
        // Update both the static location (undefined time_offset) and the keyframe nearest to current time
        const locs = behaviors.filter(b => b.type === 'location' && (
            b.time_offset === undefined ||
            b.time_offset === 0 ||
            (time > 0 && Math.abs(b.time_offset - time) < 0.2)
        ));
        locs.forEach(loc => {
            loc.scale = s;
        });
        if (locs.length === 0 && (time === undefined || time < 0.1)) {
            this.config.scale = s;
        }
    }

    _drawBackground(ctx, screenW, screenH) {
        // Draw image scaled to fill the viewport (cover)
        const imgW = this.processedImage.width;
        const imgH = this.processedImage.height;
        const scale = Math.max(screenW / imgW, screenH / imgH);
        const newW = imgW * scale;
        const newH = imgH * scale;
        const x = (screenW - newW) / 2;
        const y = (screenH - newH) / 2;
        ctx.drawImage(this.processedImage, x, y, newW, newH);
    }
}
