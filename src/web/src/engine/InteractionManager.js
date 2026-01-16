/**
 * Manages sprite interaction (dragging, scaling, rotating) for the Theatre.
 */


export class InteractionManager {
    constructor(theatre) {
        this.theatre = theatre;
        this.isDragging = false;
        this.activeHandle = null; // { type: 'scale' | 'rotate', id?: string }

        // Drag state
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // Initial state for transforms
        this.initialScale = 1.0;
        this.initialRotation = 0;

        this.isCropMode = false;
    }

    setCropMode(enabled) {
        this.isCropMode = enabled;
    }

    handleDragStart(x, y) {
        const worldPos = this.theatre.screenToWorld(x, y);

        const currentSelection = this.theatre.selectionManager.getSelected();
        if (!currentSelection) return false;

        const layer = this.theatre.layersByName.get(currentSelection);
        if (!layer) return false;

        const { width, height } = this.theatre.canvas;
        const { scroll, elapsedTime } = this.theatre;

        // 1. Check for handles first
        const handle = layer.getHandleAtPoint(worldPos.x, worldPos.y, width, height, scroll, elapsedTime);
        if (handle) {
            this.activeHandle = handle;
            this.isDragging = true;
            this.dragStartX = worldPos.x;
            this.dragStartY = worldPos.y;
            this.initialScale = layer._baseScale;
            this.initialRotation = layer.getTransform(height, width, 0, elapsedTime).rotation;
            return true;
        }

        // 2. Check for body drag
        if (layer.containsPoint(worldPos.x, worldPos.y, width, height, scroll, elapsedTime)) {
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
        if (!this.isDragging) return;

        const selectedSprite = this.theatre.selectionManager.getSelected();
        if (!selectedSprite) return;

        const worldPos = this.theatre.screenToWorld(x, y);
        const layer = this.theatre.layersByName.get(selectedSprite);
        if (!layer) return;

        const dx = worldPos.x - this.dragStartX;
        const dy = worldPos.y - this.dragStartY;

        const { width, height } = this.theatre.canvas;
        const { scroll, elapsedTime } = this.theatre;

        if (this.activeHandle) {
            if (this.activeHandle.type === 'scale') {
                // Simplified scaling: use distance from center to calculate new scale
                const tf = layer.getTransform(height, width, 0, elapsedTime);
                const { width: baseW, height: baseH } = layer._getBaseDimensions(height);
                // Calculate center (approximate using current transform)
                const centerX = (layer.scroll_speed * scroll) + layer.x_offset + tf.x + (tf.base_x || 0) + (baseW * tf.scale) / 2;
                const centerY = tf.base_y + tf.y + (baseH * tf.scale) / 2;

                const initialDist = Math.sqrt(Math.pow(this.dragStartX - centerX, 2) + Math.pow(this.dragStartY - centerY, 2));
                const currentDist = Math.sqrt(Math.pow(worldPos.x - centerX, 2) + Math.pow(worldPos.y - centerY, 2));

                if (initialDist > 5) { // Threshold to prevent jitter
                    const newScale = this.initialScale * (currentDist / initialDist);
                    if (this.isCropMode) {
                        // Visual indicator for crop? 
                    } else {
                        layer.setScale(newScale, elapsedTime);
                    }
                }
            } else if (this.activeHandle.type === 'rotate') {
                const tf = layer.getTransform(height, width, 0, elapsedTime);
                const { width: baseW, height: baseH } = layer._getBaseDimensions(height);
                const centerX = (layer.scroll_speed * scroll) + layer.x_offset + tf.x + (tf.base_x || 0) + (baseW * tf.scale) / 2;
                const centerY = tf.base_y + tf.y + (baseH * tf.scale) / 2;

                const initialAngle = Math.atan2(this.dragStartY - centerY, this.dragStartX - centerX);
                const currentAngle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);

                const angleDiff = (currentAngle - initialAngle) * (180 / Math.PI);
                layer.setRotation(this.initialRotation + angleDiff, elapsedTime);
            }
        } else {
            // Body drag
            layer.setPosition(this.dragOffsetX + dx, this.dragOffsetY + dy);
        }
    }

    handleDragEnd() {
        if (!this.isDragging) return;

        const selectedSprite = this.theatre.selectionManager.getSelected();
        if (selectedSprite) {
            const layer = this.theatre.layersByName.get(selectedSprite);
            if (layer) {
                if (this.activeHandle) {
                    if (this.activeHandle.type === 'scale') {
                        if (this.isCropMode) {
                            // Handle crop commit if we implement it, for now just log
                            // log.debug("[Theatre] Crop committed (placeholder)");
                        } else if (this.theatre.onSpriteScaleChanged) {
                            this.theatre.onSpriteScaleChanged(selectedSprite, layer._baseScale, this.theatre.elapsedTime);
                        }
                    } else if (this.activeHandle.type === 'rotate' && this.theatre.onSpriteRotationChanged) {
                        const tf = layer.getTransform(this.theatre.canvas.height, this.theatre.canvas.width, 0, this.theatre.elapsedTime);
                        this.theatre.onSpriteRotationChanged(selectedSprite, tf.rotation);
                    }
                } else if (this.theatre.onSpritePositionChanged) {
                    this.theatre.onSpritePositionChanged(selectedSprite, layer.x_offset, layer.y_offset, this.theatre.elapsedTime);
                }
            }
        }

        this.isDragging = false;
        this.activeHandle = null;
    }
}
