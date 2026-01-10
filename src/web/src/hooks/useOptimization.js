import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE } from '../config';

/**
 * Hook for handling asset optimization workflows.
 * 
 * Extracted from useAssetController as part of Phase 3 refactoring.
 * Handles sprite transformation and scene optimization via LLM.
 * 
 * @param {string} type - 'sprite' or 'scene'
 * @param {object} asset - Asset object with name property
 * @param {Function} refresh - Callback to refresh asset data
 * @returns {object} Optimization state and handlers
 */
export function useOptimization(type, asset, refresh) {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [imageTimestamp, setImageTimestamp] = useState(Date.now());
    const [visualPrompt, setVisualPrompt] = useState('');
    const [processingMode, setProcessingMode] = useState('local'); // 'local' (free) or 'llm' (quality)

    const handleOptimize = useCallback(async () => {
        setIsOptimizing(true);
        const actionName = type === 'sprite' ? "Transformation" : "Optimization";

        try {
            let promise;
            if (type === 'sprite') {
                promise = fetch(`${API_BASE}/sprites/${asset.name}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ optimize: true, remove_background: true })
                });
            } else {
                promise = fetch(`${API_BASE}/scenes/${asset.name}/optimize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt_guidance: visualPrompt, processing_mode: processingMode })
                });
            }

            const res = await promise;
            if (!res.ok) throw new Error((await res.json()).detail);

            toast.success(`${actionName} Complete`);
            setImageTimestamp(Date.now());
            await refresh();
        } catch (e) {
            let msg = e.message;
            if (msg === 'Failed to fetch') {
                msg = "Network error: Connection to server lost or timed out. Please check server logs.";
            }
            toast.error(msg);
        } finally {
            setIsOptimizing(false);
        }
    }, [type, asset.name, visualPrompt, processingMode, refresh]);

    const handleRevert = useCallback(async () => {
        if (!confirm("Are you sure you want to revert to original? Any changes will be lost.")) return;
        toast.info("Reverting...");
        try {
            const res = await fetch(`${API_BASE}/sprites/${asset.name}/revert`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).detail);
            toast.success("Reverted to original");
            setImageTimestamp(Date.now());
            await refresh();
        } catch (e) {
            toast.error(e.message);
        }
    }, [asset.name, refresh]);

    const handleSaveRotation = useCallback(async (degrees) => {
        if (!confirm(`Apply ${degrees} degree rotation permanently? This will modify the image file.`)) return;

        setIsOptimizing(true);
        try {
            const endpoint = type === 'sprite' ? 'sprites' : 'scenes';
            const res = await fetch(`${API_BASE}/${endpoint}/${asset.name}/rotate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ angle: degrees })
            });

            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();
            toast.success(data.message);
            setImageTimestamp(Date.now());
            await refresh();
        } catch (e) {
            toast.error(`Rotation failed: ${e.message}`);
        } finally {
            setIsOptimizing(false);
        }
    }, [type, asset.name, refresh]);

    return {
        isOptimizing,
        imageTimestamp,
        setImageTimestamp,
        visualPrompt,
        setVisualPrompt,
        processingMode,
        setProcessingMode,
        handleOptimize,
        handleRevert,
        handleSaveRotation
    };
}
