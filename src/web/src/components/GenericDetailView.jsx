import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AssetDetailLayout } from './AssetDetailLayout';
import { ImageViewer } from './ImageViewer';
import { Icon } from './Icon';
import { TheatreStage } from './TheatreStage';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { BehaviorEditor } from './BehaviorEditor';
import { TimelineEditor } from './TimelineEditor';

const API_BASE = "http://localhost:8000/api";

export function GenericDetailView({ type, asset, refresh, onDelete, isExpanded, toggleExpand, onOpenSprite }) {
    const {
        logs,
        isOptimizing,
        selectedImage,
        setSelectedImage: _setSelectedImage,
        visualPrompt,
        setVisualPrompt,
        configPrompt,
        setConfigPrompt,
        handleOptimize,
        handleUpdateConfig,
        handleEventsChange,
        currentBehaviors,   // Added here
        activeConfigTab,
        setActiveConfigTab,
        handleRevert,
        handleDeleteClick,
        handleConfirmDelete,
        showDeleteDialog,
        setShowDeleteDialog,
        mainSrc,
        tabs,
        statusLabel,
        configData,
        telemetry,
        handleTelemetry,
        debugOverlayMode,
        setDebugOverlayMode,
        toggleLayerVisibility,
        layerVisibility,
        handleRemoveLayer,
        handleSpriteSelected,
        handleSpritePositionChanged,
        handleKeyframeMove
    } = useAssetController(type, asset, refresh, onDelete);

    // ... (keep existing useState/useEffect) ...
    const [currentTime, setCurrentTime] = useState(0);

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
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, background: 'black', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <TheatreStage
                                        scene={asset.config || { layers: [] }}
                                        sceneName={asset.name}
                                        style={{ width: '100%', height: '100%' }}
                                        onTelemetry={handleTelemetry}
                                        debugMode={
                                            debugOverlayMode === 'on' ||
                                            (debugOverlayMode === 'auto' && activeConfigTab === 'debug')
                                        }
                                        layerVisibility={layerVisibility}
                                        selectedSprite={selectedImage !== 'original' ? selectedImage : null}
                                        onSpriteSelected={handleSpriteSelected}
                                        onSpritePositionChanged={handleSpritePositionChanged}
                                        currentTime={currentTime}
                                        onTimeUpdate={setCurrentTime}
                                        onInitialize={(_theatre) => {
                                            // Restore visibility settings if any
                                            // This is a bit tricky since theatre is recreated on scene change
                                        }}
                                    />
                                    <button
                                        className="btn"
                                        style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20 }}
                                        onClick={() => setIsPlaying(false)}
                                    >
                                        <Icon name="delete" size={16} /> Close
                                    </button>
                                </div>
                                <TimelineEditor
                                    duration={asset.config?.duration_sec || 30}
                                    currentTime={currentTime}
                                    layers={asset.config?.layers || []}
                                    selectedLayer={selectedImage}
                                    onTimeChange={setCurrentTime}
                                    onKeyframeMove={handleKeyframeMove}
                                    onPlayPause={() => { /* Theatre handles play loop, maybe pause prop needed? For now just toggle */
                                        // Actually Theatre.js runs loop if initialized.
                                        // We might need to control playback state via prop or ref.
                                        // For now, Timeline doesn't control Engine playback state directly except via time seek.
                                    }}
                                    isPlaying={true} // Theatre is always running in this view
                                />
                            </div>
                        )}

                        {/* Unified Prompt Box & Actions for Visuals */}

                    </div>
                }
                configContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                        {/* Tab Switcher for Right Pane */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
                            <button
                                className={`btn ${activeConfigTab === 'behaviors' ? 'active-tab' : ''}`}
                                style={{
                                    borderBottom: activeConfigTab === 'behaviors' ? '2px solid var(--color-primary)' : 'none',
                                    borderRadius: 0, padding: '8px 16px', color: activeConfigTab === 'behaviors' ? 'var(--color-text-main)' : 'var(--color-text-muted)'
                                }}
                                onClick={() => setActiveConfigTab('behaviors')}
                            >
                                Behaviors
                            </button>
                            <button
                                className={`btn ${activeConfigTab === 'json' ? 'active-tab' : ''}`}
                                style={{
                                    borderBottom: activeConfigTab === 'json' ? '2px solid var(--color-primary)' : 'none',
                                    borderRadius: 0, padding: '8px 16px', color: activeConfigTab === 'json' ? 'var(--color-text-main)' : 'var(--color-text-muted)'
                                }}
                                onClick={() => setActiveConfigTab('json')}
                            >
                                JSON Config
                            </button>
                            {type === 'scene' && (
                                <button
                                    className={`btn ${activeConfigTab === 'debug' ? 'active-tab' : ''}`}
                                    style={{
                                        borderBottom: activeConfigTab === 'debug' ? '2px solid var(--color-primary)' : 'none',
                                        borderRadius: 0, padding: '8px 16px', color: activeConfigTab === 'debug' ? 'var(--color-text-main)' : 'var(--color-text-muted)'
                                    }}
                                    onClick={() => setActiveConfigTab('debug')}
                                >
                                    Debug
                                </button>
                            )}
                        </div>

                        {activeConfigTab === 'behaviors' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                                {type === 'scene' && selectedImage === 'original' ? (
                                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                                        Select a sprite from the tabs above to edit its behaviors.
                                    </div>
                                ) : (
                                    <BehaviorEditor
                                        behaviors={currentBehaviors}
                                        onChange={handleEventsChange}
                                        readOnly={false}
                                        spriteName={selectedImage}
                                        isVisible={layerVisibility[selectedImage] !== false}
                                        onToggleVisibility={() => toggleLayerVisibility(selectedImage)}
                                        onRemoveSprite={type === 'scene' && selectedImage !== 'original' ? (() => handleRemoveLayer(selectedImage)) : null}
                                    />
                                )}
                            </div>
                        )}

                        {activeConfigTab === 'debug' && (
                            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Debug Overlay</span>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {['auto', 'on', 'off'].map(mode => (
                                            <button
                                                key={mode}
                                                className={`btn btn-xs ${debugOverlayMode === mode ? 'btn-primary' : ''}`}
                                                style={{ padding: '2px 8px', fontSize: '0.7rem', textTransform: 'capitalize' }}
                                                onClick={() => setDebugOverlayMode(mode)}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ background: 'var(--color-bg-elevated)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-primary)' }}>Live Telemetry</h4>
                                    {!telemetry ? (
                                        <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>Play the scene to see live data.</div>
                                    ) : (
                                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', opacity: 0.6, borderBottom: '1px solid var(--color-border)' }}>
                                                    <th style={{ paddingBottom: '4px', width: '24px' }}></th>
                                                    <th style={{ paddingBottom: '4px' }}>Layer</th>
                                                    <th style={{ paddingBottom: '4px' }}>X</th>
                                                    <th style={{ paddingBottom: '4px' }}>Y Pos</th>
                                                    <th style={{ paddingBottom: '4px' }}>Tilt</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {telemetry.map(t => (
                                                    <tr key={t.name} style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                                                        <td style={{ padding: '4px 0' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={layerVisibility[t.name] !== false}
                                                                onChange={() => toggleLayerVisibility(t.name)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '4px 0' }}>{t.name}</td>
                                                        <td style={{ padding: '4px 0' }}>{Math.round(t.x)}</td>
                                                        <td style={{ padding: '4px 0' }}>{t.y.toFixed(1)}</td>
                                                        <td style={{ padding: '4px 0' }}>{t.tilt.toFixed(1)}°</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                    <p style={{ margin: 0, opacity: 0.7 }}>Tip: Select a layer to see its environment sampling markers on the stage.</p>
                                </div>
                            </div>
                        )}

                        {activeConfigTab === 'json' && (
                            <>
                                {/* Unified Prompt Box & Actions for Config */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Refine Configuration</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <textarea
                                            className="input"
                                            placeholder="Describe changes to metadata/physics..."
                                            value={configPrompt}
                                            onChange={e => setConfigPrompt(e.target.value)}
                                            style={{ flex: 1, height: '38px', minHeight: '38px', resize: 'none' }}
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
                            </>
                        )}

                    </div>
                }
            />
        </>
    );
}

// Hook to encapsulate logic
function useAssetController(type, asset, refresh, onDelete) {
    const [logs, setLogs] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [selectedImage, setSelectedImage] = useState(type === 'sprite' ? 'current' : 'original');
    const [visualPrompt, setVisualPrompt] = useState('');
    const [configPrompt, setConfigPrompt] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Initialization & Reset
    useEffect(() => {
        if (type === 'sprite') {
            setSelectedImage('current');
        } else {
            // Default to first sprite if available, otherwise original
            const hasSprites = asset.used_sprites && asset.used_sprites.length > 0;
            setSelectedImage(hasSprites ? asset.used_sprites[0] : 'original');
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

    const [activeConfigTab, setActiveConfigTab] = useState('behaviors');

    // --- Actions ---

    // Note: This is an optimistic update helper. Real persistence needs a backend endpoint for "update metadata".
    // For now we assume we just update it locally to verify UI. 
    // In a real flow, we'd POST to /sprites/{name}/config or similar.
    const handleEventsChange = async (newBehaviors) => {
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
                if (selectedImage === 'original') {
                    toast.error("Cannot add behaviors to original scene background directly. Select a sprite layer.");
                    return;
                }

                if (!asset.config) return;
                const updatedConfig = JSON.parse(JSON.stringify(asset.config)); // Deep clone
                const layer = updatedConfig.layers?.find(l => l.sprite_name === selectedImage);
                if (layer) {
                    layer.behaviors = newBehaviors;
                    const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedConfig)
                    });
                    if (!res.ok) throw new Error(await res.text());
                    toast.success(`Updated behaviors for ${selectedImage}`);
                } else {
                    toast.error(`Layer ${selectedImage} not found in scene config`);
                }
            }
            await refresh();
        } catch (e) {
            console.error("Failed to update behaviors:", e);
            toast.error(`Failed to save changes: ${e.message}`);
        }
    };

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

    const [telemetry, setTelemetry] = useState(null);
    const handleTelemetry = (data) => {
        setTelemetry(data);
    };

    const [debugOverlayMode, setDebugOverlayMode] = useState('auto'); // 'auto' | 'on' | 'off'
    const [layerVisibility, setLayerVisibility] = useState({}); // { layerName: boolean }

    const toggleLayerVisibility = (name) => {
        setLayerVisibility(prev => ({
            ...prev,
            [name]: prev[name] === false ? true : false
        }));
    };

    // Forward visibility to engine whenever telemetry updates (poor man's sync)
    // Actually, it's better to pass layerVisibility to TheatreStage and let it sync.

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

            if (onDelete) {
                onDelete();
            } else {
                refresh();
            }
        } catch (e) {
            toast.error(`Action failed: ${e.message}`);
        }
    };

    const handleRemoveLayer = async (spriteName) => {
        if (!confirm(`Are you sure you want to remove sprite '${spriteName}' from this scene?`)) return;

        if (!asset.config) return;
        const updatedConfig = JSON.parse(JSON.stringify(asset.config));
        updatedConfig.layers = (updatedConfig.layers || []).filter(l => l.sprite_name !== spriteName);

        try {
            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });
            if (!res.ok) throw new Error(await res.text());
            toast.success(`Removed layer ${spriteName}`);
            setSelectedImage('original'); // Reset selection
            await refresh();
        } catch (e) {
            toast.error(`Failed to remove layer: ${e.message}`);
        }
    };

    const handleSpriteSelected = (spriteName) => {
        // Update selected image when sprite is clicked in theatre
        if (type === 'scene') {
            setSelectedImage(spriteName);
            // Optionally switch to behaviors tab
            setActiveConfigTab('behaviors');
        }
    };

    const handleSpritePositionChanged = async (spriteName, x, y, time) => {
        if (type !== 'scene') return;

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
                // Update existing
                layer.behaviors[existingIndex] = locationBehavior;
            } else {
                // Add new
                layer.behaviors.push(locationBehavior);
                // Sort by time_offset
                layer.behaviors.sort((a, b) => {
                    const aTime = a.time_offset || 0;
                    const bTime = b.time_offset || 0;
                    return aTime - bTime;
                });
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
    };

    const handleKeyframeMove = async (layerName, behaviorIndex, newTime, commit) => {
        if (type !== 'scene' || !commit) return; // Only commit=true saves

        try {
            if (!asset.config) return;
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === layerName);

            if (!layer || !layer.behaviors || !layer.behaviors[behaviorIndex]) {
                toast.error(`Keyframe not found`);
                return;
            }

            layer.behaviors[behaviorIndex].time_offset = parseFloat(newTime.toFixed(2));

            // Re-sort behaviors by time
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
        } else if (selectedImage) {
            // Scene sprite view
            mainSrc = `${API_BASE.replace('/api', '')}/assets/sprites/${selectedImage}/${selectedImage}.png`;
        }
    }

    const activeLayer = (type === 'scene' && selectedImage !== 'original')
        ? (asset.config?.layers || []).find(l => l.sprite_name === selectedImage)
        : null;

    const currentBehaviors = type === 'sprite'
        ? (asset.metadata?.behaviors || asset.metadata?.events || [])
        : (activeLayer ? (activeLayer.behaviors || activeLayer.events || []) : []);

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
        handleEventsChange,
        currentBehaviors,
        activeConfigTab,
        setActiveConfigTab,
        handleRevert,
        handleDeleteClick,
        handleConfirmDelete,
        showDeleteDialog,
        setShowDeleteDialog,
        mainSrc,
        tabs,
        statusLabel,
        configData,
        telemetry,
        handleTelemetry,
        debugOverlayMode,
        setDebugOverlayMode,
        toggleLayerVisibility,
        layerVisibility,
        handleRemoveLayer,
        handleSpriteSelected,
        handleSpritePositionChanged,
        handleKeyframeMove
    };
}
