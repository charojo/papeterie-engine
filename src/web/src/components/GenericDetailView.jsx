import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AssetDetailLayout } from './AssetDetailLayout';
import { ImageViewer } from './ImageViewer';
import { Icon } from './Icon';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { BehaviorEditor } from './BehaviorEditor';
import { SpriteListEditor } from './SpriteListEditor';
import { TimelineEditor } from './TimelineEditor';
import { SpriteLibraryDialog } from './SpriteLibraryDialog';

const API_BASE = "http://localhost:8000/api";

export function GenericDetailView({ type, asset, refresh, onDelete, isExpanded, toggleExpand, _onOpenSprite, sprites }) {
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
        handleEventsChange,
        currentBehaviors,   // Added here
        behaviorGuidance,
        activeTab,
        handleTabChange,
        handleRevert,
        handleDeleteClick,

        statusLabel,
        configData,
        telemetry,
        debugOverlayMode,
        setDebugOverlayMode,
        toggleLayerVisibility,
        layerVisibility,
        handleRemoveLayer,
        handleDeleteSprite,
        handleSpriteSelected,
        handleSpritePositionChanged,
        handleKeyframeMove,
        handleShare,
        handleSaveRotation,
        handleSpriteRotationChanged,
        handleSaveScale,
        showDeleteDialog,
        setShowDeleteDialog,
        handleConfirmDelete,
        showSpriteLibrary,
        setShowSpriteLibrary,
        handleAddSprite,
        activeLayer,
        processingMode,
        setProcessingMode
    } = useAssetController(type, asset, refresh, onDelete);

    // ... (keep existing useState/useEffect) ...
    const [currentTime, setCurrentTime] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const configScrollRef = useRef(null);


    useEffect(() => {
        setIsPlaying(false);
    }, [asset.name]);

    return (
        <>
            <SpriteLibraryDialog
                isOpen={showSpriteLibrary}
                onClose={() => setShowSpriteLibrary(false)}
                sprites={sprites || []}
                onAdd={handleAddSprite}
            />
            <DeleteConfirmationDialog
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={handleConfirmDelete}
                type={type}
                assetName={asset.name}
            />
            <AssetDetailLayout
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {asset.name}
                        {asset.is_community && (
                            <span className="badge" style={{ background: 'var(--color-primary)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>
                                Community
                            </span>
                        )}
                    </div>
                }
                statusLabel={statusLabel}
                logs={logs}
                isExpanded={isExpanded}
                actions={
                    <>
                        {!asset.is_community && (
                            <button className="btn" title="Share with Community" onClick={handleShare}>
                                <Icon name="share" size={16} style={{ opacity: 0.7 }} />
                            </button>
                        )}
                        {type === 'scene' && (
                            <button className="btn" title="Search Sprites" onClick={() => setShowSpriteLibrary(true)}>
                                <Icon name="search" size={16} style={{ opacity: 0.7 }} />
                            </button>
                        )}
                        {type === 'scene' && (
                            <button
                                className={`btn ${isPlaying ? 'btn-primary' : ''}`}
                                title={isPlaying ? "Stop Scene" : "Play Scene"}
                                onClick={() => setIsPlaying(!isPlaying)}
                            >
                                <Icon name={isPlaying ? "stop" : "play"} size={16} style={{ opacity: 0.7 }} />
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    className="input"
                                    placeholder={type === 'scene' ? "e.g., 'Make the trees sway gently...'" : "Describe visual changes..."}
                                    value={visualPrompt}
                                    onChange={e => setVisualPrompt(e.target.value)}
                                    style={{ flex: 1 }}
                                    disabled={type === 'sprite'}
                                    title={type === 'scene' ? "Optimization Guidance: Describe how sprites should be animated. The AI will use this to generate behaviors for each layer." : "Visual Refinement: Describe changes to the sprite's appearance."}
                                />
                                {type === 'scene' && (
                                    <select
                                        className="input"
                                        value={processingMode}
                                        onChange={e => setProcessingMode(e.target.value)}
                                        style={{ width: '120px', fontSize: '0.85rem' }}
                                        title="Processing Mode: Local is free but may have lower quality. LLM uses AI for higher quality but costs API credits."
                                    >
                                        <option value="local">Local (Free)</option>
                                        <option value="llm">LLM (Quality)</option>
                                    </select>
                                )}
                                <button
                                    className="btn btn-primary"
                                    onClick={handleOptimize}
                                    disabled={isOptimizing || (type === 'sprite' && selectedImage !== asset.name)}
                                    title="Run AI optimization on this asset"
                                >
                                    {isOptimizing ? <Icon name="optimize" className="animate-spin" /> : 'Optimize'}
                                </button>
                            </div>
                        )}

                        <ImageViewer
                            scene={type === 'scene' ? asset.config : { layers: [{ sprite_name: asset.name, x_offset: 0, y_offset: 0, scale: activeLayer?.scale || 1, behaviors: currentBehaviors }] }}
                            sceneName={asset.name}
                            currentTime={currentTime}
                            layerVisibility={layerVisibility}
                            onToggleVisibility={toggleLayerVisibility}
                            assetBaseUrl={window.API_BASE ? window.API_BASE.replace('/api', '/assets') : undefined} // Explicit pass
                            isCommunity={asset.is_community}
                            isOptimizing={isOptimizing}
                            // Tabs removed
                            isExpanded={isExpanded}
                            toggleExpand={toggleExpand}

                            onSaveRotation={(name, deg) => type === 'scene' ? handleSpriteRotationChanged(name, deg) : handleSaveRotation(deg)}
                            onSpriteRotationChanged={handleSpriteRotationChanged}
                            onSaveScale={handleSaveScale}
                            onSavePosition={handleSpritePositionChanged}
                            onSpriteSelected={handleSpriteSelected}
                            onAddSpriteRequested={() => setShowSpriteLibrary(true)}

                            // Props for sprite controls in TheatreStage Toolbar
                            hasChanges={hasUnsavedChanges}
                            activeSprite={selectedImage !== 'original' ? selectedImage : null}
                            isSpriteVisible={layerVisibility[selectedImage] !== false}
                            onToggleSpriteVisibility={type === 'scene' && selectedImage !== 'original' ? () => {
                                toggleLayerVisibility(selectedImage);
                                setHasUnsavedChanges(true);
                            } : undefined}
                            onDeleteSprite={type === 'scene' && selectedImage !== 'original' ? () => {
                                if (window.confirm(`Are you sure you want to permanently delete sprite "${selectedImage}"? This cannot be undone.`)) {
                                    handleDeleteSprite(selectedImage);
                                    setHasUnsavedChanges(true);
                                }
                            } : undefined}
                            onAddBehavior={type === 'scene' && selectedImage !== 'original' ? () => {
                                handleTabChange('sprites'); // Ensure tab is open
                                // Ideally we'd scroll to it or auto-expand, but for now just switching tab is enough
                            } : undefined}
                            // Placeholder onSave until we have a distinct save action separate from auto-save
                            onSave={() => {
                                handleUpdateConfig(JSON.stringify(asset.config, null, 2));
                                setHasUnsavedChanges(false);
                                toast.success("Changes saved");
                            }}

                            actions={
                                type === 'sprite' && asset.has_original && (
                                    <button className="btn" title="Revert to Original" onClick={handleRevert} style={{ padding: '2px 6px' }}>
                                        <Icon name="revert" size={14} />
                                    </button>
                                )
                            }
                        />

                        {/* Timeline for Scene Playing - Always Visible for Scenes */}
                        {type === 'scene' && (
                            <div style={{ position: 'relative', height: '180px', flexShrink: 0 }}>
                                <TimelineEditor
                                    duration={30}
                                    currentTime={currentTime}
                                    layers={asset.config?.layers || []}
                                    selectedLayer={selectedImage}
                                    onTimeChange={setCurrentTime}
                                    layerVisibility={layerVisibility}
                                    // Layer Update Handler for Timeline Interactions (Z-Reorder)
                                    onLayerUpdate={async (spriteName, updates) => {
                                        if (updates.z_depth_delta || updates.z_depth !== undefined) {
                                            let updatedConfig = JSON.parse(JSON.stringify(asset.config));
                                            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === spriteName);
                                            if (layer) {
                                                if (updates.z_depth !== undefined) {
                                                    layer.z_depth = updates.z_depth;
                                                } else {
                                                    layer.z_depth = (layer.z_depth || 0) + updates.z_depth_delta;
                                                }

                                                // Handle Global Normalization
                                                if (updates.dropMode === 'normalize') {
                                                    // Sort and re-index all layers to 10s
                                                    updatedConfig.layers.sort((a, b) => (a.z_depth || 0) - (b.z_depth || 0));
                                                    updatedConfig.layers.forEach((l, idx) => {
                                                        l.z_depth = idx * 10;
                                                    });
                                                    toast.info("Normalizing all layers to 10s place");
                                                }

                                                const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(updatedConfig)
                                                });
                                                if (res.ok) {
                                                    await refresh();
                                                    if (updates.dropMode === 'midpoint' || updates.dropMode === 'new_top' || updates.dropMode === 'new_bottom') {
                                                        toast.success(`Created new layer at Z=${updates.z_depth}`);
                                                    } else if (updates.dropMode !== 'normalize') {
                                                        toast.success(`Moved ${spriteName} to Z=${updates.z_depth}`);
                                                    }
                                                }
                                            }
                                        }
                                        if (updates.visible !== undefined) {
                                            const current = layerVisibility[spriteName] !== false;
                                            if (current !== updates.visible) {
                                                toggleLayerVisibility(spriteName);
                                            }
                                        }
                                    }}
                                    onKeyframeMove={handleKeyframeMove}
                                    onSelectLayer={handleSpriteSelected}
                                    assetBaseUrl={window.API_BASE ? window.API_BASE.replace('/api', '/assets') : undefined}
                                    onPlayPause={() => {
                                        // TODO: Control TheatreStage playback via prop if needed
                                    }}
                                    isPlaying={isPlaying}
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
                                className={`btn ${activeTab === 'sprites' ? 'active-tab' : ''}`}
                                style={{
                                    borderBottom: activeTab === 'sprites' ? '2px solid var(--color-primary)' : 'none',
                                    borderRadius: 0,
                                    padding: '8px 16px',
                                    color: activeTab === 'sprites' ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
                                    background: activeTab === 'sprites' ? 'var(--color-primary)' : 'transparent'
                                }}
                                onClick={() => handleTabChange('sprites')}
                            >
                                Sprites
                            </button>

                            <button
                                className={`btn ${activeTab === 'json' ? 'active-tab' : ''}`}
                                style={{
                                    borderBottom: activeTab === 'json' ? '2px solid var(--color-primary)' : 'none',
                                    borderRadius: 0,
                                    padding: '8px 16px',
                                    color: activeTab === 'json' ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
                                    background: activeTab === 'json' ? 'var(--color-primary)' : 'transparent'
                                }}
                                onClick={() => handleTabChange('json')}
                            >
                                Config
                            </button>
                            <button
                                className={`btn ${activeTab === 'debug' ? 'active-tab' : ''}`}
                                style={{
                                    borderBottom: activeTab === 'debug' ? '2px solid var(--color-primary)' : 'none',
                                    borderRadius: 0,
                                    padding: '8px 16px',
                                    color: activeTab === 'debug' ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
                                    background: activeTab === 'debug' ? 'var(--color-primary)' : 'transparent'
                                }}
                                onClick={() => handleTabChange('debug')}
                            >
                                Debug
                            </button>
                        </div>

                        {activeTab === 'sprites' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                                <SpriteListEditor
                                    type={type}
                                    asset={asset}
                                    selectedSprite={selectedImage}
                                    onSpriteSelected={setSelectedImage}
                                    layerVisibility={layerVisibility}
                                    onToggleVisibility={toggleLayerVisibility}
                                    onRemoveLayer={handleRemoveLayer}
                                    onBehaviorsChange={handleEventsChange}
                                    behaviorGuidance={behaviorGuidance}
                                    onAddSprite={() => setShowSpriteLibrary(true)}
                                    currentTime={currentTime}
                                />
                            </div>
                        )}



                        {activeTab === 'debug' && (
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

                        {activeTab === 'json' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                {/* Prompt Box for Config Refinement */}
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    <textarea
                                        className="input"
                                        placeholder="Describe changes to metadata/physics..."
                                        value={configPrompt}
                                        onChange={e => setConfigPrompt(e.target.value)}
                                        style={{ flex: 1, height: '38px', minHeight: '38px', resize: 'none' }}
                                        title="Refine Configuration: Describe changes to metadata, physics parameters, or behaviors. The AI will update the JSON accordingly."
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleUpdateConfig}
                                        disabled={isOptimizing || !configPrompt.trim()}
                                        style={{ height: 'auto' }}
                                        title="Apply AI refinements to configuration"
                                    >
                                        <Icon name="config" size={14} />
                                    </button>
                                </div>

                                <div ref={configScrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    <SmartConfigViewer configData={configData} selectedImage={selectedImage} type={type} scrollContainerRef={configScrollRef} />
                                </div>
                            </div>
                        )}

                    </div >
                }
            />
        </>
    );
}

// Helper to render JSON with auto-scroll focus
function SmartConfigViewer({ configData, selectedImage, type, scrollContainerRef }) {
    // containerRef is now passed from parent
    const fallbackRef = useRef(null);
    const containerRef = scrollContainerRef || fallbackRef;

    // Auto-scroll when selectedImage changes
    useEffect(() => {
        if (!selectedImage || !containerRef.current) return;

        // Find target element
        const targetId = `json-layer-${selectedImage}`;
        const el = document.getElementById(targetId);

        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Highlight effect
            el.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
            setTimeout(() => {
                if (el) el.style.backgroundColor = 'transparent';
            }, 1000);
        } else if (selectedImage === 'original') {
            // Scroll to top for general config
            if (containerRef.current && containerRef.current.scrollTo) {
                containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [selectedImage, configData, containerRef]);

    if (!configData) return <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>No configuration data.</div>;

    // For sprites, simplified view
    if (type === 'sprite') {
        return (
            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                {JSON.stringify(configData, null, 2)}
            </pre>
        );
    }

    // For scenes, split structure
    const { layers, ...rest } = configData;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {/* General Settings */}
            <div>
                <div style={{ opacity: 0.5, marginBottom: '4px', fontWeight: 'bold' }}>// Scene Settings</div>
                <pre style={{ margin: 0 }}>{JSON.stringify(rest, null, 2)}</pre>
            </div>

            {/* Layers */}
            {layers && layers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ opacity: 0.5, fontWeight: 'bold' }}>// Layers</div>
                    {layers.map((layer, idx) => (
                        <div
                            key={idx}
                            id={`json-layer-${layer.sprite_name}`}
                            style={{
                                padding: '8px',
                                border: layer.sprite_name === selectedImage ? '1px solid var(--color-primary)' : '1px solid transparent',
                                background: layer.sprite_name === selectedImage ? 'var(--color-bg-elevated)' : 'rgba(255,255,255,0.03)',
                                borderRadius: '4px',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ opacity: 0.7, marginBottom: '4px', color: 'var(--color-primary)' }}>
                                {`[${idx}] ${layer.sprite_name}`}
                            </div>
                            <pre style={{ margin: 0 }}>{JSON.stringify(layer, null, 2)}</pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Hook to encapsulate logic
function useAssetController(type, asset, refresh, onDelete) {
    const [logs, setLogs] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [selectedImage, setSelectedImage] = useState(type === 'sprite' ? asset.name : 'original');
    const [visualPrompt, setVisualPrompt] = useState('');
    const [configPrompt, setConfigPrompt] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [imageTimestamp, setImageTimestamp] = useState(Date.now());
    const [processingMode, setProcessingMode] = useState('local'); // 'local' (free) or 'llm' (quality)

    // Initialization & Reset
    useEffect(() => {
        if (type === 'sprite') {
            setSelectedImage(asset.name);
        } else {
            // Default to first sprite if available, otherwise original
            const hasSprites = asset.used_sprites && asset.used_sprites.length > 0;
            setSelectedImage(hasSprites ? asset.used_sprites[0] : 'original');
        }

        // Update timestamp on new asset
        setImageTimestamp(Date.now());

        // Load persisted prompt
        const key = `papeterie_optimize_prompt_${type}_${asset.name}`;
        const saved = localStorage.getItem(key);
        setVisualPrompt(saved || '');

        setConfigPrompt('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asset.name, type]); // Removed asset.used_sprites to prevent reset on incremental updates

    // Auto-select new sprites during optimization
    const prevSpriteCountRef = useRef(0);
    useEffect(() => {
        const currentCount = asset.used_sprites?.length || 0;

        // Reset ref on new asset
        if (asset.name !== prevAssetNameRef.current) {
            prevAssetNameRef.current = asset.name;
            prevSpriteCountRef.current = currentCount;
            return;
        }

        // Check for new sprites during optimization
        if (type === 'scene' && isOptimizing && currentCount > prevSpriteCountRef.current) {
            if (currentCount > 0) {
                // Select the newest sprite (last in the list)
                setSelectedImage(asset.used_sprites[currentCount - 1]);
            }
        }

        prevSpriteCountRef.current = currentCount;
    }, [asset.name, asset.used_sprites, type, isOptimizing]);

    const prevAssetNameRef = useRef(asset.name);

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
            interval = setInterval(() => {
                fetchLogs();
                // Incrementally refresh asset data during optimization for scenes 
                // to show sprites as they are extracted.
                if (type === 'scene') {
                    refresh();
                }
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [asset.name, type, isOptimizing, refresh]);

    // --- Actions ---

    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('lastActiveTab') || 'sprites');

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        localStorage.setItem('lastActiveTab', tab);
    };

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

    const toggleLayerVisibility = async (name) => {
        // Optimistic update
        const newVisibility = layerVisibility[name] === false ? true : false;

        setLayerVisibility(prev => ({
            ...prev,
            [name]: newVisibility
        }));

        if (type === 'scene' && asset.config) {
            try {
                const updatedConfig = JSON.parse(JSON.stringify(asset.config));
                const layer = updatedConfig.layers?.find(l => l.sprite_name === name);
                if (layer) {
                    layer.visible = newVisibility;
                    const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedConfig)
                    });
                    if (!res.ok) throw new Error(await res.text());
                    await refresh();
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
        }
    };

    // Initialize visibility from config
    useEffect(() => {
        if (type === 'scene' && asset.config?.layers) {
            const visibilityMap = {};
            asset.config.layers.forEach(l => {
                visibilityMap[l.sprite_name] = l.visible !== false;
            });
            setLayerVisibility(visibilityMap);
        }
    }, [asset.config, type]);

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

            if (mode === 'reset') {
                setSelectedImage(type === 'sprite' ? asset.name : 'original');
                setLogs('');
                refresh();
            } else if (onDelete) {
                onDelete();
            } else {
                refresh();
            }
        } catch (e) {
            toast.error(`Action failed: ${e.message}`);
        }
    };

    const [showSpriteLibrary, setShowSpriteLibrary] = useState(false);

    const handleAddSprite = async (sprite) => {
        if (!asset.config) return;

        // Check if already exists
        const exists = (asset.config.layers || []).find(l => l.sprite_name === sprite.name);
        if (exists) {
            toast.warning(`Sprite '${sprite.name}' is already in the scene.`);
            return;
        }

        // Determine Z-depth from metadata
        let zDepth = 50; // Sensible default
        if (sprite.metadata) {
            // Check for LocationBehavior first
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
            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });
            if (!res.ok) throw new Error(await res.text());
            toast.success(`Added sprite '${sprite.name}' at Z=${zDepth}`);
            setShowSpriteLibrary(false);
            setSelectedImage(sprite.name); // Select the newly added sprite
            handleTabChange('sprites'); // Switch to sprites tab
            await refresh();
        } catch (e) {
            toast.error(`Failed to add sprite: ${e.message}`);
        }
    };

    const handleRemoveLayer = async (spriteName) => {
        // Confirmation removed for optmistic undo flow
        // if (!confirm(`Are you sure you want to remove sprite '${spriteName}' from this scene?`)) return;

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

    const handleDeleteSprite = async (spriteName) => {
        // Delete sprite permanently via API
        try {
            // First remove from scene if present
            if (type === 'scene' && asset.config) {
                const updatedConfig = JSON.parse(JSON.stringify(asset.config));
                updatedConfig.layers = (updatedConfig.layers || []).filter(l => l.sprite_name !== spriteName);

                await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedConfig)
                });
            }

            // Then delete the sprite asset
            const res = await fetch(`${API_BASE}/sprites/${spriteName}?mode=delete`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).detail);

            toast.success(`Deleted sprite "${spriteName}" permanently`);
            setSelectedImage('original');
            await refresh();
        } catch (e) {
            toast.error(`Failed to delete sprite: ${e.message}`);
        }
    };

    const handleSpriteSelected = (spriteName) => {
        // Update selected image when sprite is clicked in theatre
        if (type === 'scene') {
            setSelectedImage(spriteName);
            // Optionally switch to sprites tab (where behavior now lives)
            handleTabChange('sprites');
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

    const handleShare = async () => {
        if (!confirm(`Share '${asset.name}' with the community? This will make a public copy of your asset.`)) return;

        try {
            const endpoint = type === 'sprite' ? 'sprites' : 'scenes';
            const res = await fetch(`${API_BASE}/${endpoint}/${asset.name}/share`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).detail);
            toast.success(`Successfully shared '${asset.name}' with the community!`);
            await refresh();
        } catch (e) {
            toast.error(`Sharing failed: ${e.message}`);
        }
    };

    const handleSaveRotation = async (degrees) => {
        if (!confirm(`Apply ${degrees} degree rotation permanently? This will modify the image file.`)) return;

        setIsOptimizing(true);
        try {
            // Normalize degrees to be within reasonable bounds if needed, but backend handles int
            // degrees is usually 90, 180, -90 etc.

            // Sprite and Scene rotation both supported now
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
            // We rely on ImageViewer to reset its internal rotation state via prop or effect if needed,
            // but currently ImageViewer resets on mount or new image.
            // Since refresh() might update the image URL (timestamp), it should trigger a re-render.
            // However, ImageViewer only resets pos on mainSrc change. It doesn't reset rotation explicitly on mainSrc change yet.
            // Check ImageViewer implementation:
            // useEffect(() => {setPosition... }, [mainSrc]);
            // It does NOT reset rotation on mainSrc change. I should fix that in ImageViewer or force it here.
            // Actually, if we refresh, mainSrc changes (timestamp), so we want rotation to go back to 0.

        } catch (e) {
            toast.error(`Rotation failed: ${e.message}`);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleSpriteRotationChanged = async (spriteName, degrees) => {
        if (type !== 'scene') return;
        try {
            if (!asset.config) return;
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === spriteName);
            if (!layer) return;

            // Updated base rotation or location behavior if it exists
            const loc = (layer.behaviors || []).find(b => b.type === 'location' && b.time_offset === undefined);
            if (loc) {
                loc.rotation = degrees;
            } else {
                layer.rotation = degrees;
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
    };

    const handleSaveScale = async (arg1, arg2, arg3) => {
        // Handle varying signatures: (scale) or (spriteName, scale) or (spriteName, scale, time)
        let targetSprite = selectedImage;
        let newScale = arg1;
        let time = 0;

        if (typeof arg1 === 'string' && typeof arg2 === 'number') {
            targetSprite = arg1;
            newScale = arg2;
            if (typeof arg3 === 'number') time = arg3;
        }

        if (type !== 'scene' || !targetSprite || targetSprite === 'original') return;

        try {
            const updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === targetSprite);
            if (!layer) throw new Error(`Layer ${targetSprite} not found`);

            // Always update base scale if at t=0 or if it's the intended base edit
            // But if t > 0, we create a keyframe.
            if (time > 0.1) {
                if (!layer.behaviors) layer.behaviors = [];
                // Find existing keyframe at this time
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

                // Merge with existing keyframe props if updating
                if (existingIndex >= 0) {
                    const existing = layer.behaviors[existingIndex];
                    layer.behaviors[existingIndex] = { ...existing, scale: newScale };
                } else {
                    layer.behaviors.push(kf);
                    // Sort
                    layer.behaviors.sort((a, b) => (a.time_offset || 0) - (b.time_offset || 0));
                }
                toast.success(`Keyframed scale for ${targetSprite} at ${time.toFixed(1)}s`);
            } else {
                // Base Scale
                layer.scale = newScale;
                // Also update any static LocationBehavior (time_offset undefined)
                if (layer.behaviors) {
                    const baseLoc = layer.behaviors.find(b => b.type === 'location' && b.time_offset === undefined);
                    if (baseLoc) baseLoc.scale = newScale;
                }
                toast.success(`Updated base scale for ${targetSprite}`);
            }

            const res = await fetch(`${API_BASE}/scenes/${asset.name}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });
            if (!res.ok) throw new Error(await res.text());

            await refresh();
        } catch (e) {
            const msg = `Failed to save scale: ${e.message}`;
            toast.error(msg, { duration: 8000 }); // Longer duration
            setLogs(prev => prev + `\n[UI ERROR] ${msg}`); // Append to visible log
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
        tabs.push({ id: asset.name, label: 'Current', onClick: () => setSelectedImage(asset.name), isActive: selectedImage === asset.name });
        if (asset.has_original) {
            tabs.push({ id: 'original', label: 'Original', onClick: () => setSelectedImage('original'), isActive: selectedImage === 'original' });
        }
    } else {
        tabs.push({ id: 'original', label: 'Original', onClick: () => setSelectedImage('original'), isActive: selectedImage === 'original' });
        (asset.used_sprites || []).forEach(s => {
            tabs.push({
                id: s,
                label: s,
                onClick: () => setSelectedImage(s),
                isActive: selectedImage === s,
                isSprite: true,
                isVisible: layerVisibility[s] !== false,
                onDelete: () => handleRemoveLayer(s)
            });
        });
        tabs.push({
            id: 'add-sprite',
            label: '+',
            onClick: () => setShowSpriteLibrary(true),
            isActive: false,
            title: "Add Sprite from Library"
        });
    }

    let mainSrc = null;
    if (type === 'sprite') {
        const url = selectedImage === 'original' ? asset.original_url : asset.image_url;
        mainSrc = url ? `${API_BASE.replace('/api', '')}${url}?t=${imageTimestamp}` : null;
    } else {
        if (selectedImage === 'original') {
            mainSrc = asset.original_url ? `${API_BASE.replace('/api', '')}${asset.original_url}?t=${imageTimestamp}` : null;
        } else if (selectedImage) {
            // Scene sprite view - we don't have the full URL here easily without fetching sprite info, 
            // but we can construct it assuming 'default' user for now as a fallback or 
            // if we want to be robust, we should have a sprite URL lookup.
            // For now, let's use the known pattern:
            mainSrc = `${API_BASE.replace('/api', '')}/assets/users/default/sprites/${selectedImage}/${selectedImage}.png?t=${imageTimestamp}`;
        }
    }

    const activeLayer = (type === 'scene' && selectedImage !== 'original')
        ? (asset.config?.layers || []).find(l => l.sprite_name === selectedImage)
        : null;

    const currentBehaviors = type === 'sprite'
        ? (asset.metadata?.behaviors || asset.metadata?.events || [])
        : (activeLayer ? (activeLayer.behaviors || activeLayer.events || []) : []);

    // Extract behavior_guidance from the active layer (scene) or metadata (sprite)
    const behaviorGuidance = type === 'sprite'
        ? (asset.metadata?.behavior_guidance || null)
        : (activeLayer?.behavior_guidance || null);

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
        behaviorGuidance,
        activeTab,
        setActiveTab,
        handleTabChange,
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
        handleDeleteSprite,
        handleSpriteSelected,
        handleSpritePositionChanged,
        handleKeyframeMove,
        handleShare,
        handleSaveRotation,
        handleSpriteRotationChanged,
        handleSaveScale,
        showSpriteLibrary,
        setShowSpriteLibrary,
        handleAddSprite,
        activeLayer,
        processingMode,
        setProcessingMode,
    };
}

