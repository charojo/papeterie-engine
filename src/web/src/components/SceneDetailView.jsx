import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AssetDetailLayout } from './AssetDetailLayout';
import { ImageViewer } from './ImageViewer';
import { Icon } from './Icon';
import { Button } from './Button';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { SpriteListEditor } from './SpriteListEditor';
import { TimelineEditor } from './TimelineEditor';
import { SpriteSelectionDialog } from './SpriteSelectionDialog';
import { StatusStepper } from './StatusStepper';
import { SmartConfigViewer } from './SmartConfigViewer';
import { createLogger } from '../utils/logger';
import { useAssetController } from '../hooks/useAssetController';
import { useResizableRatio } from '../hooks/useResizable';
import { API_BASE, ASSET_BASE } from '../config';
import './SceneDetailView.css';

const log = createLogger('SceneDetailView');
const SCENE_DURATION = 30;

export function SceneDetailView({ asset, user, refresh, onDelete, isExpanded, toggleExpand, sprites, setContextualActions, onOpenSprite, updateAssetLocal }) {
    const userId = user?.user_id || user?.username || 'default';
    const {

        isOptimizing,
        selectedImage,
        visualPrompt,
        setVisualPrompt,
        configPrompt,
        setConfigPrompt,
        handleOptimize,
        handleUpdateConfig,
        handleEventsChange,

        behaviorGuidance,
        activeTab,
        handleTabChange,
        handleDeleteClick,


        configData,
        telemetry,
        handleTelemetry,
        debugOverlayMode,
        setDebugOverlayMode,
        toggleLayerVisibility,
        layerVisibility,
        handleDeleteSprite,
        handleSpriteSelected,
        handleSpritePositionChanged,
        handleKeyframeMove,
        handleKeyframeDelete,
        handleSpriteRotationChanged,
        showDeleteDialog,
        setShowDeleteDialog,
        handleConfirmDelete,
        showSpriteLibrary,
        setShowSpriteLibrary,
        handleAddSprite,


        selectedSprites, // Multi-selection support

        handleClearSelection,
        undo,
        redo,
        saveConfig
    } = useAssetController('scene', asset, refresh, onDelete, updateAssetLocal);

    const [currentTime, setCurrentTime] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [selectedKeyframe, setSelectedKeyframe] = useState(null);
    const [forceScrollCounter, setForceScrollCounter] = useState(0);
    const [detailsMode, setDetailsMode] = useState('off'); // 'on' | 'off'
    const [inputContext, setInputContext] = useState('vis'); // 'vis' | 'timeline'

    const handleSpriteSelectedWithTimelineSync = useCallback((spriteName, allSelected) => {
        handleSpriteSelected(spriteName, allSelected);
        if (spriteName) {
            setSelectedKeyframe({ spriteName, behaviorIndex: null, time: 0 });
            setForceScrollCounter(c => c + 1);
            log.debug(`Synced timeline selection to sprite: ${spriteName}`);
        }
    }, [handleSpriteSelected]);

    const theatreTimelineContainerRef = useRef(null);
    const { ratio: theatreRatio, setRatio: setTheatreRatio, isResizing: isTheatreResizing, startResize: startTheatreResize } = useResizableRatio(
        `papeterie-theatre-timeline-split-${asset.name}`,
        0.65,
        { minRatio: 0.3, maxRatio: 0.85, direction: 'vertical' }
    );

    // Resizable panel ratio for Main Layout (Visuals vs Config)
    // Lifted from AssetDetailLayout to allow programmatic control based on 'Details' mode
    const mainLayoutResizable = useResizableRatio(
        'papeterie-panel-split',
        0.67, // Default 2:1 ratio
        { minRatio: 0.3, maxRatio: 0.85, direction: 'horizontal' }
    );

    const lastManualRatio = useRef(null);
    const lastTheatreRatio = useRef(null);

    useEffect(() => {
        if (detailsMode === 'on') {
            // Expand to 50% if currently wider than 50% (visuals taking > 50%)
            if (mainLayoutResizable.ratio > 0.5) {
                lastManualRatio.current = mainLayoutResizable.ratio;
                mainLayoutResizable.setRatio(0.5);
                toast.info("Sidebar expanded for details view");
            }
        } else {
            // Restore functionality when turning off details
            if (lastManualRatio.current !== null) {
                mainLayoutResizable.setRatio(lastManualRatio.current);
                lastManualRatio.current = null;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailsMode]);

    const handleResizeHandleDoubleClick = useCallback(() => {
        const MAX_LEFT_RATIO = 0.85; // Effectively minimized right panel (matches hook maxRatio)

        // If we are effectively at maximum size for theatre (right panel minimized), restore
        if (mainLayoutResizable.ratio >= MAX_LEFT_RATIO - 0.02) {
            mainLayoutResizable.setRatio(lastManualRatio.current || 0.67);
            log.debug(`Restored main layout ratio to ${lastManualRatio.current || 0.67}`);
        } else {
            // Otherwise maximize theatre (minimize right panel)
            lastManualRatio.current = mainLayoutResizable.ratio;
            mainLayoutResizable.setRatio(0.85); // Target minimized state
            log.debug(`Maximized theatre (ratio: 0.85), saved previous: ${lastManualRatio.current}`);
        }
    }, [mainLayoutResizable]);

    const handleTheatreResizeHandleDoubleClick = useCallback(() => {
        if (!theatreTimelineContainerRef.current) return;

        const containerHeight = theatreTimelineContainerRef.current.offsetHeight;
        const numLayers = (asset.config?.layers || []).length;

        // Calculate target timeline height (Toolbar: 32px, Ruler: 24px, Track: 34px)
        const timelineHeaderHeight = 32 + 24;
        const targetTracks = Math.min(numLayers, 3);
        const targetTimelinePixels = timelineHeaderHeight + (targetTracks * 34) + 10; // +10 buffer

        const targetTheatreRatio = 1 - (targetTimelinePixels / containerHeight);

        // If theatre is already maximized (timeline minimized), restore
        if (theatreRatio >= targetTheatreRatio - 0.02) {
            setTheatreRatio(lastTheatreRatio.current || 0.65);
            log.debug(`Restored theatre ratio to ${lastTheatreRatio.current || 0.65}`);
        } else {
            // Otherwise maximize theatre (minimize timeline)
            lastTheatreRatio.current = theatreRatio;
            setTheatreRatio(targetTheatreRatio);
            log.debug(`Maximized theatre (ratio: ${targetTheatreRatio}), saved previous: ${lastTheatreRatio.current}`);
        }
    }, [theatreRatio, setTheatreRatio, asset.config?.layers]);

    const handleBehaviorSelect = useCallback((spriteName, behaviorIndex) => {
        const layer = (asset.config?.layers || []).find(l => l.sprite_name === spriteName);
        if (layer && layer.behaviors && layer.behaviors[behaviorIndex]) {
            const behavior = layer.behaviors[behaviorIndex];
            setSelectedKeyframe({
                spriteName,
                behaviorIndex,
                time: behavior.time_offset ?? 0
            });
            setCurrentTime(behavior.time_offset ?? 0);
        }
    }, [asset.config, setSelectedKeyframe, setCurrentTime]);

    const handleKeyframeSelect = (spriteName, behaviorIndex, time) => {
        setSelectedKeyframe({ spriteName, behaviorIndex, time });
        setCurrentTime(time ?? 0);
    };

    const [isPlaying, setIsPlaying] = useState(false);
    const configScrollRef = useRef(null);

    useEffect(() => {
        setIsPlaying(false);
    }, [asset.name]);

    const contextualActions = useMemo(() => {
        return {
            play: null,
            search: null,
            right: (
                <>
                    <Button
                        variant="icon"
                        onClick={handleDeleteClick}
                        title="Delete Scene"
                        icon="delete"
                    />
                </>
            )
        };
    }, [onDelete, handleDeleteClick]);

    // Global Key Listener for Escape (Clear Selection)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleSpriteSelectedWithTimelineSync(null, []);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSpriteSelectedWithTimelineSync]);

    // Global Key Listener for Undo/Redo
    useEffect(() => {
        const handleUndoRedo = (e) => {
            // Ignore if input/textarea is focused
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        redo();
                    } else {
                        e.preventDefault();
                        undo();
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    redo();
                }
            }
        };
        window.addEventListener('keydown', handleUndoRedo);
        return () => window.removeEventListener('keydown', handleUndoRedo);
    }, [undo, redo]);

    useEffect(() => {
        if (!setContextualActions) return;
        setContextualActions(contextualActions);
        return () => setContextualActions(null);
    }, [contextualActions, setContextualActions]);

    // Auto-scroll telemetry row into view when selection changes
    useEffect(() => {
        if (detailsMode === 'on' && selectedImage && selectedImage !== 'original') {
            const el = document.getElementById(`sprite-list-item-${selectedImage}`);
            if (el) {
                // Wait briefly to ensure layout is ready
                const timeoutId = setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [selectedImage, detailsMode]);

    // Removed Auto-Fix logic per user request to allow Z <= 0.

    const handleLayerUpdate = useCallback(async (spriteName, updates) => {
        if (updates.z_depth_delta || updates.z_depth !== undefined) {
            let updatedConfig = JSON.parse(JSON.stringify(asset.config));
            const layer = (updatedConfig.layers || []).find(l => l.sprite_name === spriteName);
            if (layer) {
                if (updates.behaviorIndex !== undefined && updates.behaviorIndex !== null) {
                    const behavior = (layer.behaviors || layer.events || [])[updates.behaviorIndex];
                    if (behavior) {
                        behavior.z_depth = updates.z_depth;
                        if (behavior.time_offset === undefined) behavior.time_offset = 0;
                    }
                } else if (updates.z_depth !== undefined) {
                    layer.z_depth = updates.z_depth;
                    const initialLoc = (layer.behaviors || []).find(b => b.type === 'location' && (b.time_offset === undefined || b.time_offset === 0));
                    if (initialLoc) {
                        initialLoc.z_depth = updates.z_depth;
                        initialLoc.time_offset = 0;
                    }
                } else {
                    layer.z_depth = (layer.z_depth || 0) + updates.z_depth_delta;
                }

                if (updates.dropMode === 'normalize') {
                    updatedConfig.layers.sort((a, b) => (a.z_depth || 0) - (b.z_depth || 0));
                    updatedConfig.layers.forEach((l, idx) => {
                        l.z_depth = idx * 10;
                    });
                    toast.info("Normalizing all layers to 10s place");
                }

                let description = "Updated layer configuration";
                if (updates.dropMode === 'midpoint' || updates.dropMode === 'new_top' || updates.dropMode === 'new_bottom') {
                    description = `Created new layer at Z=${updates.z_depth}`;
                } else if (updates.dropMode !== 'normalize') {
                    description = `Moved ${spriteName} to Z=${updates.z_depth}`;
                } else {
                    description = "Normalized all layers";
                }

                saveConfig(updatedConfig, description);
            }
        }
        if (updates.visible !== undefined) {
            const current = layerVisibility[spriteName] !== false;
            if (current !== updates.visible) {
                toggleLayerVisibility(spriteName);
            }
        }
    }, [asset.config, layerVisibility, saveConfig, toggleLayerVisibility]);

    // Context-Aware Arrow Key Handlers
    const handleTimelineArrow = useCallback((key) => {
        if (!selectedImage || selectedImage === 'original') {
            // General Timeline Navigation (Time scrubbing with Left/Right even if no sprite selected)
            if (key === 'ArrowLeft') {
                setCurrentTime(Math.max(0, currentTime - 0.1));
            } else if (key === 'ArrowRight') {
                setCurrentTime(Math.min(SCENE_DURATION, currentTime + 0.1));
            }
            return;
        }

        console.log(`[TimelineArrow] Key: ${key} on Sprite: ${selectedImage}`);

        // Sprite Manipulation in Timeline
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            // New Logic: Swap with Next/Prev to avoid creating gaps
            const layers = [...(asset.config?.layers || [])].sort((a, b) => (a.z_depth || 0) - (b.z_depth || 0));
            const currentIndex = layers.findIndex(l => l.sprite_name === selectedImage);

            console.log('[TimelineArrow] Layers:', layers.map(l => `${l.sprite_name}(${l.z_depth})`).join(', '));
            console.log('[TimelineArrow] Current:', currentIndex, selectedImage);

            if (currentIndex === -1) {
                console.warn(`[TimelineArrow] Layer ${selectedImage} not found config`);
                return;
            }

            const currentLayer = layers[currentIndex];

            if (key === 'ArrowUp') {
                // Find next occupied Z-depth
                // We use the sorted `layers` array which represents occupied slots.
                const occupiedZs = [...new Set(layers.map(l => l.z_depth || 1))].sort((a, b) => a - b);
                const currentZ = currentLayer.z_depth || 1;
                const zIndex = occupiedZs.indexOf(currentZ);

                if (zIndex < occupiedZs.length - 1) {
                    // Jump to next occupied layer (Skipping empty ones)
                    const nextZ = occupiedZs[zIndex + 1];
                    console.log(`[TimelineArrow] Up (Skip): ${currentZ} -> ${nextZ}`);
                    handleLayerUpdate(selectedImage, { z_depth: nextZ });
                } else {
                    // At top: Create new layer
                    const newZ = currentZ + 1;
                    console.log(`[TimelineArrow] Up (Create): ${currentZ} -> ${newZ}`);
                    handleLayerUpdate(selectedImage, { z_depth: newZ });
                }
            } else if (key === 'ArrowDown') {
                const occupiedZs = [...new Set(layers.map(l => l.z_depth || 0))].sort((a, b) => a - b);
                const currentZ = currentLayer.z_depth || 0;
                const zIndex = occupiedZs.indexOf(currentZ);

                if (zIndex > 0) {
                    // Jump to prev occupied layer
                    const prevZ = occupiedZs[zIndex - 1];
                    console.log(`[TimelineArrow] Down (Skip): ${currentZ} -> ${prevZ}`);
                    handleLayerUpdate(selectedImage, { z_depth: prevZ });
                } else {
                    // At bottom: Create new layer (Decrement)
                    const newZ = currentZ - 1;
                    console.log(`[TimelineArrow] Down (Create): ${currentZ} -> ${newZ}`);
                    handleLayerUpdate(selectedImage, { z_depth: newZ });
                }
            }
        } else if (key === 'ArrowLeft') {
            setCurrentTime(Math.max(0, currentTime - 0.1));
        } else if (key === 'ArrowRight') {
            setCurrentTime(Math.min(SCENE_DURATION, currentTime + 0.1));
        }
    }, [selectedImage, asset.config, currentTime, handleLayerUpdate]);

    // If sprite library is open, show it as full view (like scene selection)
    if (showSpriteLibrary) {
        return (
            <SpriteSelectionDialog
                sprites={sprites || []}
                onAdd={handleAddSprite}
                onClose={() => setShowSpriteLibrary(false)}
            />
        );
    }

    return (
        <>
            <DeleteConfirmationDialog
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={handleConfirmDelete}
                type="scene"
                assetName={asset.name}
            />

            <AssetDetailLayout
                resizableState={mainLayoutResizable}
                onResizeHandleDoubleClick={handleResizeHandleDoubleClick}
                visualContent={
                    <div ref={theatreTimelineContainerRef} className="scene-detail-visual-wrapper">

                        {/* Theatre Surface */}
                        <div
                            className="scene-detail-theatre-container"
                            style={{ flex: `1 1 ${theatreRatio * 100}%` }}
                        >
                            <ImageViewer
                                style={{ flex: 1 }}
                                scene={asset.config}
                                sceneName={asset.name}
                                userId={userId}
                                currentTime={currentTime}
                                onTimeUpdate={(t) => setCurrentTime(t >= SCENE_DURATION ? 0 : t)}
                                onTelemetry={handleTelemetry}
                                debugMode={debugOverlayMode}
                                isPlaying={isPlaying}
                                onPlayPause={() => setIsPlaying(!isPlaying)}
                                layerVisibility={layerVisibility}
                                onToggleVisibility={toggleLayerVisibility}
                                assetBaseUrl={ASSET_BASE + '/assets'}
                                isOptimizing={isOptimizing}
                                isExpanded={isExpanded}
                                toggleExpand={toggleExpand}
                                onSaveRotation={handleSpriteRotationChanged}
                                onSpriteRotationChanged={handleSpriteRotationChanged}
                                onSavePosition={handleSpritePositionChanged}
                                onSpriteSelected={handleSpriteSelectedWithTimelineSync}
                                onAddSpriteRequested={() => setShowSpriteLibrary(true)}
                                hasChanges={hasUnsavedChanges}
                                activeSprite={selectedImage !== 'original' ? selectedImage : null}
                                isSpriteVisible={layerVisibility[selectedImage] !== false}
                                onToggleSpriteVisibility={selectedImage !== 'original' ? () => {
                                    toggleLayerVisibility(selectedImage);
                                    setHasUnsavedChanges(true);
                                } : undefined}
                                onDeleteSprite={selectedImage !== 'original' ? () => {
                                    if (window.confirm(`Are you sure you want to permanently delete sprite "${selectedImage}"?`)) {
                                        handleDeleteSprite(selectedImage);
                                        setHasUnsavedChanges(true);
                                    }
                                } : undefined}
                                onAddBehavior={selectedImage !== 'original' ? () => {
                                    handleTabChange('sprites');
                                } : undefined}
                                onSave={() => {
                                    saveConfig(asset.config, "Saved scene configuration");
                                    setHasUnsavedChanges(false);
                                    toast.success("Changes saved");
                                }}
                                inputContext={inputContext}
                                onTimelineArrow={handleTimelineArrow}
                            />
                        </div>

                        <div
                            className={`resize-handle resize-handle-v ${isTheatreResizing ? 'active' : ''}`}
                            onMouseDown={(e) => startTheatreResize(e, theatreTimelineContainerRef.current)}
                            onDoubleClick={handleTheatreResizeHandleDoubleClick}
                            title="Drag to resize theatre vs timeline (Double-click to toggle)"
                        />

                        <div
                            className="scene-detail-timeline-wrapper"
                            style={{ flex: `1 1 ${(1 - theatreRatio) * 100}%` }}
                            onMouseEnter={() => setInputContext('timeline')}
                            onMouseLeave={() => setInputContext('vis')}
                        >
                            <TimelineEditor
                                duration={SCENE_DURATION}
                                currentTime={currentTime}
                                layers={asset.config?.layers || []}
                                selectedLayer={selectedImage}
                                selectedKeyframe={selectedKeyframe}
                                onTimeChange={setCurrentTime}
                                layerVisibility={layerVisibility}
                                onLayerUpdate={handleLayerUpdate}
                                onKeyframeMove={handleKeyframeMove}
                                onKeyframeDelete={handleKeyframeDelete}
                                onSelectLayer={handleSpriteSelectedWithTimelineSync}
                                onKeyframeSelect={handleKeyframeSelect}
                                assetBaseUrl={ASSET_BASE + '/assets'}
                                onPlayPause={() => setIsPlaying(!isPlaying)}
                                isPlaying={isPlaying}
                                forceScrollToSelection={forceScrollCounter}
                                onAddSpriteRequested={() => setShowSpriteLibrary(true)}
                                onHeaderDoubleClick={handleTheatreResizeHandleDoubleClick}
                            />
                        </div>
                    </div>
                }
                configContent={
                    <div className="scene-detail-config-wrapper">
                        {!isExpanded && (
                            <div className="scene-detail-visualize-section">
                                <div className="ai-prompt-container">
                                    <div className="relative flex gap-2 items-center">
                                        <input
                                            type="text"
                                            className={`input input-ghost flex-1 h-9 ${isOptimizing ? 'pr-10' : ''}`}
                                            placeholder="e.g., 'Make the trees sway gently...' (Enter to apply)"
                                            value={visualPrompt}
                                            onChange={e => setVisualPrompt(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !isOptimizing && visualPrompt.trim()) {
                                                    handleOptimize();
                                                }
                                            }}
                                            title="Visualize changes with AI. Press Enter to apply."
                                            disabled={isOptimizing}
                                        />
                                        {isOptimizing && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                                                <Icon name="optimize" className="animate-spin" size={18} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="tab-container tab-container-flush">
                            <Button
                                variant="ghost"
                                isTab
                                active={activeTab === 'sprites'}
                                onClick={() => handleTabChange('sprites')}
                            >
                                Sprites
                            </Button>
                            <Button
                                variant="ghost"
                                isTab
                                active={activeTab === 'json'}
                                onClick={() => handleTabChange('json')}
                            >
                                Config
                            </Button>
                        </div>

                        <div className="scene-detail-tab-content-wrapper">
                            {activeTab === 'sprites' && (
                                <div className="scene-detail-sprite-list-container">
                                    <SpriteListEditor
                                        type="scene"
                                        asset={asset}
                                        selectedSprite={selectedImage}
                                        selectedSprites={selectedSprites}
                                        selectedBehaviorIndex={selectedKeyframe?.spriteName === selectedImage ? selectedKeyframe.behaviorIndex : null}
                                        onSpriteSelected={handleSpriteSelectedWithTimelineSync}
                                        onOpenSprite={onOpenSprite}
                                        onBehaviorSelect={handleBehaviorSelect}
                                        layerVisibility={layerVisibility}
                                        onToggleVisibility={toggleLayerVisibility}
                                        onDeleteSprite={handleDeleteSprite}
                                        onBehaviorsChange={handleEventsChange}
                                        behaviorGuidance={behaviorGuidance}
                                        currentTime={currentTime}
                                        telemetry={telemetry}
                                        showTelemetry={detailsMode === 'on'}
                                        onHeaderDoubleClick={handleResizeHandleDoubleClick}
                                        onLayerUpdate={handleLayerUpdate}
                                    />
                                    {selectedSprites?.length > 0 && (
                                        <div className="flex flex-col border-t border-muted bg-surface-alt p-1">
                                            <Button
                                                variant={selectedSprites?.length > 1 ? 'primary' : 'secondary'}
                                                size="sm"
                                                isBlock
                                                onClick={handleClearSelection}
                                                title={selectedSprites?.length > 1 ? "Lock in the current selection order and clear selection" : ""}
                                                icon={selectedSprites.length > 1 ? "check" : "close"}
                                            >
                                                {selectedSprites.length > 1 ? 'Set Order' : 'Clear Selection'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'json' && (
                                <div className="scene-detail-config-scroll-area">
                                    <div className="ai-prompt-container mb-4">
                                        <div className="relative flex gap-2 items-center">
                                            <input
                                                type="text"
                                                className={`input input-ghost flex-1 h-9 ${isOptimizing ? 'pr-10' : ''}`}
                                                placeholder="Describe changes to metadata/physics... (Enter to apply)"
                                                value={configPrompt}
                                                onChange={e => setConfigPrompt(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !isOptimizing && configPrompt.trim()) {
                                                        handleUpdateConfig();
                                                    }
                                                }}
                                                title="Refine Configuration. Press Enter to apply."
                                                disabled={isOptimizing}
                                            />
                                            {isOptimizing && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                                                    <Icon name="optimize" className="animate-spin" size={18} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <SmartConfigViewer configData={configData} selectedImage={selectedImage} type="scene" scrollContainerRef={configScrollRef} />
                                </div>
                            )}
                        </div>

                        {/* Footer: Debug Controls */}
                        <div className="flex flex-col border-t border-muted bg-surface">
                            <div
                                className="flex items-center justify-between px-2 py-1 text-xxs font-semibold uppercase tracking-wider text-subtle cursor-pointer hover:bg-surface-hover transition-colors"
                                onClick={() => setDetailsMode(prev => prev === 'on' ? 'off' : 'on')}
                                title="Click to toggle details"
                            >
                                <span>Details</span>
                                <div className="flex gap-1 items-center">
                                    {['on', 'off'].map(mode => (
                                        <Button
                                            key={mode}
                                            variant={detailsMode === mode ? 'primary' : 'ghost'}
                                            size="xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailsMode(prev => (prev === mode && mode === 'on' ? 'off' : mode));
                                            }}
                                            title={`Toggle details columns ${mode}`}
                                            className="capitalize"
                                        >
                                            {mode}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div
                                className="flex items-center justify-between px-2 py-1 text-xxs font-semibold uppercase tracking-wider text-subtle cursor-pointer hover:bg-surface-hover transition-colors"
                                onClick={() => setDebugOverlayMode(prev => prev === 'on' ? 'off' : 'on')}
                                title="Click to toggle overlay"
                            >
                                <span>Overlay</span>
                                <div className="flex gap-1 items-center">
                                    {['on', 'off'].map(mode => (
                                        <Button
                                            key={mode}
                                            variant={debugOverlayMode === mode ? 'primary' : 'ghost'}
                                            size="xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDebugOverlayMode(prev => (prev === mode && mode === 'on' ? 'off' : mode));
                                            }}
                                            title={mode}
                                            className="capitalize"
                                        >
                                            {mode}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                }
            />
        </>
    );
};
