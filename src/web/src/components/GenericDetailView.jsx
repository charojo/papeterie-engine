import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AssetDetailLayout } from './AssetDetailLayout';
import { ImageViewer } from './ImageViewer';
import { Icon } from './Icon';
import { TheatreStage } from './TheatreStage';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

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
        handleDeleteClick,
        handleConfirmDelete,
        showDeleteDialog,
        setShowDeleteDialog,
        mainSrc,
        tabs,
        statusLabel,
        configData
    } = useAssetController(type, asset, refresh);

    // ... (keep existing useState/useEffect) ...

    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        setIsPlaying(false);
    }, [asset.name]);

    return (
        <>
            <DeleteConfirmationDialog
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={handleConfirmDelete}
                type={type}
                assetName={asset.name}
            />
            <AssetDetailLayout
                title={asset.name}
                statusLabel={statusLabel}
                logs={logs}
                isExpanded={isExpanded}
                actions={
                    <>
                        <button className="btn" title="Refresh" onClick={refresh}><Icon name="revert" size={16} /></button>
                        {type === 'scene' && (
                            <button
                                className={`btn ${isPlaying ? 'btn-primary' : ''}`}
                                title={isPlaying ? "Stop Scene" : "Play Scene"}
                                onClick={() => setIsPlaying(!isPlaying)}
                            >
                                <Icon name={isPlaying ? "delete" : "generate"} size={16} style={{ opacity: 0.7 }} /> {/* Using icons available for now */}
                                {isPlaying ? " Stop" : " Play"}
                            </button>
                        )}
                        <button className="btn" title="Delete" onClick={handleDeleteClick}>
                            <Icon name="delete" size={16} style={{ opacity: 0.7 }} />
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

                        {/* Theatre Stage Overlay/Replacement */}
                        {isPlaying && type === 'scene' && (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, background: 'black' }}>
                                <TheatreStage
                                    scene={asset.config}
                                    sceneName={asset.name}
                                    style={{ width: '100%', height: '100%' }}
                                />
                                <button
                                    className="btn"
                                    style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20 }}
                                    onClick={() => setIsPlaying(false)}
                                >
                                    <Icon name="delete" size={16} /> Close
                                </button>
                            </div>
                        )}

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
                            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', opacity: configData ? 1 : 0.5 }}>
                                {configData ? JSON.stringify(configData, null, 2) : "No configuration data."}
                            </pre>
                        </div>

                    </div>
                }
            />
        </>
    );
}

// Hook to encapsulate logic
function useAssetController(type, asset, refresh) {
    const [logs, setLogs] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null); // 'current' | 'original' | sprite_name
    const [visualPrompt, setVisualPrompt] = useState('');
    const [configPrompt, setConfigPrompt] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Initialization & Reset
    useEffect(() => {
        if (type === 'sprite') {
            setSelectedImage('current');
        } else {
            setSelectedImage('original');
        }

        // Load persisted prompt
        const key = `papeterie_optimize_prompt_${type}_${asset.name}`;
        const saved = localStorage.getItem(key);
        setVisualPrompt(saved || '');

        setConfigPrompt('');
    }, [asset.name, type]);

    // Persist prompt changes
    useEffect(() => {
        if (asset.name) {
            const key = `papeterie_optimize_prompt_${type}_${asset.name}`;
            localStorage.setItem(key, visualPrompt);
        }
    }, [visualPrompt, asset.name, type]);

    // Fetch & Poll Logs
    useEffect(() => {
        let interval;
        const fetchLogs = () => {
            const endpoint = type === 'sprite' ? `sprites` : `scenes`;
            fetch(`${API_BASE}/logs/${endpoint}/${asset.name}`)
                .then(res => res.json())
                .then(data => {
                    const raw = data.content || "";
                    // Show all logs including DEBUG
                    setLogs(raw);
                })
                .catch(() => { });
        };

        fetchLogs(); // Initial fetch

        if (isOptimizing) {
            interval = setInterval(fetchLogs, 1000);
        }

        return () => clearInterval(interval);
    }, [asset.name, type, isOptimizing]);

    // --- Actions ---

    const handleOptimize = async () => {
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

    const handleDeleteClick = () => {
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async (mode) => {
        const endpoint = type === 'sprite' ? `sprites` : `scenes`;
        try {
            const res = await fetch(`${API_BASE}/${endpoint}/${asset.name}?mode=${mode}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).detail);

            const data = await res.json();

            if (data.kept_sprites && data.kept_sprites.length > 0) {
                toast.warning(`Deleted scene, but preserved shared sprites: ${data.kept_sprites.join(', ')}`, { duration: 6000 });
            } else {
                toast.success(`${type} processed: ${mode}`);
            }

            refresh();
        } catch (e) {
            toast.error(`Action failed: ${e.message}`);
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
        handleDeleteClick,
        handleConfirmDelete,
        showDeleteDialog,
        setShowDeleteDialog,
        mainSrc,
        tabs,
        statusLabel,
        configData
    };
}
