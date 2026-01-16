import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE } from '../config';
import { UpdateConfigCommand } from '../utils/Commands';

/**
 * Hook for managing layer operations in scenes.
 * 
 * Extracted from useAssetController as part of Phase 3 refactoring.
 * Handles add/remove/visibility of sprite layers.
 * 
 * @param {object} asset - Scene asset with config property
 * @param {Function} refresh - Callback to refresh asset data
 * @returns {object} Layer operations state and handlers
 */
export function useLayerOperations(asset, refresh, executeCommand) {
    const [layerVisibility, setLayerVisibility] = useState({});
    const [showSpriteLibrary, setShowSpriteLibrary] = useState(false);

    const toggleLayerVisibility = useCallback(async (name) => {
        const newVisibility = layerVisibility[name] === false ? true : false;

        // Optimistic update
        setLayerVisibility(prev => ({
            ...prev,
            [name]: newVisibility
        }));

        try {
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = updatedConfig.layers?.find(l => l.sprite_name === name);
            if (layer) {
                layer.visible = newVisibility;

                if (executeCommand) {
                    const command = new UpdateConfigCommand(
                        'scene',
                        asset.name,
                        asset.config,
                        updatedConfig,
                        refresh,
                        `${newVisibility ? 'Showed' : 'Hid'} layer ${name}`
                    );
                    await executeCommand(command);
                } else {
                    const res = await fetch(`${API_BASE}/scenes/${encodeURIComponent(asset.name)}/config`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedConfig)
                    });
                    if (!res.ok) throw new Error(await res.text());
                    await refresh();
                }
            }
        } catch (e) {
            console.error("Failed to persist visibility:", e);
            toast.error(`Failed to save visibility state: ${e.message}`);
            // Revert
            setLayerVisibility(prev => ({
                ...prev,
                [name]: !newVisibility
            }));
        }
    }, [asset.config, asset.name, layerVisibility, refresh, executeCommand]);

    const handleAddSprite = useCallback(async (sprite, onSuccess) => {
        if (!asset.config) return;

        // Check if already exists
        const exists = (asset.config.layers || []).find(l => l.sprite_name === sprite.name);
        if (exists) {
            toast.warning(`Sprite '${sprite.name}' is already in the scene.`);
            return;
        }

        // Determine Z-depth from metadata
        let zDepth = 50;
        if (sprite.metadata) {
            const locationBehavior = (sprite.metadata.behaviors || []).find(b => b.type === 'location');
            if (locationBehavior && locationBehavior.z_depth !== undefined) {
                zDepth = locationBehavior.z_depth;
            } else if (sprite.metadata.z_depth !== undefined) {
                zDepth = sprite.metadata.z_depth;
            }
        }

        const newLayer = {
            sprite_name: sprite.name,
            z_depth: zDepth,
            x_offset: 0,
            y_offset: 0,
            scale: 1.0,
            visible: true,
            behaviors: []
        };

        const updatedConfig = JSON.parse(JSON.stringify(asset.config));
        updatedConfig.layers = [...(updatedConfig.layers || []), newLayer];

        try {
            if (executeCommand) {
                const command = new UpdateConfigCommand(
                    'scene',
                    asset.name,
                    asset.config,
                    updatedConfig,
                    refresh,
                    `Added sprite '${sprite.name}' at Z=${zDepth}`
                );
                await executeCommand(command);
                setShowSpriteLibrary(false);
                if (onSuccess) onSuccess(sprite.name);
            } else {
                const res = await fetch(`${API_BASE}/scenes/${encodeURIComponent(asset.name)}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedConfig)
                });
                if (!res.ok) throw new Error(await res.text());
                toast.success(`Added sprite '${sprite.name}' at Z=${zDepth}`);
                setShowSpriteLibrary(false);
                if (onSuccess) onSuccess(sprite.name);
                await refresh();
            }
        } catch (e) {
            toast.error(`Failed to add sprite: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh, executeCommand]);

    const handleRemoveLayer = useCallback(async (spriteName, onSuccess) => {
        if (!asset.config) return;
        const updatedConfig = JSON.parse(JSON.stringify(asset.config));
        updatedConfig.layers = (updatedConfig.layers || []).filter(l => l.sprite_name !== spriteName);

        try {
            if (executeCommand) {
                const command = new UpdateConfigCommand(
                    'scene',
                    asset.name,
                    asset.config,
                    updatedConfig,
                    refresh,
                    `Removed layer ${spriteName}`
                );
                await executeCommand(command);
                if (onSuccess) onSuccess();
            } else {
                const res = await fetch(`${API_BASE}/scenes/${encodeURIComponent(asset.name)}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedConfig)
                });
                if (!res.ok) throw new Error(await res.text());
                toast.success(`Removed layer ${spriteName}`);
                if (onSuccess) onSuccess();
                await refresh();
            }
        } catch (e) {
            toast.error(`Failed to remove layer: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh, executeCommand]);

    const handleDeleteSprite = useCallback(async (spriteName, onSuccess) => {
        try {
            // First remove from scene if present
            if (asset.config) {
                const updatedConfig = JSON.parse(JSON.stringify(asset.config));
                updatedConfig.layers = (updatedConfig.layers || []).filter(l => l.sprite_name !== spriteName);

                await fetch(`${API_BASE}/scenes/${encodeURIComponent(asset.name)}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedConfig)
                });
            }

            // Then delete the sprite asset
            const res = await fetch(`${API_BASE}/sprites/${spriteName}?mode=delete`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).detail);

            toast.success(`Deleted sprite "${spriteName}" permanently`);
            if (onSuccess) onSuccess();
            await refresh();
        } catch (e) {
            toast.error(`Failed to delete sprite: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh]);

    const handleUpdateLayerOrder = useCallback(async (zDepthMap) => {
        if (!asset.config) {
            return;
        }

        const currentLayers = asset.config.layers || [];
        let needsUpdate = false;

        const updatedLayers = currentLayers.map(l => {
            if (zDepthMap[l.sprite_name] !== undefined) {
                if (l.z_depth !== zDepthMap[l.sprite_name]) {
                    needsUpdate = true;
                    return { ...l, z_depth: zDepthMap[l.sprite_name] };
                }
            }
            return l;
        });

        if (!needsUpdate) {
            return;
        }

        const updatedConfig = JSON.parse(JSON.stringify(asset.config));
        updatedConfig.layers = updatedLayers;

        try {
            if (executeCommand) {
                const command = new UpdateConfigCommand(
                    'scene',
                    asset.name,
                    asset.config,
                    updatedConfig,
                    refresh,
                    `Updated layer order`
                );
                await executeCommand(command);
            } else {
                // Background update - no toast unless error, to keep it smooth
                const res = await fetch(`${API_BASE}/scenes/${encodeURIComponent(asset.name)}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedConfig)
                });
                if (!res.ok) throw new Error(await res.text());
                await refresh();
            }
        } catch (e) {
            console.error("Failed to update layer order:", e);
            toast.error(`Failed to update layer order: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh, executeCommand]);

    // Initialize visibility from config
    const initializeVisibility = useCallback((config) => {
        if (config?.layers) {
            const visibilityMap = {};
            config.layers.forEach(l => {
                visibilityMap[l.sprite_name] = l.visible !== false;
            });
            setLayerVisibility(visibilityMap);
        }
    }, []);

    return {
        layerVisibility,
        showSpriteLibrary,
        setShowSpriteLibrary,
        toggleLayerVisibility,
        handleAddSprite,
        handleRemoveLayer,
        handleDeleteSprite,
        handleUpdateLayerOrder,
        initializeVisibility
    };
}
