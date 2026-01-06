import { useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE } from '../config';

/**
 * Hook for managing behavior CRUD operations.
 * 
 * Extracted from useAssetController as part of Phase 3 refactoring.
 * Handles adding, updating, and removing behaviors from sprites/layers.
 * 
 * @param {string} type - 'sprite' or 'scene'
 * @param {object} asset - Asset object with config/metadata
 * @param {string} selectedSprite - Currently selected sprite name
 * @param {Function} refresh - Callback to refresh asset data
 * @returns {object} Behavior editor handlers
 */
export function useBehaviorEditor(type, asset, selectedSprite, refresh) {

    const handleBehaviorsChange = useCallback(async (newBehaviors) => {
        try {
            if (type === 'sprite') {
                const updatedMetadata = {
                    ...asset.metadata,
                    behaviors: newBehaviors
                };
                const res = await fetch(`${API_BASE}/sprites/${asset.name}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedMetadata)
                });
                if (!res.ok) throw new Error(await res.text());
                toast.success("Sprite behaviors updated");
            } else {
                // Scene mode
                if (selectedSprite === 'original') {
                    toast.error("Cannot add behaviors to original scene background directly. Select a sprite layer.");
                    return;
                }

                if (!asset.config) return;
                const updatedConfig = JSON.parse(JSON.stringify(asset.config));
                const layer = updatedConfig.layers?.find(l => l.sprite_name === selectedSprite);
                if (layer) {
                    layer.behaviors = newBehaviors;
                    const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedConfig)
                    });
                    if (!res.ok) throw new Error(await res.text());
                    toast.success(`Updated behaviors for ${selectedSprite}`);
                } else {
                    toast.error(`Layer ${selectedSprite} not found in scene config`);
                }
            }
            await refresh();
        } catch (e) {
            console.error("Failed to update behaviors:", e);
            toast.error(`Failed to save changes: ${e.message}`);
        }
    }, [type, asset.metadata, asset.config, asset.name, selectedSprite, refresh]);

    return {
        handleBehaviorsChange
    };
}
