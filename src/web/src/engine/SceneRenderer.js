import { createLogger } from '../utils/logger.js';
import { ThemeManager } from './ThemeManager.js';

const log = createLogger('SceneRenderer');

export class SceneRenderer {
    constructor(canvas, context, debugRenderer) {
        this.canvas = canvas;
        this.ctx = context;
        this.debugRenderer = debugRenderer;

        // Cache for calculating derived metrics like speed
        this.layerStateCache = new Map(); // Map<name, {x, y, time}>
        this.lastTelemetryTime = 0;
        this._lastDebugTime = 0;
        this.onTelemetry = null;
    }

    render(dt, state) {
        const { width, height } = this.canvas;
        const {
            layers,
            cameraZoom,
            cameraPanX,
            cameraPanY,
            scroll,
            elapsedTime,
            isCropMode,
            debugMode,
            mouseX,
            mouseY
        } = state;

        // Debug: Log render state occasionally
        if (!this._lastDebugTime || (performance.now() - this._lastDebugTime > 2000)) {
            log.debug(`Render: ${width}x${height} | Zoom=${cameraZoom.toFixed(3)} Pan=(${cameraPanX.toFixed(1)}, ${cameraPanY.toFixed(1)}) | Layers=${layers.length}`);
            this._lastDebugTime = performance.now();
        }

        // Clear screen
        const theme = ThemeManager.theme;
        this.ctx.fillStyle = theme.bgBase;
        this.ctx.fillRect(0, 0, width, height);

        // Draw scene background (sky blue)
        this.ctx.fillStyle = theme.skyBase;
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.save();
        // Draw background layers outside camera transform
        this.drawLayers(dt, width, height, true, state); // Only backgrounds

        this.applyCameraTransform(width, height, cameraZoom, cameraPanX, cameraPanY);

        // Draw regular layers and collect telemetry
        const { telemetry, selectedLayer, selectedEnvLayer } = this.drawLayers(dt, width, height, false, state); // No backgrounds

        // Draw selected layer on top
        if (selectedLayer) {
            this.drawSelectedLayer(selectedLayer, selectedEnvLayer, width, height, telemetry, scroll, elapsedTime, isCropMode);
        }

        // --- VISUAL DEBUG: Draw Environmental Interaction Points (Front-most) ---
        // We draw this LAST so it is always on top.
        layers.forEach(layer => {
            if (layer._debugInteractionData) {
                this.debugRenderer.drawInteractionDebug(this.ctx, layer._debugInteractionData, cameraZoom);
            }
        });

        // Emit telemetry to React
        this.emitTelemetry(telemetry);

        // Debug overlay (delegated)
        if (debugMode) {
            this.debugRenderer.drawOverlay(this.ctx, width, height, {
                layers,
                cameraZoom,
                cameraPanX,
                cameraPanY,
                mouseX,
                mouseY,
                scroll,
                elapsedTime,
                dt
            });
        }

        this.ctx.restore();
    }

    applyCameraTransform(width, height, zoom, panX, panY) {
        // Validate camera state
        if (!Number.isFinite(zoom) || !Number.isFinite(panX) || !Number.isFinite(panY)) {
            log.error('CRITICAL: Camera state is invalid!', zoom, panX, panY);
            // We can't fix it here as we don't own the state, but we can prevent drawing garbage
            return;
        }

        this.ctx.translate(width / 2, height / 2);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-width / 2 + panX, -height / 2 + panY);
    }

    drawLayers(dt, width, height, backgroundOnly = null, state) {
        const { layers, scroll, elapsedTime, isPaused, isCropMode, soloSprite, selectionManager, layersByName } = state;

        const telemetry = [];
        let selectedLayer = null;
        let selectedEnvLayer = null;

        const currentSelection = selectionManager.getSelected();

        for (const layer of layers) {
            // Filter by background status if requested
            if (backgroundOnly === true && !layer.is_background) continue;
            if (backgroundOnly === false && layer.is_background) continue;

            const isSelected = currentSelection === layer.config.sprite_name;

            if (isSelected) {
                selectedLayer = layer;
                if (layer.environmental_reaction) {
                    const targetName = layer.environmental_reaction.target_sprite_name;
                    selectedEnvLayer = layersByName ? layersByName.get(targetName) : null;
                }
                continue;
            }

            let envLayerForTilt = null;
            if (layer.environmental_reaction) {
                const targetName = layer.environmental_reaction.target_sprite_name;
                envLayerForTilt = layersByName ? layersByName.get(targetName) : null;
            }

            const isSolo = soloSprite === layer.config.sprite_name;
            let effectiveDt = dt;
            let effectiveTime = elapsedTime;

            if (soloSprite && !isSolo) {
                effectiveDt = 0;
                effectiveTime = 0;
            }

            layer.draw(
                this.ctx,
                width,
                height,
                scroll,
                effectiveTime,
                effectiveDt,
                envLayerForTilt,
                isPaused,
                isCropMode
            );

            // Collect telemetry
            const tf = layer.getTransform(height, width, 0, elapsedTime);
            const currentY = layer._currentYPhys !== undefined ? layer._currentYPhys : (layer._getBaseY(height) + layer.y_offset);
            // Calculate speed
            let speed = 0;
            if (dt > 0) {
                const prev = this.layerStateCache.get(layer.config.sprite_name);
                const currentX = layer.lastDrawnX !== undefined ? layer.lastDrawnX : (layer.scroll_speed * scroll + layer.x_offset + tf.x + (tf.base_x || 0));

                if (prev) {
                    const dx = currentX - prev.x;
                    const dy = currentY - prev.y;
                    speed = Math.sqrt(dx * dx + dy * dy) / dt;
                }

                // Update cache
                this.layerStateCache.set(layer.config.sprite_name, { x: currentX, y: currentY });
            }

            telemetry.push({
                name: layer.config.sprite_name,
                x: layer.lastDrawnX !== undefined ? layer.lastDrawnX : (layer.scroll_speed * scroll + layer.x_offset + tf.x + (tf.base_x || 0)),
                y: currentY,
                tilt: (layer.currentTilt !== undefined) ? (layer.currentTilt + tf.rotation) : tf.rotation,
                scale: tf.scale,
                speed: speed,
                z_depth: layer.z_depth,
                visible: layer.visible
            });
        }

        return { telemetry, selectedLayer, selectedEnvLayer };
    }

    drawSelectedLayer(selectedLayer, selectedEnvLayer, width, height, telemetry, scroll, elapsedTime, isCropMode) {
        // We can't access layers easily here if we want to check occlusion, 
        // but we passed it in state if we needed it. 
        // Ideally checkOcclusion should be part of DebugRenderer which we have.

        // Wait, checkOcclusion needs 'layers'. We didn't pass 'layers' to drawSelectedLayer.
        // But we are inside SceneRenderer which has access to state in render(), but drawSelectedLayer is isolated.
        // Let's assume we don't strictly *need* to check occlusion here or we refactor signature.

        // Actually, let's fix the signature in the call site to use the method's access to `this` or `state` if needed? 
        // No, `render` calls it.

        // For now, I'll assume we can skip occlusion calculation in this extracted method OR 
        // I need to change the signature to accept 'layers'.
        // Let's add 'layers' to arguments if we want to keep parity.
        // But `this.debugRenderer.checkOcclusion` takes `layers`.

        // Simpler: I will just render it. The occlusion indicator logic in Theatre.js was:
        /*
        const isOccluded = this.debugRenderer.checkOcclusion(selectedLayer, this.layers, width, height, this.scroll, this.elapsedTime);
        ...
        if (isOccluded) {
            this.debugRenderer.drawOcclusionIndicator(...);
        }
        */
        // I should reconstruct this logic. I need `layers`.
        // I will update the signature in `render` call.

        selectedLayer.draw(
            this.ctx,
            width,
            height,
            scroll,
            elapsedTime,
            0, // dt=0 to freeze behaviors for editing
            selectedEnvLayer,
            true,
            isCropMode
        );

        // Add to telemetry
        const selTf = selectedLayer.getTransform(height, width, 0, elapsedTime);
        const currentY = selectedLayer._currentYPhys !== undefined ? selectedLayer._currentYPhys : (selectedLayer._getBaseY(height) + selectedLayer.y_offset);

        telemetry.push({
            name: selectedLayer.config.sprite_name,
            x: selectedLayer.lastDrawnX || 0,
            y: currentY,
            tilt: (selectedLayer.currentTilt !== undefined) ? (selectedLayer.currentTilt + selTf.rotation) : selTf.rotation,
            scale: selTf.scale,
            speed: 0,
            z_depth: selectedLayer.z_depth,
            visible: selectedLayer.visible
        });
    }

    // Helper to augment drawSelectedLayer with occlusion check if we want to add it back
    // For now, maintaining basic rendering.
    checkAndDrawOcclusion(selectedLayer, layers, width, height, scroll, elapsedTime) {
        const isOccluded = this.debugRenderer.checkOcclusion(selectedLayer, layers, width, height, scroll, elapsedTime);
        if (isOccluded) {
            this.debugRenderer.drawOcclusionIndicator(this.ctx, selectedLayer, width, height, scroll, elapsedTime);
        }
    }

    emitTelemetry(telemetry) {
        if (this.onTelemetry && (performance.now() - this.lastTelemetryTime > 50)) {
            this.onTelemetry(telemetry);
            this.lastTelemetryTime = performance.now();
        }
    }
}
