export const EventType = {
    OSCILLATE: "oscillate",
    DRIFT: "drift",
    PULSE: "pulse",
    BACKGROUND: "background",
    LOCATION: "location"
};

export const CoordinateType = {
    X: "x",
    Y: "y",
    SCALE: "scale",
    ROTATION: "rotation",
    OPACITY: "opacity"
};

class EventRuntime {
    constructor(config) {
        this.config = config;
        this.active = config.enabled ?? true;
    }
    apply(_layer, _dt, _transform) { }
}

class OscillateRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        this.timeAccum = 0.0;
    }
    apply(layer, dt, transform) {
        if (!this.active) return;
        this.timeAccum += dt;

        const freq = this.config.frequency || 0;
        const amp = this.config.amplitude || 0;
        const phaseOffset = this.config.phase_offset || 0;

        const phase = (this.timeAccum * freq * 2 * Math.PI) + phaseOffset;
        const offset = Math.sin(phase) * amp;

        const coord = this.config.coordinate || CoordinateType.Y;
        if (coord === CoordinateType.Y) transform.y += offset;
        else if (coord === CoordinateType.X) transform.x += offset;
        else if (coord === CoordinateType.SCALE) transform.scale += offset / 100.0;
        else if (coord === CoordinateType.ROTATION) transform.rotation += offset;
    }
}

class DriftRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        this.currentValue = 0.0;
        this.reachedCap = false;
    }
    apply(layer, dt, transform) {
        if (!this.active) return;

        const vel = this.config.velocity || 0;
        const delta = vel * dt;
        this.currentValue += delta;

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
            }
        }

        const coord = this.config.coordinate || CoordinateType.Y;
        if (coord === CoordinateType.Y) transform.y += this.currentValue;
        else if (coord === CoordinateType.X) transform.x += this.currentValue;
        else if (coord === CoordinateType.SCALE) transform.scale += this.currentValue;
    }
}

class PulseRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        this.timeAccum = 0.0;
    }
    apply(layer, dt, transform) {
        if (!this.active) return;

        // Threshold check
        if (this.config.activation_threshold_scale !== undefined && this.config.activation_threshold_scale !== null) {
            if (transform.scale > this.config.activation_threshold_scale) return;
        }

        this.timeAccum += dt;
        const freq = this.config.frequency || 1.0;
        const cycle = (this.timeAccum * freq) % 1.0;

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
class BackgroundRuntime extends EventRuntime {
    apply(_layer, _dt, _transform) {
        // No transform modifications for background
    }
}

class LocationRuntime extends EventRuntime {
    constructor(config) {
        super(config);
        // Any defined time_offset (including 0) makes it a keyframe
        this.isKeyframe = config.time_offset !== undefined;
    }

    apply(layer, dt, transform) {
        if (!this.active) return;

        // For non-keyframe location behaviors (time_offset undefined), apply immediately
        if (!this.isKeyframe) {
            if (this.config.x !== undefined) transform.x += this.config.x;
            if (this.config.y !== undefined) transform.y += this.config.y;
        }
        // Keyframe-based locations are handled in Layer.getTransform via elapsedTime
    }

    // Static method to apply time-based location behaviors
    static applyKeyframes(layer, elapsedTime, transform, screenH) {
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
            // Interpolate between keyframes
            const t = (elapsedTime - prevKeyframe.time_offset) /
                (nextKeyframe.time_offset - prevKeyframe.time_offset);
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
        }
    }
}


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
        this.z_depth = initialLocation?.z_depth ?? config.z_depth ?? 1;
        this.vertical_percent = initialLocation?.vertical_percent ?? config.vertical_percent ?? 0.5;
        this.horizontal_percent = initialLocation?.horizontal_percent ?? config.horizontal_percent ?? undefined;
        this.x_offset = initialLocation?.x ?? config.x_offset ?? 0;
        this.y_offset = initialLocation?.y ?? config.y_offset ?? 0;

        // Scale from LocationBehavior (used as base scale, behaviors may modify)
        this._baseScale = initialLocation?.scale ?? config.scale ?? 1.0;

        // Other props (not in LocationBehavior)
        this.scroll_speed = config.scroll_speed ?? 0.0;
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
        if (!this.environmental_reaction && config.reacts_to_environment) {
            // Legacy migration logic (duplicating backend logic)
            // If strictly needed for frontend-only loading without backend compilation
            this.environmental_reaction = {
                reaction_type: "pivot_on_crest",
                target_sprite_name: "wave1", // legacy default
                max_tilt_angle: config.max_env_tilt || 30.0,
                vertical_follow_factor: 1.0
            };
        }
    }

    _initEvents(config) {
        let events = config.behaviors || config.events || [];

        // MIGRATION: Logic to convert legacy overrides to events on the fly if events are missing?
        // Ideally backend does this, but for pure frontend loaded overrides, we do it here.
        if (events.length === 0) {
            if (config.bob_amplitude && config.bob_frequency) {
                events.push({
                    type: EventType.OSCILLATE,
                    frequency: config.bob_frequency,
                    amplitude: config.bob_amplitude,
                    coordinate: CoordinateType.Y
                });
            }
            if (config.vertical_drift) {
                events.push({
                    type: EventType.DRIFT,
                    velocity: config.vertical_drift,
                    coordinate: CoordinateType.Y,
                    drift_cap: config.drift_cap_y
                });
            }
            if (config.twinkle_amplitude) {
                events.push({
                    type: EventType.PULSE,
                    frequency: config.twinkle_frequency,
                    min_value: 1.0 - config.twinkle_amplitude,
                    max_value: 1.0,
                    waveform: "spike",
                    coordinate: CoordinateType.OPACITY,
                    activation_threshold_scale: config.twinkle_min_scale
                });
            }
        }

        events.forEach(evt => {
            if (evt.type === EventType.OSCILLATE) {
                this.eventRuntimes.push(new OscillateRuntime(evt));
            } else if (evt.type === EventType.DRIFT) {
                this.eventRuntimes.push(new DriftRuntime(evt));
                // Extract scroll_speed from DriftBehavior with X coordinate
                // This handles the migration from scroll_speed field to DriftBehavior
                if (evt.coordinate === CoordinateType.X && evt.velocity !== undefined) {
                    this.scroll_speed = evt.velocity;
                }
            } else if (evt.type === EventType.PULSE) {
                this.eventRuntimes.push(new PulseRuntime(evt));
            } else if (evt.type === EventType.BACKGROUND) {
                this.eventRuntimes.push(new BackgroundRuntime(evt));
                this.is_background = true;
                if (evt.scroll_speed !== undefined) {
                    this.scroll_speed = evt.scroll_speed;
                }
            } else if (evt.type === EventType.LOCATION) {
                this.eventRuntimes.push(new LocationRuntime(evt));
            }
        });
    }

    // --- Interaction Methods ---

    containsPoint(x, y, screenW, screenH, scrollX) {
        if (!this.processedImage || !this.visible) return false;
        if (this.is_background) return false; // Backgrounds not selectable

        const tf = this.getTransform(screenH, screenW, 0, 0); // pass proper args
        const { width: baseW, height: baseH } = this._getBaseDimensions(screenH);
        const imgW = baseW * Math.max(0.001, tf.scale);
        const imgH = baseH * Math.max(0.001, tf.scale);

        const parallaxScroll = this.scroll_speed * scrollX;
        const scrollOffset = (parallaxScroll + this.x_offset + tf.x + (tf.base_x || 0));

        let finalY = tf.base_y + tf.y;

        // Handle tiling
        if (this.tile_horizontal) {
            const startX = scrollOffset % imgW;
            let currX = startX;
            if (currX > 0) currX -= imgW;

            while (currX < screenW) {
                if (x >= currX && x <= currX + imgW && y >= finalY && y <= finalY + imgH) {
                    return true;
                }
                currX += imgW;
            }
        } else {
            const wrapW = screenW + imgW;
            const drawX = ((scrollOffset) % wrapW) - imgW;

            if (x >= drawX && x <= drawX + imgW && y >= finalY && y <= finalY + imgH) {
                return true;
            }
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
                console.warn("Failed to sample fill color:", e);
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
        } else if (this.config.target_height) {
            imgH = this.config.target_height;
            const aspect = (this.processedImage.width / this.processedImage.height);
            imgW = imgH * aspect;
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
            rotation: 0.0,
            opacity: 1.0,
            horizontal_percent: this.horizontal_percent // Default
        };

        // Apply events
        this.eventRuntimes.forEach(runtime => {
            runtime.apply(this, dt, transform);
        });

        // Apply time-based location keyframes
        LocationRuntime.applyKeyframes(this, elapsedTime, transform, screenH);

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

    draw(ctx, screenW, screenH, scrollX, elapsedTime, dt, envLayer = null) {
        const frameDt = dt || (1 / 60);
        if (!this.processedImage || !this.visible) return;

        if (this.is_background) {
            this._drawBackground(ctx, screenW, screenH);
            return;
        }

        const tf = this.getTransform(screenH, screenW, frameDt, elapsedTime);

        const finalX = tf.x + (tf.base_x || 0); // Include base_x from horizontal_percent
        let finalY = tf.base_y + tf.y;
        let finalScale = Math.max(0.001, tf.scale);
        let finalRot = tf.rotation;
        const finalAlpha = Math.max(0, Math.min(1.0, tf.opacity));

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

            // 4. Smoothing / Inertia
            if (this.currentTilt === undefined) this.currentTilt = 0;
            // Use frame-rate independent smoothing: 0.1 at 60fps
            const smoothingFactor = 1.0 - Math.pow(0.9, frameDt * 60);
            this.currentTilt += (clampedTilt - this.currentTilt) * smoothingFactor;
            finalRot += this.currentTilt;

            // Vertical Position smoothing
            const followFactor = reaction.vertical_follow_factor ?? 1.0;
            if (followFactor >= 0) {
                // Determine img height for positioning (account for fill_down logic if needed)
                const imgHPos = this.fill_down ? (this.processedImage.height * (imgH / this.processedImage.height)) : imgH;

                // Desired final_y relative to the environment surface
                let desiredY = targetEnvY + this.y_offset - (imgHPos * (1.0 - followFactor));

                // Vertical lift based on tilt
                const lift = this.currentTilt * (reaction.tilt_lift_factor ?? 0.0);
                desiredY -= lift;

                if (this._currentYPhys === undefined) this._currentYPhys = finalY;
                const ySmoothingFactor = 1.0 - Math.pow(0.9, frameDt * 60);
                this._currentYPhys += (desiredY - this._currentYPhys) * ySmoothingFactor;
                finalY = this._currentYPhys;
            }
        }

        ctx.globalAlpha = finalAlpha;

        // Final position - centering for rotation matches Pygame's center-of-image anchor
        const parallaxScroll = this.scroll_speed * scrollX;
        const scrollOffset = (parallaxScroll + this.x_offset + finalX);
        this.lastDrawnX = scrollOffset; // Store for telemetry

        if (this.tile_horizontal) {
            const startX = scrollOffset % imgW;
            let currX = startX;
            if (currX > 0) currX -= imgW;

            while (currX < screenW) {
                if (finalRot !== 0) {
                    ctx.save();
                    ctx.translate(currX + imgW / 2, finalY + imgH / 2);
                    ctx.rotate(finalRot * Math.PI / 180);
                    ctx.drawImage(this.processedImage, -imgW / 2, -imgH / 2, imgW, imgH);

                    if (this.fill_down) {
                        ctx.fillStyle = this.fillColor;
                        ctx.fillRect(-imgW / 2, imgH / 2, imgW, screenH); // Fill to bottom of screen
                    }
                    ctx.restore();
                } else {
                    ctx.drawImage(this.processedImage, currX, finalY, imgW, imgH);
                    if (this.fill_down) {
                        ctx.fillStyle = this.fillColor;
                        ctx.fillRect(currX, finalY + imgH, imgW, screenH);
                    }
                }
                currX += imgW;
            }
        } else {
            const wrapW = screenW + imgW;
            const x = (scrollOffset) % wrapW;
            const drawX = x - imgW;

            if (finalRot !== 0) {
                const cx = drawX + imgW / 2;
                const cy = finalY + imgH / 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(finalRot * Math.PI / 180);
                ctx.drawImage(this.processedImage, -imgW / 2, -imgH / 2, imgW, imgH);

                if (this.fill_down) {
                    ctx.fillStyle = this.fillColor;
                    ctx.fillRect(-imgW / 2, imgH / 2, imgW, screenH);
                }
                ctx.restore();
            } else {
                ctx.drawImage(this.processedImage, drawX, finalY, imgW, imgH);
                if (this.fill_down) {
                    ctx.fillStyle = this.fillColor;
                    ctx.fillRect(drawX, finalY + imgH, imgW, screenH);
                }
            }
        }

        // Draw selection highlight
        if (this.isSelected) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.lineWidth = 3;
            if (this.tile_horizontal) {
                const startX = scrollOffset % imgW;
                let currX = startX;
                if (currX > 0) currX -= imgW;
                while (currX < screenW) {
                    ctx.strokeRect(currX, finalY, imgW, imgH);
                    currX += imgW;
                }
            } else {
                const wrapW = screenW + imgW;
                const drawX = ((scrollOffset) % wrapW) - imgW;
                ctx.strokeRect(drawX, finalY, imgW, imgH);
            }
        }

        ctx.globalAlpha = 1.0;
    }

    _drawBackground(ctx, screenW, screenH) {
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
