import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AssetDetailLayout } from './AssetDetailLayout';
import { ImageViewer } from './ImageViewer';
import { Icon } from './Icon';

const API_BASE = "http://localhost:8000/api";

export function GenericDetailView({ type, asset, refresh, isExpanded, toggleExpand, onOpenSprite }) {
    const {
        logs,
        isOptimizing,
        selectedImage,
        setSelectedImage,
        visualPrompt,
        setVisualPrompt,
        configPrompt,
        setConfigPrompt,
        handleOptimize,
        handleUpdateConfig,
        handleRevert,
        handleDelete,
        mainSrc,
        tabs,
        statusLabel,
        configData
    } = useAssetController(type, asset, refresh);

    return (
        <AssetDetailLayout
            title={asset.name}
            statusLabel={statusLabel}
            logs={logs}
            isExpanded={isExpanded}
            actions={
                <>
                    <button className="btn" title="Refresh" onClick={refresh}><Icon name="revert" size={16} /></button>
                    <button className="btn" title="Delete" onClick={handleDelete} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                        <Icon name="delete" size={16} />
                    </button>
                </>
            }
            visualContent={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, width: '100%' }}>
                    {/* Unified Prompt Box & Actions for Visuals - Moved to Top */}
                    {!isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                {type === 'scene' ? "Optimization Guidance" : "Visual Refinement"}
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    className="input"
                                    placeholder={type === 'scene' ? "e.g., 'Make the trees sway gently...'" : "Describe visual changes..."}
                                    value={visualPrompt}
                                    onChange={e => setVisualPrompt(e.target.value)}
                                    style={{ flex: 1 }}
                                    disabled={type === 'sprite'}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleOptimize}
                                    disabled={isOptimizing || (type === 'sprite' && selectedImage !== 'current')}
                                >
                                    {isOptimizing ? <Icon name="optimize" className="animate-spin" /> : 'Optimize'}
                                </button>
                            </div>
                            {type === 'scene' && selectedImage && selectedImage !== 'original' && (
                                <button className="btn" onClick={() => onOpenSprite(selectedImage)} style={{ width: '100%', marginTop: '4px' }}>
                                    Edit Sprite {selectedImage} <Icon name="config" size={12} />
                                </button>
                            )}
                        </div>
                    )}

                    <ImageViewer
                        mainSrc={mainSrc}
                        alt={asset.name}
                        isOptimizing={isOptimizing}
                        tabs={tabs}
                        isExpanded={isExpanded}
                        toggleExpand={toggleExpand}
                        actions={
                            type === 'sprite' && asset.has_original && (
                                <button className="btn" title="Revert to Original" onClick={handleRevert} style={{ padding: '2px 6px' }}>
                                    <Icon name="revert" size={14} />
                                </button>
                            )
                        }
                    />

                    {/* Unified Prompt Box & Actions for Visuals */}

                </div>
            }
            configContent={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                    {/* Unified Prompt Box & Actions for Config - Moved to Top */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Refine Configuration</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <textarea
                                className="input"
                                placeholder="Describe changes to metadata/physics..."
                                value={configPrompt}
                                onChange={e => setConfigPrompt(e.target.value)}
                                style={{ flex: 1, height: '38px', minHeight: '38px', resize: 'none' }} /* Match Text Input Height generally */
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleUpdateConfig}
                                disabled={isOptimizing || !configPrompt.trim()}
                                style={{ height: 'auto' }}
                            >
                                <Icon name="config" size={14} />
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflow: 'auto', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
                        <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            {configData ? JSON.stringify(configData, null, 2) : "No configuration data."}
                        </pre>
                    </div>

                </div>
            }
        />
    );
}

// Hook to encapsulate logic
function useAssetController(type, asset, refresh) {
    const [logs, setLogs] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null); // 'current' | 'original' | sprite_name
    const [visualPrompt, setVisualPrompt] = useState('');
    const [configPrompt, setConfigPrompt] = useState('');

    // Initialization & Reset
    useEffect(() => {
        if (type === 'sprite') {
            setSelectedImage('current');
        } else {
            setSelectedImage('original');
        }
        setVisualPrompt('');
        setConfigPrompt('');
    }, [asset.name, type]);

    // Fetch Logs
    useEffect(() => {
        const endpoint = type === 'sprite' ? `sprites` : `scenes`;
        fetch(`${API_BASE}/logs/${endpoint}/${asset.name}`)
            .then(res => res.json())
            .then(data => setLogs(data.content))
            .catch(() => { });
    }, [asset.name, type, isOptimizing]);

    // --- Actions ---

    const handleOptimize = async () => {
        setIsOptimizing(true);
        const actionName = type === 'sprite' ? "Transformation" : "Optimization";
        // toast.info(`Starting ${actionName}...`); // Removed to reduce popup noise

        try {
            let promise;
            if (type === 'sprite') {
                // Existing sprite optimization logic
                promise = fetch(`${API_BASE}/sprites/${asset.name}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ optimize: true, remove_background: true }) // Default args
                });
            } else {
                // Existing scene optimization logic
                promise = fetch(`${API_BASE}/scenes/${asset.name}/optimize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt_guidance: visualPrompt })
                });
            }

            const res = await promise;
            if (!res.ok) throw new Error((await res.json()).detail);

            toast.success(`${actionName} Complete`);
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
    };

    const handleUpdateConfig = async () => {
        // Placeholder for future implementation
        toast.info("Config refinement coming soon!", { description: `Prompt: ${configPrompt}` });
        setConfigPrompt('');
    };

    const handleRevert = async () => {
        if (!confirm("Are you sure you want to revert to original? Any changes will be lost.")) return;
        toast.info("Reverting...");
        try {
            const res = await fetch(`${API_BASE}/sprites/${asset.name}/revert`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).detail);
            toast.success("Reverted to original");
            await refresh();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;
        try {
            const res = await fetch(`${API_BASE}/${type}s/${asset.name}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).detail);
            toast.success(`${type} deleted`);
            refresh();
        } catch (e) {
            toast.error(`Delete failed: ${e.message}`);
        }
    };

    // --- Computed State ---

    const statusLabel = type === 'sprite'
        ? (asset.has_metadata ? "Configured" : (asset.has_original ? "Optimizing" : "Raw Sprite"))
        : ((asset.used_sprites && asset.used_sprites.length > 0) ? "Configured" : "Raw Scene");

    const configData = type === 'sprite' ? asset.metadata : asset.config;

    // Tabs & Image Source
    const tabs = [];
    if (type === 'sprite') {
        tabs.push({ id: 'current', label: 'Current', onClick: () => setSelectedImage('current'), isActive: selectedImage === 'current' });
        if (asset.has_original) {
            tabs.push({ id: 'original', label: 'Original', onClick: () => setSelectedImage('original'), isActive: selectedImage === 'original' });
        }
    } else {
        tabs.push({ id: 'original', label: 'Original', onClick: () => setSelectedImage('original'), isActive: selectedImage === 'original' });
        (asset.used_sprites || []).forEach(s => {
            tabs.push({ id: s, label: s, onClick: () => setSelectedImage(s), isActive: selectedImage === s });
        });
    }

    let mainSrc = null;
    if (type === 'sprite') {
        mainSrc = selectedImage === 'original'
            ? `${API_BASE.replace('/api', '')}/assets/sprites/${asset.name}/${asset.name}.original.png`
            : `${API_BASE.replace('/api', '')}/assets/sprites/${asset.name}/${asset.name}.png?t=${Date.now()}`;
    } else {
        if (selectedImage === 'original') {
            const ext = asset.original_ext || 'jpg';
            mainSrc = asset.has_original
                ? `${API_BASE.replace('/api', '')}/assets/scenes/${asset.name}/${asset.name}.original.${ext}`
                : null;
        } else {
            // Scene sprite view
            mainSrc = `${API_BASE.replace('/api', '')}/assets/sprites/${selectedImage}/${selectedImage}.png`;
        }
    }

    return {
        logs,
        isOptimizing,
        selectedImage,
        setSelectedImage,
        visualPrompt,
        setVisualPrompt,
        configPrompt,
        setConfigPrompt,
        handleOptimize,
        handleUpdateConfig,
        handleRevert,
        handleDelete,
        mainSrc,
        tabs,
        statusLabel,
        configData
    };
}
