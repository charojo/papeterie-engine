import { useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE } from '../config';
import { UpdateConfigCommand } from '../utils/Commands';

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
export function useBehaviorEditor(type, asset, selectedSprite, refresh, executeCommand) {

    const handleBehaviorsChange = useCallback(async (newBehaviors) => {
        try {
            let targetUpdate = null;
            let currentConfig = null;

            if (type === 'sprite') {
                currentConfig = asset.metadata;
                targetUpdate = { ...asset.metadata, behaviors: newBehaviors };
            } else {
                currentConfig = asset.config;
                const updatedConfig = JSON.parse(JSON.stringify(asset.config));
                const layer = (updatedConfig.layers || []).find(l => l.sprite_name === selectedSprite);
                if (layer) {
                    layer.behaviors = newBehaviors;
                }
                targetUpdate = updatedConfig;
            }

            if (executeCommand) {
                const command = new UpdateConfigCommand(
                    type,
                    asset.name,
                    currentConfig,
                    targetUpdate,
                    refresh,
                    type === 'sprite' ? "Sprite behaviors updated" : `Updated behaviors for ${selectedSprite}`
                );
                await executeCommand(command);
            } else {
                const endpoint = type === 'sprite' ? 'sprites' : 'scenes';
                const res = await fetch(`${API_BASE}/${endpoint}/${asset.name}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(targetUpdate)
                });
                if (!res.ok) throw new Error(await res.text());
                toast.success(type === 'sprite' ? "Sprite behaviors updated" : `Updated behaviors for ${selectedSprite}`);
                await refresh();
            }
        } catch (e) {
            console.error("Failed to update behaviors:", e);
            toast.error(`Failed to save changes: ${e.message}`);
        }
    }, [type, asset.metadata, asset.config, asset.name, selectedSprite, refresh, executeCommand]);

    return {
        handleBehaviorsChange
    };
}
