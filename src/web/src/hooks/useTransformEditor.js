import { useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE } from '../config';

/**
 * Hook for handling sprite transform changes (position, scale, rotation).
 * 
 * Extracted from useAssetController as part of Phase 3 refactoring.
 * 
 * @param {object} asset - Scene asset with config property
 * @param {Function} refresh - Callback to refresh asset data
 * @returns {object} Transform handlers
 */
export function useTransformEditor(asset, refresh) {

    const handleSpritePositionChanged = useCallback(async (spriteName, x, y, time) => {
        try {
            if (!asset.config) return;
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === spriteName);

            if (!layer) {
                toast.error(`Layer ${spriteName} not found`);
                return;
            }

            // Update x_offset and y_offset
            layer.x_offset = Math.round(x);
            layer.y_offset = Math.round(y);

            // Create or update LocationBehavior with current time
            if (!layer.behaviors) layer.behaviors = [];

            // Find existing location behavior at this time (within 0.5s tolerance)
            const existingIndex = layer.behaviors.findIndex(
                b => b.type === 'location' && Math.abs(b.time_offset - time) < 0.5
            );

            const locationBehavior = {
                type: 'location',
                x: Math.round(x),
                y: Math.round(y),
                time_offset: parseFloat(time.toFixed(2)),
                interpolate: true,
                enabled: true
            };

            if (existingIndex >= 0) {
                layer.behaviors[existingIndex] = locationBehavior;
            } else {
                layer.behaviors.push(locationBehavior);
                layer.behaviors.sort((a, b) => (a.time_offset || 0) - (b.time_offset || 0));
            }

            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });

            if (!res.ok) throw new Error(await res.text());

            toast.success(`Updated position for ${spriteName} at ${time.toFixed(1)}s`);
            await refresh();
        } catch (e) {
            console.error('Failed to update position:', e);
            toast.error(`Failed to save position: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh]);

    const handleSpriteRotationChanged = useCallback(async (spriteName, degrees, time = 0) => {
        try {
            if (!asset.config) return;
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === spriteName);
            if (!layer) return;

            if (time > 0.1) {
                // Update or create location behavior at this time
                if (!layer.behaviors) layer.behaviors = [];
                const existingIndex = layer.behaviors.findIndex(
                    b => b.type === 'location' && Math.abs((b.time_offset || 0) - time) < 0.2
                );

                if (existingIndex >= 0) {
                    layer.behaviors[existingIndex].rotation = degrees;
                } else {
                    layer.behaviors.push({
                        type: 'location',
                        rotation: degrees,
                        time_offset: parseFloat(time.toFixed(2)),
                        interpolate: true,
                        enabled: true
                    });
                    layer.behaviors.sort((a, b) => (a.time_offset || 0) - (b.time_offset || 0));
                }
            } else {
                // Update base rotation or location behavior if it exists
                const loc = (layer.behaviors || []).find(b => b.type === 'location' && b.time_offset === undefined);
                if (loc) {
                    loc.rotation = degrees;
                } else {
                    layer.rotation = degrees;
                }
            }

            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });
            if (!res.ok) throw new Error(await res.text());
            await refresh();
        } catch (e) {
            console.error("Failed to update rotation:", e);
        }
    }, [asset.config, asset.name, refresh]);

    const handleSpriteScaleChanged = useCallback(async (spriteName, newScale, time = 0) => {
        try {
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === spriteName);
            if (!layer) throw new Error(`Layer ${spriteName} not found`);

            if (time > 0.1) {
                // Keyframe scale
                if (!layer.behaviors) layer.behaviors = [];
                const existingIndex = layer.behaviors.findIndex(
                    b => b.type === 'location' && Math.abs((b.time_offset || 0) - time) < 0.1
                );

                const kf = {
                    type: 'location',
                    scale: newScale,
                    time_offset: parseFloat(time.toFixed(2)),
                    interpolate: true,
                    enabled: true
                };

                if (existingIndex >= 0) {
                    const existing = layer.behaviors[existingIndex];
                    layer.behaviors[existingIndex] = { ...existing, scale: newScale };
                } else {
                    layer.behaviors.push(kf);
                    layer.behaviors.sort((a, b) => (a.time_offset || 0) - (b.time_offset || 0));
                }
                toast.success(`Keyframed scale for ${spriteName} at ${time.toFixed(1)}s`);
            } else {
                // Base Scale
                layer.scale = newScale;
                if (layer.behaviors) {
                    const baseLoc = layer.behaviors.find(b => b.type === 'location' && b.time_offset === undefined);
                    if (baseLoc) baseLoc.scale = newScale;
                }
                toast.success(`Updated base scale for ${spriteName}`);
            }

            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });
            if (!res.ok) throw new Error(await res.text());

            await refresh();
        } catch (e) {
            toast.error(`Failed to save scale: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh]);

    const handleKeyframeMove = useCallback(async (layerName, behaviorIndex, newTime, commit) => {
        if (!commit) return; // Only commit=true saves

        try {
            if (!asset.config) return;
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === layerName);

            if (!layer || !layer.behaviors || !layer.behaviors[behaviorIndex]) {
                toast.error(`Keyframe not found`);
                return;
            }

            layer.behaviors[behaviorIndex].time_offset = parseFloat(newTime.toFixed(2));
            layer.behaviors.sort((a, b) => (a.time_offset || 0) - (b.time_offset || 0));

            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });

            if (!res.ok) throw new Error(await res.text());

            toast.success(`Moved keyframe to ${newTime.toFixed(2)}s`);
            await refresh();
        } catch (e) {
            console.error('Failed to move keyframe:', e);
            toast.error(`Failed to move keyframe: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh]);

    const handleKeyframeDelete = useCallback(async (layerName, behaviorIndex) => {
        if (!confirm(`Are you sure you want to delete this keyframe?`)) return;

        try {
            if (!asset.config) return;
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === layerName);

            if (!layer || !layer.behaviors || !layer.behaviors[behaviorIndex]) {
                toast.error(`Keyframe not found`);
                return;
            }

            // Remove behavior
            layer.behaviors.splice(behaviorIndex, 1);

            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });

            if (!res.ok) throw new Error(await res.text());

            toast.success(`Deleted keyframe for ${layerName}`);
            await refresh();
        } catch (e) {
            console.error('Failed to delete keyframe:', e);
            toast.error(`Failed to delete keyframe: ${e.message}`);
        }
    }, [asset.config, asset.name, refresh]);

    return {
        handleSpritePositionChanged,
        handleSpriteRotationChanged,
        handleSpriteScaleChanged,
        handleKeyframeMove,
        handleKeyframeDelete
    };
}
