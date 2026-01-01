export class Layer {
    constructor(config, image) {
        this.config = config;
        this.image = image;

        // Extract config with defaults matching Python ParallaxLayer
        this.z_depth = config.z_depth ?? 1;
        this.vertical_percent = config.vertical_percent ?? 0.5;
        this.bob_amplitude = config.bob_amplitude ?? 0;
        this.bob_frequency = config.bob_frequency ?? 0.0;
        this.scroll_speed = config.scroll_speed ?? 0.0;
        this.is_background = config.is_background ?? false;
        this.tile_horizontal = config.tile_horizontal ?? false;
        this.tile_border = config.tile_border ?? 0;
        this.height_scale = config.height_scale;
        this.fill_down = config.fill_down ?? false;
        this.vertical_anchor = config.vertical_anchor ?? "center";
        this.x_offset = config.x_offset ?? 0;
        this.y_offset = config.y_offset ?? 0;
        this.vertical_drift = config.vertical_drift ?? 0.0;
        this.horizontal_drift = config.horizontal_drift ?? 0.0;
        this.scale_drift = config.scale_drift ?? 0.0;
        this.scale_drift_multiplier_after_cap = config.scale_drift_multiplier_after_cap ?? 3.0;
        this.drift_cap_y = config.drift_cap_y;
        this.twinkle_amplitude = config.twinkle_amplitude ?? 0.0;
        this.twinkle_frequency = config.twinkle_frequency ?? 0.0;
        this.twinkle_min_scale = config.twinkle_min_scale ?? 0.035;
        this.environmental_reaction = config.environmental_reaction;

        // Telemetry / State
        this.current_y = 0.0;
        this.current_draw_x = 0.0;
        this.current_scale_calculated = 1.0;
        this.is_twinkling_active = false;
        this.has_reached_cap = false;
        this.has_ignited_star = false;

        // Process Image if needed (e.g. tile border crop)
        // Note: Complex image processing like `fill_down` or `tile_border` 
        // implies creating an offscreen canvas. 
        this.processedImage = this._processImage(image);
        this.original_image_size = {
            width: this.processedImage.width,
            height: this.processedImage.height
        };
    }

    _processImage(originalImage) {
        if (!originalImage) return null;

        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');

        let width = originalImage.naturalWidth || originalImage.width;
        let height = originalImage.naturalHeight || originalImage.height;

        // Handle tile_border crop
        let sourceX = 0;
        let sourceWidth = width;
        if (this.tile_border > 0) {
            sourceX = this.tile_border;
            sourceWidth = width - (2 * this.tile_border);
            width = sourceWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(originalImage, sourceX, 0, sourceWidth, height, 0, 0, width, height);

        // We defer height_scale and fill_down to the draw/render phase or specific setup
        // because they depend on screen size which might change in a web context.
        // For simplicity in this port, we'll handle resizing in draw() or a resize() method,
        // but simple crops are best done once.
        return canvas;
    }

    _getBaseY(screenH) {
        // Calculate based on processed image or simply current logic
        // In Python, fill_down modified the image size. JS we might just render differently.
        // For now, let's assume the sprite size is what we use.

        // If fill_down is true, we treat the "positioning height" as the original image height
        // before the valid-fill extension. But since we aren't pre-generating a massive filled image,
        // we use the current image height.

        // Default to raw image height
        let imgH = this.processedImage ? this.processedImage.height : 0;

        // Apply scaling logic for positioning (matching Python ParallaxLayer behavior)
        if (this.height_scale) {
            imgH = screenH * this.height_scale;
        } else if (this.config.target_height) {
            imgH = this.config.target_height;
        }

        const baseYFromTop = screenH * this.vertical_percent;

        if (this.vertical_anchor === "bottom") {
            return baseYFromTop - imgH;
        } else if (this.vertical_anchor === "top") {
            return baseYFromTop;
        } else {
            return baseYFromTop - (imgH / 2);
        }
    }

    _getBobOffset(scrollX, xCoord = null) {
        if (this.bob_amplitude <= 0 || this.bob_frequency <= 0) return 0;

        if (xCoord !== null && this.tile_horizontal) {
            const spatialPhase = (scrollX * this.scroll_speed) + (xCoord * 0.01);
            return Math.sin(spatialPhase * this.bob_frequency) * this.bob_amplitude;
        }

        return Math.sin(scrollX * this.bob_frequency) * this.bob_amplitude;
    }

    getCurrentY(screenH, scrollX, elapsedTime = 0.0, xCoord = null) {
        const baseY = this._getBaseY(screenH);
        const bobOffset = this._getBobOffset(scrollX, xCoord);
        const drift = this.vertical_drift * elapsedTime;

        let y = baseY + bobOffset + this.y_offset + drift;

        if (this.drift_cap_y !== undefined && this.drift_cap_y !== null) {
            if (this.vertical_drift < 0) {
                y = Math.max(y, this.drift_cap_y);
            } else if (this.vertical_drift > 0) {
                y = Math.min(y, this.drift_cap_y);
            }
        }
        return y;
    }

    getYAtX(screenH, scrollX, xCoord, elapsedTime = 0.0) {
        return this.getCurrentY(screenH, scrollX, elapsedTime, xCoord);
    }

    getCurrentTilt(screenH, scrollX, drawX, imgW, environmentLayer) {
        if (!this.environmental_reaction || !environmentLayer) return 0;
        if (this.environmental_reaction.reaction_type !== "pivot_on_crest") return 0;

        const reactingSpriteCurrentX = drawX + (imgW / 2);
        const sampleOffset = 2.0;

        const yAtBehind = environmentLayer.getYAtX(screenH, scrollX, reactingSpriteCurrentX - sampleOffset);
        const yAtAhead = environmentLayer.getYAtX(screenH, scrollX, reactingSpriteCurrentX + sampleOffset);

        const deltaY = yAtBehind - yAtAhead; // Note: Canvas Y is down-positive, same as Pygame
        const deltaX = 2 * sampleOffset;

        let rawSlope = 0;
        if (deltaX !== 0) rawSlope = deltaY / deltaX;

        // Ramp in
        let startRamp = 0;
        if (scrollX > 0) startRamp = Math.min(1.0, scrollX / 300.0);

        const tiltAngleDeg = Math.atan(rawSlope) * (180 / Math.PI) * 50.0 * startRamp;
        const maxTilt = this.environmental_reaction.max_tilt_angle;

        return Math.max(-maxTilt, Math.min(maxTilt, tiltAngleDeg));
    }

    draw(ctx, screenW, screenH, scrollX, elapsedTime = 0.0, environmentY = null, environmentLayerForTilt = null) {
        if (!this.processedImage) return;

        // Handling Background Scaling
        if (this.is_background) {
            const imgW = this.processedImage.width;
            const imgH = this.processedImage.height;
            const screenAspect = screenW / screenH;
            const imgAspect = imgW / imgH;

            let newW, newH;

            if (imgAspect > screenAspect) {
                newH = screenH;
                newW = newH * imgAspect;
            } else {
                newW = screenW;
                newH = newW / imgAspect;
            }

            const blitX = (screenW - newW) / 2;
            const blitY = (screenH - newH) / 2;

            ctx.drawImage(this.processedImage, blitX, blitY, newW, newH);
            return;
        }

        // Logic for drift cap and star transition
        let timeToCapY = 99999.0;
        if (this.drift_cap_y !== null && this.drift_cap_y !== undefined && this.vertical_drift !== 0) {
            const baseYNoDrift = this._getBaseY(screenH) + this.y_offset;
            const distToCap = Math.abs(this.drift_cap_y - baseYNoDrift);
            timeToCapY = distToCap / Math.abs(this.vertical_drift);
        }

        if (!this.has_reached_cap && elapsedTime >= timeToCapY) {
            this.has_reached_cap = true;
            // logging event could go here
        }

        let timeToStar = 99999.0;
        const accelDrift = this.scale_drift * this.scale_drift_multiplier_after_cap;

        if (this.scale_drift < 0) {
            const scaleAtCap = 1.0 + (this.scale_drift * timeToCapY);
            if (scaleAtCap <= this.twinkle_min_scale) {
                timeToStar = (this.twinkle_min_scale - 1.0) / this.scale_drift;
            } else if (accelDrift < 0) {
                timeToStar = timeToCapY + (this.twinkle_min_scale - scaleAtCap) / accelDrift;
            }
        }

        this.is_twinkling_active = false;
        let physicsTime = elapsedTime;
        if (elapsedTime >= timeToStar) {
            this.is_twinkling_active = true;
            physicsTime = timeToStar;
            if (!this.has_ignited_star) {
                this.has_ignited_star = true;
            }
        }

        // Calculate Scale
        let currentScale = 1.0;
        if (physicsTime <= timeToCapY) {
            currentScale = 1.0 + (this.scale_drift * physicsTime);
        } else {
            const scaleAtCap = 1.0 + (this.scale_drift * timeToCapY);
            currentScale = scaleAtCap + (accelDrift * (physicsTime - timeToCapY));
        }

        currentScale = Math.max(
            this.is_twinkling_active ? this.twinkle_min_scale : 0.001,
            currentScale
        );
        this.current_scale_calculated = currentScale;


        // Calculate Position
        const parallaxScroll = scrollX * this.scroll_speed;
        let y = this.getCurrentY(screenH, scrollX, physicsTime);
        this.current_y = y;

        const hDrift = this.horizontal_drift * physicsTime;

        let imgW = this.processedImage.width * currentScale;
        let imgH = this.processedImage.height * currentScale;

        // Apply height_scale logic if dynamic sizing is needed? 
        // Python version did it at load time. Here we can do it at draw time or resize time for better quality
        if (this.height_scale) {
            const targetH = screenH * this.height_scale;
            const aspect = this.processedImage.width / this.processedImage.height;
            const targetW = targetH * aspect;
            imgW = targetW; // Override scale logic if height_scale is set? 
            // Python version was EITHER height_scale OR drift scale. 
            // Let's assume height_scale overrides standard size but drift scale multiplies it.
            imgH = targetH;

            // Re-apply scale drift if it exists?
            // In python, height_scale changed base image size. 
            // So currentScale should apply ON TOP of that.
            imgW *= currentScale;
            imgH *= currentScale;
        } else if (this.config.target_height) {
            // Same logic for target_height
            const aspect = this.processedImage.width / this.processedImage.height;
            imgW = (this.config.target_height * aspect) * currentScale;
            imgH = this.config.target_height * currentScale;
        }

        const wrapWidth = screenW + imgW;
        const x = (parallaxScroll + this.x_offset + hDrift) % wrapWidth;
        let drawX = x - imgW;

        // Environmental Vertical Follow
        if (this.environmental_reaction && environmentY !== null &&
            this.environmental_reaction.reaction_type === "pivot_on_crest") {

            if (this.environmental_reaction.vertical_follow_factor > 0) {
                // In Python: y = env_y - (img_h_pos * (1 - factor))
                // img_h_pos was original height. 
                const imgHForPos = imgH; // Simplify
                y = environmentY - (imgHForPos * (1 - this.environmental_reaction.vertical_follow_factor));
            }
        }

        // Twinkle Alpha
        let alpha = 1.0;
        if (this.twinkle_amplitude > 0 && this.is_twinkling_active) {
            const phaseOffset = (this.x_offset % 360) / 10.0;
            const rateMod = 1.0 + ((this.x_offset % 10) / 20.0);

            const rawSpike = Math.pow(
                (Math.sin((elapsedTime * rateMod + phaseOffset) * this.twinkle_frequency) + 1.0) / 2.0,
                10
            );

            const baseAlpha = 212 / 255;
            alpha = baseAlpha + (rawSpike * (1.0 - baseAlpha));
        }

        ctx.globalAlpha = alpha;

        // Tiling Logic
        if (this.tile_horizontal) {
            const startX = (parallaxScroll + this.x_offset + hDrift) % imgW;
            let currentX = startX - imgW;

            // We don't support environmental tilt on tiled layers in this loop yet
            // (Python version didn't seem to either, explicitly)
            while (currentX < screenW) {
                ctx.drawImage(this.processedImage, currentX, y, imgW, imgH);

                // Fill down?
                if (this.fill_down) {
                    // Draw a rect below
                    // In python we made a surface. Here just fillRect check color
                    // For MVP, skip robust color sampling, just repeat image?
                    // Or just don't support fill_down dynamic color yet.
                    // The python logic was: sample bottom pxl, fill rect.
                }
                currentX += imgW;
            }
        } else {
            // Single sprite draw
            let rotation = 0;
            if (this.environmental_reaction && environmentY !== null &&
                this.environmental_reaction.reaction_type === "pivot_on_crest" &&
                environmentLayerForTilt) {
                rotation = this.getCurrentTilt(screenH, scrollX, drawX, imgW, environmentLayerForTilt);
            }

            if (rotation !== 0) {
                // Rotate around center
                const cx = drawX + imgW / 2;
                const cy = y + imgH / 2;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rotation * Math.PI / 180);
                ctx.drawImage(this.processedImage, -imgW / 2, -imgH / 2, imgW, imgH);
                ctx.restore();
            } else {
                ctx.drawImage(this.processedImage, drawX, y, imgW, imgH);
            }

            if (this.fill_down) {
                // Sample bottom pixel? 
                // Performance warning: getImageData is slow.
                // Ideally we'd do this in _processImage to create a taller canvas.
                // For now, let's just extend the image? 
                // Or draw a rectangle if we knew the color:
                // ctx.fillStyle = ...; ctx.fillRect(drawX, y + imgH, imgW, screenH - (y+imgH));
            }
        }

        ctx.globalAlpha = 1.0;
        this.current_draw_x = drawX;
    }
}
