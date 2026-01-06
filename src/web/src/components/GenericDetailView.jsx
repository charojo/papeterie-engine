import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AssetDetailLayout } from './AssetDetailLayout';
import { ImageViewer } from './ImageViewer';
import { Icon } from './Icon';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { BehaviorEditor } from './BehaviorEditor';
import { SpriteListEditor } from './SpriteListEditor';
import { TimelineEditor } from './TimelineEditor';
import { SpriteLibraryDialog } from './SpriteLibraryDialog';
import { StatusStepper } from './StatusStepper';
import { useAssetLogs } from '../hooks/useAssetLogs';
import { useLayerOperations } from '../hooks/useLayerOperations';
import { useTransformEditor } from '../hooks/useTransformEditor';
import { useOptimization } from '../hooks/useOptimization';
import { useBehaviorEditor } from '../hooks/useBehaviorEditor';
import { API_BASE, ASSET_BASE } from '../config';


export function GenericDetailView({ type, asset, refresh, onDelete, isExpanded, toggleExpand, _onOpenSprite, sprites, setContextualActions }) {
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
        handleDeleteSprite,
        handleSpriteSelected,
        handleSpritePositionChanged,
        handleKeyframeMove,
        handleKeyframeDelete,
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

    // Update TopBar contextual actions
    const contextualActions = useMemo(() => {
        return {
            play: type === 'scene' && (
                <button
                    className={`btn-icon ${isPlaying ? 'active' : ''}`}
                    title={isPlaying ? "Stop Scene" : "Play Scene"}
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    <Icon name={isPlaying ? "stop" : "play"} size={16} />
                </button>
            ),
            search: type === 'scene' && (
                <button className="btn-icon" title="Search/Add Sprite to Scene" onClick={() => setShowSpriteLibrary(true)}>
                    <Icon name="search" size={16} />
                </button>
            ),
            right: (
                <>
                    {!asset.is_community && (
                        <button className="btn-icon" title="Share Scene/Sprites to Community" onClick={handleShare}>
                            <Icon name="share" size={16} />
                        </button>
                    )}
                    <button className="btn-icon" title="Reset/Delete options for Scenes" onClick={handleDeleteClick}>
                        <Icon name="delete" size={16} />
                    </button>
                </>
            )
        };
    }, [isPlaying, type, asset.is_community, handleShare, setShowSpriteLibrary, setIsPlaying, handleDeleteClick]);

    useEffect(() => {
        if (!setContextualActions) return;
        setContextualActions(contextualActions);
        return () => setContextualActions(null);
    }, [contextualActions, setContextualActions]);

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
                title={asset.name}
                statusLabel={statusLabel}
                logs={logs}
                isExpanded={isExpanded}
                visualContent={
                    <div className="flex-col gap-xl flex-1 w-full">
                        {/* Unified Prompt Box & Actions for Visuals - Moved to Top */}
                        {!isExpanded && (
                            <div className="flex-row gap-md">
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
                            assetBaseUrl={ASSET_BASE + '/assets'} // Explicit pass
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
                            <div className="relative h-180 flex-shrink-0">
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
                                    onKeyframeDelete={handleKeyframeDelete}
                                    onSelectLayer={handleSpriteSelected}
                                    assetBaseUrl={ASSET_BASE + '/assets'}
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
                    <div className="flex-col gap-xl h-full">
                        {/* Tab Switcher for Right Pane */}
                        <div className="tab-container tab-container-flush">
                            <button
                                className={`tab-btn ${activeTab === 'sprites' ? 'active' : ''}`}
                                onClick={() => handleTabChange('sprites')}
                            >
                                Sprites
                            </button>

                            <button
                                className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                                onClick={() => handleTabChange('json')}
                            >
                                Config
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'debug' ? 'active' : ''}`}
                                onClick={() => handleTabChange('debug')}
                            >
                                Debug
                            </button>
                        </div>

                        {activeTab === 'sprites' && (
                            <div className="flex-col flex-1 min-h-0">
                                <SpriteListEditor
                                    type={type}
                                    asset={asset}
                                    selectedSprite={selectedImage}
                                    onSpriteSelected={setSelectedImage}
                                    layerVisibility={layerVisibility}
                                    onToggleVisibility={toggleLayerVisibility}
                                    onDeleteSprite={handleDeleteSprite}
                                    onBehaviorsChange={handleEventsChange}
                                    behaviorGuidance={behaviorGuidance}
                                    currentTime={currentTime}
                                />
                            </div>
                        )}



                        {activeTab === 'debug' && (
                            <div className="flex-1 overflow-auto flex-col gap-lg">
                                <div className="panel-header">
                                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Debug Overlay</span>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {['auto', 'on', 'off'].map(mode => (
                                            <button
                                                key={mode}
                                                className={`btn btn-xs ${debugOverlayMode === mode ? 'btn-primary' : ''} p-1 text-xs capitalize`}
                                                onClick={() => setDebugOverlayMode(mode)}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ background: 'var(--color-bg-elevated)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                    <h4 className="m-0 mb-2 text-base text-primary">Live Telemetry</h4>
                                    {!telemetry ? (
                                        <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>Play the scene to see live data.</div>
                                    ) : (
                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr className="text-left text-subtle border-b">
                                                    <th className="pb-1 w-6"></th>
                                                    <th className="pb-1">Layer</th>
                                                    <th className="pb-1">X</th>
                                                    <th className="pb-1">Y Pos</th>
                                                    <th className="pb-1">Tilt</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {telemetry.map(t => (
                                                    <tr key={t.name} className="border-b-muted">
                                                        <td className="py-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={layerVisibility[t.name] !== false}
                                                                onChange={() => toggleLayerVisibility(t.name)}
                                                                className="cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-1">{t.name}</td>
                                                        <td className="py-1">{Math.round(t.x)}</td>
                                                        <td className="py-1">{t.y.toFixed(1)}</td>
                                                        <td className="py-1">{t.tilt.toFixed(1)}°</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                <div className="panel text-sm">
                                    <p className="m-0 text-subtle">Tip: Select a layer to see its environment sampling markers on the stage.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'json' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                {/* Prompt Box for Config Refinement */}
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    <textarea
                                        className="input flex-1 h-10 resize-none"
                                        placeholder="Describe changes to metadata/physics..."
                                        value={configPrompt}
                                        onChange={e => setConfigPrompt(e.target.value)}
                                        title="Refine Configuration: Describe changes to metadata, physics parameters, or behaviors. The AI will update the JSON accordingly."
                                    />
                                    <button
                                        className="btn btn-primary h-auto"
                                        onClick={handleUpdateConfig}
                                        disabled={isOptimizing || !configPrompt.trim()}
                                        title="Apply AI refinements to configuration"
                                    >
                                        <Icon name="config" size={14} />
                                    </button>
                                </div>

                                <div ref={configScrollRef} className="flex-1 overflow-auto min-h-0">
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
            el.style.backgroundColor = 'var(--color-primary-glow)';
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

    if (!configData) return <div className="text-subtle text-sm">No configuration data.</div>;

    // For sprites, simplified view
    if (type === 'sprite') {
        return (
            <pre className="m-0 text-sm text-monospace">
                {JSON.stringify(configData, null, 2)}
            </pre>
        );
    }

    // For scenes, split structure
    const { layers, ...rest } = configData;

    return (
        <div className="flex-col gap-xl text-monospace text-sm">
            {/* General Settings */}
            <div>
                <div className="text-subtle mb-1 font-bold">// Scene Settings</div>
                <pre className="m-0">{JSON.stringify(rest, null, 2)}</pre>
            </div>

            {/* Layers */}
            {layers && layers.length > 0 && (
                <div className="flex-col gap-md">
                    <div className="text-subtle font-bold">// Layers</div>
                    {layers.map((layer, idx) => (
                        <div
                            key={idx}
                            id={`json-layer-${layer.sprite_name}`}
                            style={{
                                padding: '8px',
                                border: layer.sprite_name === selectedImage ? '1px solid var(--color-primary)' : '1px solid transparent',
                                background: layer.sprite_name === selectedImage ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
                                borderRadius: '4px',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div className="text-subtle mb-1 text-primary">
                                {`[${idx}] ${layer.sprite_name}`}
                            </div>
                            <pre className="m-0">{JSON.stringify(layer, null, 2)}</pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Hook to encapsulate logic
function useAssetController(type, asset, refresh, onDelete) {
    const [selectedImage, setSelectedImage] = useState(type === 'sprite' ? asset.name : 'original');
    const [configPrompt, setConfigPrompt] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const {
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
    } = useOptimization(type, asset, refresh);

    // Use extracted hook for log fetching and polling
    const logs = useAssetLogs(type, asset.name, isOptimizing, type === 'scene' ? refresh : null);

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

    // NOTE: Log fetching is now handled by useAssetLogs hook above

    // --- Actions ---

    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('lastActiveTab') || 'sprites');

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        localStorage.setItem('lastActiveTab', tab);
    };

    const { handleBehaviorsChange: handleEventsChange } = useBehaviorEditor(type, asset, selectedImage, refresh);


    const {
        layerVisibility,
        showSpriteLibrary,
        setShowSpriteLibrary,
        toggleLayerVisibility,
        handleAddSprite,
        handleRemoveLayer,
        handleDeleteSprite,
        initializeVisibility
    } = useLayerOperations(asset, refresh);

    const {
        handleSpritePositionChanged,
        handleSpriteRotationChanged,
        handleSpriteScaleChanged: handleSaveScale,
        handleKeyframeMove,
        handleKeyframeDelete
    } = useTransformEditor(asset, refresh);

    const [telemetry, setTelemetry] = useState(null);
    const handleTelemetry = (data) => {
        setTelemetry(data);
    };

    const [debugOverlayMode, setDebugOverlayMode] = useState('auto'); // 'auto' | 'on' | 'off'

    // Initialize visibility from config
    useEffect(() => {
        initializeVisibility(asset.config);
    }, [asset.config, initializeVisibility]);

    const handleUpdateConfig = async () => {
        toast.info("Config refinement coming soon!", { description: `Prompt: ${configPrompt}` });
        setConfigPrompt('');
    };

    const handleDeleteClick = useCallback(() => {
        setShowDeleteDialog(true);
    }, []);

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

    const handleSpriteSelected = (spriteName) => {
        if (type === 'scene') {
            setSelectedImage(spriteName);
            handleTabChange('sprites');
        }
    };

    const handleShare = useCallback(async () => {
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
    }, [asset.name, refresh, type]);


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
            mainSrc = `${ASSET_BASE}/assets/users/default/sprites/${selectedImage}/${selectedImage}.png?t=${imageTimestamp}`;
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
        handleKeyframeDelete,
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

