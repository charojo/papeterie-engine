import { useCallback, useTransition } from 'react';
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
export function useBehaviorEditor(type, asset, selectedSprite, refresh, executeCommand, updateAssetLocal) {
    const [isPending, startTransition] = useTransition();

    const handleBehaviorsChange = useCallback(async (newBehaviors, targetSprite = selectedSprite) => {
        // Optimistic Update
        if (updateAssetLocal) {
            let targetUpdateLocal = null;
            if (type === 'sprite') {
                targetUpdateLocal = { ...asset.metadata, behaviors: newBehaviors };
                updateAssetLocal('sprite', asset.name, targetUpdateLocal);
            } else {
                const updatedConfigLocal = JSON.parse(JSON.stringify(asset.config));
                const layer = (updatedConfigLocal.layers || []).find(l => l.sprite_name === targetSprite);
                if (layer) {
                    layer.behaviors = newBehaviors;
                }
                targetUpdateLocal = updatedConfigLocal;
                updateAssetLocal('scene', asset.name, targetUpdateLocal);
            }
        }

        startTransition(async () => {
            try {
                let targetUpdate = null;
                let currentConfig = null;

                if (type === 'sprite') {
                    currentConfig = asset.metadata;
                    targetUpdate = { ...asset.metadata, behaviors: newBehaviors };
                } else {
                    currentConfig = asset.config;
                    const updatedConfig = JSON.parse(JSON.stringify(asset.config));
                    const layer = (updatedConfig.layers || []).find(l => l.sprite_name === targetSprite);
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
                        type === 'sprite' ? "Sprite behaviors updated" : `Updated behaviors for ${targetSprite}`
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
                    toast.success(type === 'sprite' ? "Sprite behaviors updated" : `Updated behaviors for ${targetSprite}`);
                    await refresh();
                }
            } catch (e) {
                console.error("Failed to update behaviors:", e);
                toast.error(`Failed to save changes: ${e.message}`);
                // Revert on failure (or trigger refresh)
                if (refresh) await refresh();
            }
        });
    }, [type, asset.metadata, asset.config, asset.name, selectedSprite, refresh, executeCommand, updateAssetLocal]);

    return {
        handleBehaviorsChange,
        isUpdating: isPending
    };
}
