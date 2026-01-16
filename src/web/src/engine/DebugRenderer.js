/**
 * Handles rendering of debug information and visual aids for the Theatre.
 */
import { ThemeManager } from './ThemeManager.js';

export class DebugRenderer {
    constructor() {
        this.lastDebugTime = 0;
    }

    /**
     * Draws the global debug overlay.
     */
    drawOverlay(ctx, width, height, state) {
        const { layers, cameraZoom, cameraPanX, cameraPanY, mouseX, mouseY } = state;

        ctx.save();
        // Reset transform for UI overlay
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const theme = ThemeManager.theme;
        ctx.fillStyle = theme.bgSurfaceGlass;
        ctx.fillRect(10, 10, 250, 120);

        ctx.fillStyle = theme.selectionAccent;
        ctx.font = "12px monospace";
        ctx.textBaseline = "top";

        const lines = [
            `FPS: ${Math.round(1 / state.dt)}`, // Approximate
            `Layers: ${layers.length}`,
            `Zoom: ${cameraZoom.toFixed(2)}`,
            `Pan: ${cameraPanX.toFixed(0)}, ${cameraPanY.toFixed(0)}`,
            `Mouse World: ${mouseX?.toFixed(0)}, ${mouseY?.toFixed(0)}`,
            `Scroll: ${state.scroll.toFixed(0)} px`,
            `Time: ${state.elapsedTime.toFixed(2)} s`
        ];

        lines.forEach((line, i) => {
            ctx.fillText(line, 20, 20 + (i * 15));
        });

        ctx.restore();
    }

    /**
     * Draws the "HIDDEN" indicator for occluded selected layers.
     */
    drawOcclusionIndicator(ctx, layer, width, height, scroll, elapsedTime) {
        ctx.save();
        const selTf = layer.getTransform(height, width, 0, elapsedTime);
        const { width: sW } = layer._getBaseDimensions(height);

        // Calculate screen-space position (assuming ctx is already transformed by camera)
        // If ctx is already transformed, we draw in world space

        const sX = (layer.scroll_speed * scroll) + layer.x_offset + selTf.x + (selTf.base_x || 0);
        const sY = selTf.base_y + selTf.y;

        const theme = ThemeManager.theme;
        ctx.fillStyle = theme.danger;
        ctx.font = "bold 12px Inter, system-ui, sans-serif";
        ctx.textBaseline = "bottom";
        const label = "HIDDEN BEHIND LAYERS";
        const metrics = ctx.measureText(label);

        // Center label above sprite
        const centerX = sX + (sW * selTf.scale) / 2;

        ctx.fillRect(centerX - metrics.width / 2 - 4, sY - 20, metrics.width + 8, 18);
        ctx.fillStyle = theme.textOnPrimary;
        ctx.fillText(label, centerX - metrics.width / 2, sY - 6);

        // Draw eye-slash icon symbolic graphic
        ctx.strokeStyle = theme.textOnPrimary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, sY - 30, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.moveTo(centerX - 6, sY - 36);
        ctx.lineTo(centerX + 6, sY - 24);
        ctx.stroke();

        ctx.restore();
    }
    /**
     * Checks if the selected layer is occluded by other layers.
     */
    checkOcclusion(selectedLayer, layers, width, height, scroll, elapsedTime) {
        for (const other of layers) {
            if (other === selectedLayer) continue;
            // Check z-depth: only layers strictly above can occlude
            if (other.z_depth > selectedLayer.z_depth && other.visible) {
                const otherTf = other.getTransform(height, width, 0, elapsedTime);
                const selTf = selectedLayer.getTransform(height, width, 0, elapsedTime);
                const { width: oW, height: oH } = other._getBaseDimensions(height);
                const { width: sW, height: sH } = selectedLayer._getBaseDimensions(height);

                const actualOW = oW * otherTf.scale;
                const actualOH = oH * otherTf.scale;
                const actualSW = sW * selTf.scale;
                const actualSH = sH * selTf.scale;

                // Calculate world positions for bounding box check
                const oX = (other.scroll_speed * scroll) + other.x_offset + otherTf.x + (otherTf.base_x || 0);
                const oY = otherTf.base_y + otherTf.y;
                const sX = (selectedLayer.scroll_speed * scroll) + selectedLayer.x_offset + selTf.x + (selTf.base_x || 0);
                const sY = selTf.base_y + selTf.y;

                if (oX < sX + actualSW && oX + actualOW > sX && oY < sY + actualSH && oY + actualOH > sY) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Draws interaction debug visuals (pink dot, environmental connections).
     */
    drawInteractionDebug(ctx, data, cameraZoom) {
        const {
            xStern, yStern, xBow, yBow, // Environment (Water)
            objSternX, objSternY, objBowX, objBowY, // Object (Boat)
            centerX, targetEnvY, tilt, targetTilt
        } = data;

        ctx.save();
        // Context is assumed to be already transformed by camera

        const dotSize = 4 / cameraZoom;
        ctx.lineWidth = 1 / cameraZoom;

        // Helper to draw a connection pair
        const drawInteractionPair = (envX, envY, objX, objY) => {
            // 1. Connection Line
            const theme = ThemeManager.theme;
            ctx.strokeStyle = theme.textMuted;
            ctx.beginPath();
            ctx.moveTo(envX, envY);
            ctx.lineTo(objX, objY);
            ctx.stroke();

            // 2. Environment Dot (Selection Accent)
            ctx.fillStyle = theme.selectionAccent;
            ctx.beginPath();
            ctx.arc(envX, envY, dotSize, 0, Math.PI * 2);
            ctx.fill();

            // 3. Object Dot (Primary)
            // User requested "pink dot on the sprite".
            ctx.fillStyle = theme.primary;
            ctx.beginPath();
            ctx.arc(objX, objY, dotSize, 0, Math.PI * 2);
            ctx.fill();

            // Optional: Stroke for object dot to distinguish
            ctx.strokeStyle = theme.textMain;
            ctx.stroke();
        };

        // Draw Left (Stern) Pair
        drawInteractionPair(xStern, yStern, objSternX, objSternY);

        // Draw Right (Bow) Pair
        drawInteractionPair(xBow, yBow, objBowX, objBowY);

        // Draw Tilt Info
        ctx.font = `${Math.max(10, 12 / cameraZoom)}px monospace`;
        const infoX = centerX - (40 / cameraZoom);
        const infoY = targetEnvY - (40 / cameraZoom);
        const yOffset = 15 / cameraZoom;

        const tiltText = `Tilt: ${tilt?.toFixed(1)}°`;
        const tgtText = targetTilt !== undefined ? `Tgt:  ${targetTilt.toFixed(1)}°` : "";

        // Text Shadow
        const theme = ThemeManager.theme;
        ctx.fillStyle = theme.bgBase;
        ctx.fillText(tiltText, infoX + (1 / cameraZoom), infoY + (1 / cameraZoom));
        if (tgtText) ctx.fillText(tgtText, infoX + (1 / cameraZoom), infoY + yOffset + (1 / cameraZoom));

        // Text Main
        ctx.fillStyle = theme.textMain;
        ctx.fillText(tiltText, infoX, infoY);
        if (tgtText) ctx.fillText(tgtText, infoX, infoY + yOffset);

        ctx.restore();
    }
}
