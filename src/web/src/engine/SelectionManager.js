/**
 * Manages sprite selection and hit-testing logic for the Theatre.
 */
export class SelectionManager {
    constructor(onSelectionChanged) {
        this.selectedSprite = null; // Primary selection (last selected)
        this.selectedSprites = new Set(); // All selected sprites
        this.onSelectionChanged = onSelectionChanged;
    }

    /**
     * Selects a sprite by name.
     * @param {string|null} name - The name of the sprite to select.
     * @param {Map} layersByName - Map of current layers.
     * @param {boolean} isSync - Whether this is a sync call (internal update).
     * @param {boolean} isMultiSelect - Whether to add/toggle to existing selection.
     */
    select(name, layersByName, isSync = false, isMultiSelect = false) {
        if (!isSync) {
            // Handle Toggle Logic for Multi-Select
            if (isMultiSelect && name) {
                if (this.selectedSprites.has(name)) {
                    // Deselect THIS sprite
                    const layer = layersByName ? layersByName.get(name) : null;
                    if (layer) layer.isSelected = false;
                    this.selectedSprites.delete(name);

                    // Update primary selection to last added or null
                    if (this.selectedSprite === name) {
                        const remaining = Array.from(this.selectedSprites);
                        this.selectedSprite = remaining.length > 0 ? remaining[remaining.length - 1] : null;
                    }
                    this._notify(this.selectedSprite, isSync);
                    return;
                }
            } else if (!isMultiSelect) {
                // Single Select - Clear others if new selection or clicking different
                // If clicking same as primary in single select, we might toggle off if it was the ONLY one? 
                // Current behavior was: toggle off if same.
                if (this.selectedSprite === name && this.selectedSprites.size === 1) {
                    this.deselectAll(layersByName, isSync);
                    return;
                }
            }
        }

        if (layersByName) {
            const layer = layersByName.get(name);
            if (layer) {
                if (!isMultiSelect) {
                    // Deselect all others first
                    this.deselectAll(layersByName, true); // Silent deselect
                }

                // Select new
                this.selectedSprite = name;
                this.selectedSprites.add(name);
                layer.isSelected = true;
                this._notify(name, isSync);
            } else {
                // Name provided but not found, or explicit null selection
                this.deselectAll(layersByName, isSync);
            }
        } else {
            // No layers map, just clear state
            this.selectedSprite = null;
            this.selectedSprites.clear();
            this._notify(null, isSync);
        }
    }

    /**
     * Deselects all sprites.
     */
    deselectAll(layersByName, isSync = false) {
        if (layersByName) {
            this.selectedSprites.forEach(name => {
                const layer = layersByName.get(name);
                if (layer) layer.isSelected = false;
            });
        }
        this.selectedSprite = null;
        this.selectedSprites.clear();
        this._notify(null, isSync);
    }

    /**
     * Handles a click event on the canvas world coordinates.
     * @returns {boolean} true if selection changed or hit something.
     */
    handleClick(worldX, worldY, layers, width, height, scroll, time) {
        // Find sprite under cursor (reverse order for top-most first)
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            // Skip invisible and background layers
            if (!layer.visible || layer.is_background) continue;

            if (layer.containsPoint(worldX, worldY, width, height, scroll, time)) {
                // We found a hit
                // To allow toggling, we pass the name to select(), which handles the toggle logic
                // But we need the layersByName map usually.
                // For cleanlyness, we can assume the caller will call select() passed on our return?
                // Or we can just return the name found?
                return layer.config.sprite_name;
            }
        }
        return null; // Clicked on empty space
    }

    getSelected() {
        return this.selectedSprite;
    }

    _notify(name, isSync) {
        if (!isSync && this.onSelectionChanged) {
            this.onSelectionChanged(name, Array.from(this.selectedSprites));
        }
    }
}
