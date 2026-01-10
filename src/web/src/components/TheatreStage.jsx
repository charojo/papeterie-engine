import { useEffect, useRef, useState } from 'react';
import { Theatre } from '../engine/Theatre';
import { Icon } from './Icon';
import { createLogger } from '../utils/logger';
import { useCameraController } from '../hooks/useCameraController';
import { useDraggable } from '../hooks/useDraggable';
import { ASSET_BASE } from '../config';

const log = createLogger('TheatreStage');

export function TheatreStage({
    scene,
    sceneName,
    assetBaseUrl,
    style,
    onTelemetry,
    debugMode = false,
    layerVisibility,
    onToggleVisibility,
    onSpriteSelected,
    onSpritePositionChanged,
    onSpriteScaleChanged,
    onSpriteRotationChanged,
    onAddSpriteRequested,
    selectedSprite,
    currentTime,
    onTimeUpdate,
    isPlaying = false,
    isExpanded,
    toggleExpand,
    isCommunity = false, // New prop
    // New Props for Unified Toolbar
    isSpriteVisible,
    onToggleSpriteVisibility,
    onDeleteSprite,
    onAddBehavior,
    onSave,
    hasChanges,
    onPlayPause,
    repo // Asset Repository
}) {
    const canvasRef = useRef(null);
    const theatreRef = useRef(null);
    const containerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isPaused, setIsPaused] = useState(true);
    const [isCropMode, setIsCropMode] = useState(false);
    const [soloSprite, setSoloSprite] = useState(null);
    const [cursorStyle, setCursorStyle] = useState('pointer');
    const [showLayersPanel, setShowLayersPanel] = useState(false);
    const [localRotation, setLocalRotation] = useState(0);
    const isPausedRef = useRef(isPaused);

    // Dynamic Asset Base URL resolution
    const resolvedAssetBaseUrl = assetBaseUrl || (ASSET_BASE + '/assets');

    // Camera Controller - single source of truth
    const {
        zoom, panX, panY, state: _cameraState,
        setZoom, setPan: _setPan, reset: resetCamera, handleWheel: cameraHandleWheel, controller: cameraController
    } = useCameraController(null, sceneName ? `papeterie-camera-${sceneName}` : null); // Don't pass ref, we bind manually below

    // Draggable toolbar positions - SCENE SPECIFIC
    const cameraToolbarRef = useRef(null);
    const spriteToolbarRef = useRef(null);
    const { position: cameraToolbarPos, startDrag: startCameraDrag } = useDraggable(
        `papeterie-toolbar-camera-pos-${sceneName}`,
        null, // null = use default CSS positioning
        { constrainToParent: true }
    );
    const { position: spriteToolbarPos, startDrag: startSpriteDrag } = useDraggable(
        `papeterie-toolbar-sprite-pos-${sceneName}`,
        null,
        { constrainToParent: true }
    );

    // Derive pan object for compatibility
    const pan = { x: panX, y: panY };

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Sync isPlaying prop with local isPaused and Theatre engine
    useEffect(() => {
        const shouldBePaused = !isPlaying;
        if (isPaused !== shouldBePaused) {
            setIsPaused(shouldBePaused);
            if (theatreRef.current) {
                if (shouldBePaused) theatreRef.current.pause();
                else theatreRef.current.resume();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    // Sync debugMode - Convert mode string to boolean
    // 'on' -> always show, 'off' -> never show, 'auto' -> show only when sprite selected
    useEffect(() => {
        if (theatreRef.current) {
            let effectiveDebugMode = false;
            if (debugMode === 'on' || debugMode === true) {
                effectiveDebugMode = true;
            } else if (debugMode === 'auto') {
                effectiveDebugMode = !!selectedSprite;
            }
            // 'off' or false -> effectiveDebugMode remains false
            theatreRef.current.debugMode = effectiveDebugMode;
        }
    }, [debugMode, selectedSprite]);

    // Sync Layer Visibility
    useEffect(() => {
        if (theatreRef.current && layerVisibility) {
            Object.entries(layerVisibility).forEach(([name, visible]) => {
                theatreRef.current.setLayerVisibility(name, visible);
            });
        }
    }, [layerVisibility]);

    // Sync selected sprite
    useEffect(() => {
        if (theatreRef.current) {
            theatreRef.current.selectSprite(selectedSprite, true);
        }
    }, [selectedSprite]);

    // Sync time (seek)
    useEffect(() => {
        if (theatreRef.current && currentTime !== undefined && Math.abs(theatreRef.current.elapsedTime - currentTime) > 0.1) {
            theatreRef.current.setTime(currentTime);
        }
    }, [currentTime]);

    // Separated cleanup/init to avoid reloading images on every prop change
    useEffect(() => {
        if (!canvasRef.current) return;

        // Cleanup previous instance
        if (theatreRef.current) {
            theatreRef.current.stop();
        }

        const userType = isCommunity ? 'community' : 'default';
        const theatre = new Theatre(canvasRef.current, scene, sceneName, resolvedAssetBaseUrl, userType, repo);
        theatre.onTelemetry = onTelemetry;
        // Initial debugMode: Convert mode string to boolean (same logic as sync effect)
        theatre.debugMode = debugMode === 'on' || debugMode === true || (debugMode === 'auto' && !!selectedSprite);
        theatreRef.current = theatre;

        // CRITICAL: Explicitly bind camera controller to the new Theatre instance
        if (cameraController) {
            log.debug(`Binding CameraController to new Theatre instance: ${sceneName}`);
            cameraController.bindTheatre(theatre);
        }

        // Wire up interaction callbacks (initial)
        theatre.onSpriteSelected = onSpriteSelected;
        theatre.onSpritePositionChanged = onSpritePositionChanged;
        theatre.onSpriteScaleChanged = onSpriteScaleChanged;
        theatre.onSpriteRotationChanged = onSpriteRotationChanged;
        theatre.onTimeUpdate = onTimeUpdate;

        // Track if this effect has been cleaned up (for async race condition prevention)
        let cancelled = false;

        const init = async () => {
            await theatre.initialize();

            // CRITICAL: Check if cleanup has already run before starting
            if (cancelled) {
                log.debug(`[${sceneName}] Init completed but effect was already cleaned up - not starting`);
                return;
            }

            // Apply initial state
            theatre.cameraZoom = zoom;
            theatre.cameraPanX = pan.x;
            theatre.cameraPanY = pan.y;
            theatre.selectSprite(selectedSprite, true);

            if (layerVisibility) {
                Object.entries(layerVisibility).forEach(([name, visible]) => {
                    theatre.setLayerVisibility(name, visible);
                });
            }

            if (isPausedRef.current) {
                theatre.pause();
            }
            theatre.start();

            // CRITICAL: Zoom Fix - Attach wheel listener here to ensure it binds to the correct canvas
            // and re-attaches if the scene name or other structural props change.
            const onWheel = (e) => {
                cameraHandleWheel(e, theatre.canvas);
            };
            theatre.canvas.addEventListener('wheel', onWheel, { passive: false });
            theatre._cleanupWheel = () => theatre.canvas.removeEventListener('wheel', onWheel);
        };

        init();

        // CRITICAL FIX: Capture the theatre instance in a closure for proper cleanup.
        // Previously, the cleanup function read theatreRef.current, but by the time cleanup runs,
        // theatreRef.current has already been reassigned to the NEW theatre instance.
        // This caused the cleanup to clean up the wrong instance's wheel listener.
        const theatreToCleanup = theatre;
        return () => {
            cancelled = true; // Prevent async init from starting the loop
            log.debug(`[${sceneName}] Cleaning up Theatre instance`);
            theatreToCleanup._cleanupWheel?.();
            theatreToCleanup.stop();
        };
        // Dependency list reduced to structural changes only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneName, assetBaseUrl, isCommunity]);

    // Handle Scene Data Updates (Prop changes) without reloading
    useEffect(() => {
        if (theatreRef.current && scene) {
            theatreRef.current.updateScene(scene);
            // Re-apply visibility as updateScene might have re-created layers
            if (layerVisibility) {
                Object.entries(layerVisibility).forEach(([name, visible]) => {
                    theatreRef.current.setLayerVisibility(name, visible);
                });
            }
        }
    }, [scene, layerVisibility]);

    // Keep callbacks fresh
    useEffect(() => {
        if (theatreRef.current) {
            theatreRef.current.onSpriteSelected = onSpriteSelected;
            theatreRef.current.onSpritePositionChanged = onSpritePositionChanged;
            theatreRef.current.onSpriteScaleChanged = onSpriteScaleChanged;
            theatreRef.current.onSpriteRotationChanged = onSpriteRotationChanged;
            theatreRef.current.onTimeUpdate = onTimeUpdate;
        }
    }, [onSpriteSelected, onSpritePositionChanged, onSpriteScaleChanged, onSpriteRotationChanged, onTimeUpdate]);

    // Sync local rotation when sprite selection or scene changes
    useEffect(() => {
        if (!selectedSprite || !scene) {
            setLocalRotation(0);
            return;
        }
        const layer = scene.layers.find(l => l.sprite_name === selectedSprite);
        if (layer) {
            const loc = (layer.behaviors || []).find(b => b.type === 'location' && b.time_offset === undefined);
            const rotation = loc?.rotation ?? layer.rotation ?? 0;
            setLocalRotation(rotation);
        }
    }, [selectedSprite, scene]);

    const updateTheatreRotation = (deg) => {
        if (theatreRef.current && selectedSprite) {
            const layer = theatreRef.current.layersByName.get(selectedSprite);
            if (layer) {
                layer.setRotation(deg, currentTime || 0);
            }
        }
    };


    // Resize Observer Logic(Static)
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = width;
                canvasRef.current.height = height;
            }
        };
        handleResize();
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const handleMouseDown = (e) => {
        if (!theatreRef.current) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Shift-Click to add sprite (always works)
        if (e.shiftKey && onAddSpriteRequested) {
            onAddSpriteRequested();
            return;
        }

        // Try to drag (handles or body)
        if (theatreRef.current.handleDragStart(x, y)) {
            setIsDragging(true);
            // Update cursor based on what we're dragging
            const handle = theatreRef.current.activeHandle;
            if (handle) {
                if (handle.type === 'rotate') setCursorStyle('crosshair');
                else if (handle.type === 'scale') {
                    // Use the same logic as mousemove to determine specific scale cursor
                    if (handle.id === 'tl' || handle.id === 'br') setCursorStyle('nwse-resize');
                    else if (handle.id === 'tr' || handle.id === 'bl') setCursorStyle('nesw-resize');
                    else if (handle.id === 'mt' || handle.id === 'mb') setCursorStyle('ns-resize');
                    else if (handle.id === 'ml' || handle.id === 'mr') setCursorStyle('ew-resize');
                }
            } else {
                setCursorStyle('grabbing');
            }
        } else {
            theatreRef.current.handleCanvasClick(x, y);
        }
    };

    const handleMouseMove = (e) => {
        if (!theatreRef.current) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        theatreRef.current.setMousePosition(x, y);

        if (isDragging) {
            theatreRef.current.handleDragMove(x, y);
        } else {
            // Check for handles
            const handle = theatreRef.current.getHandleAtPoint(x, y); // Changed to use local x, y
            const layer = selectedSprite ? theatreRef.current.layersByName?.get(selectedSprite) : null;
            const isOverSprite = layer?.containsPoint?.(x, y, theatreRef.current.canvas.width, theatreRef.current.canvas.height, theatreRef.current.scroll, theatreRef.current.elapsedTime);

            if (handle) {
                if (handle.type === 'rotate') setCursorStyle('crosshair');
                else if (handle.type === 'scale') {
                    if (handle.id === 'tl' || handle.id === 'br') setCursorStyle('nwse-resize');
                    else if (handle.id === 'tr' || handle.id === 'bl') setCursorStyle('nesw-resize');
                    else if (handle.id === 'mt' || handle.id === 'mb') setCursorStyle('ns-resize');
                    else if (handle.id === 'ml' || handle.id === 'mr') setCursorStyle('ew-resize');
                }
            } else if (isOverSprite) {
                setCursorStyle('grab');
            } else {
                setCursorStyle('default');
            }
        }
    };

    const handleMouseUp = () => {
        if (!theatreRef.current) return;
        if (isDragging) {
            theatreRef.current.handleDragEnd();
            setIsDragging(false);
            setCursorStyle('pointer');
        }
    };

    // handleWheel moved to native listener effect

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 250, overflow: 'visible', background: 'var(--color-bg-base)', ...style }}>
            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: cursorStyle }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            // onWheel handled by native listener
            />



            {/* Top Right Controls: Zen Mode & Camera */}
            <div
                ref={cameraToolbarRef}
                className="theatre-toolbar theatre-toolbar-vertical"
                style={{
                    position: 'absolute',
                    // Use custom position if set, otherwise default to top-right
                    top: cameraToolbarPos ? cameraToolbarPos.y : 12,
                    left: cameraToolbarPos ? cameraToolbarPos.x : undefined,
                    right: cameraToolbarPos ? undefined : 12,
                    zIndex: 10
                }}
            >
                {/* Drag Handle */}
                <div
                    className="toolbar-drag-handle"
                    onMouseDown={(e) => startCameraDrag(e, cameraToolbarRef.current, containerRef.current)}
                    title="Drag to move toolbar"
                />
                {/* Layers Panel Hanging Off Right Side */}
                {showLayersPanel && scene && (() => {
                    const zLevels = [...new Set((scene.layers || []).map(l => l.z_depth || 0))].sort((a, b) => b - a);
                    return (
                        <div
                            className="theatre-layers-panel"
                            style={{
                                position: 'absolute',
                                top: 42,
                                left: '100%',
                                zIndex: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end'
                            }}
                        >
                            {zLevels.map(z => {
                                const layersAtZ = (scene.layers || []).filter(l => (l.z_depth || 0) === z);
                                const allVisible = layersAtZ.every(l =>
                                    layerVisibility ? (layerVisibility[l.sprite_name] !== false) : true
                                );
                                return (
                                    <div
                                        key={z}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 8px 4px 4px',
                                            cursor: 'pointer',
                                            justifyContent: 'flex-end',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={() => {
                                            if (onToggleVisibility) {
                                                const targetState = !allVisible;
                                                layersAtZ.forEach(l => {
                                                    const isVisible = layerVisibility ? (layerVisibility[l.sprite_name] !== false) : true;
                                                    if (isVisible !== targetState) {
                                                        onToggleVisibility(l.sprite_name);
                                                    }
                                                });
                                            }
                                        }}
                                        title={`Z-Level ${z}: ${layersAtZ.map(l => l.sprite_name).join(', ')}`}
                                    >
                                        <span style={{
                                            color: allVisible ? 'white' : 'var(--color-text-muted)',
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            fontWeight: 'bold',
                                        }}>
                                            {z}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={allVisible}
                                            onChange={() => { }}
                                            style={{ margin: 0, cursor: 'pointer', width: '12px', height: '12px', opacity: allVisible ? 1 : 0.5 }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
                {toggleExpand && (
                    <button
                        onClick={toggleExpand}
                        className={`btn-icon ${isExpanded ? 'active' : ''}`}
                        title={isExpanded ? "Collapse" : "Maximize (Zen Mode)"}
                    >
                        <Icon name={isExpanded ? "close" : "maximize"} size={16} />
                    </button>
                )}

                <button
                    className={`btn-icon ${showLayersPanel ? 'active' : ''}`}
                    onClick={() => setShowLayersPanel(!showLayersPanel)}
                    title="Toggle Layers Panel"
                >
                    <Icon name="background" size={16} />
                </button>

                <div className="theatre-toolbar-divider theatre-toolbar-divider-v"></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        className={`btn-icon ${(!isPaused && !soloSprite) ? 'active' : ''}`}
                        onClick={() => {
                            if (onPlayPause) {
                                onPlayPause();
                            } else if (theatreRef.current) {
                                if (theatreRef.current.soloSprite) {
                                    theatreRef.current.soloSprite = null;
                                    setSoloSprite(null);
                                    theatreRef.current.resume();
                                    setIsPaused(false);
                                } else {
                                    theatreRef.current.togglePause();
                                    setIsPaused(theatreRef.current.isPaused);
                                }
                            }
                        }}
                        title="Play All Sprites"
                    >
                        <Icon name={(!isPaused && !soloSprite) ? "pause" : "play"} size={16} />
                    </button>

                    <button
                        className="btn-icon"
                        onClick={() => {
                            log.debug('Button Zoom In');
                            setZoom(zoom * 1.2);
                        }}
                        title="Zoom In"
                    >
                        <Icon name="zoomIn" size={16} />
                    </button>
                    <button
                        className="btn-icon"
                        onClick={() => {
                            log.debug('Button Zoom Out');
                            setZoom(zoom / 1.2);
                        }}
                        title="Zoom Out"
                    >
                        <Icon name="zoomOut" size={16} />
                    </button>
                    <button
                        className="btn-icon"
                        onClick={() => resetCamera()}
                        title="Reset View"
                        disabled={zoom === 1.0 && pan.x === 0 && pan.y === 0}
                        style={{
                            opacity: (zoom === 1.0 && pan.x === 0 && pan.y === 0) ? 0.3 : 1,
                            cursor: (zoom === 1.0 && pan.x === 0 && pan.y === 0) ? 'default' : 'pointer'
                        }}
                    >
                        <Icon name="revert" size={16} />
                    </button>
                </div>
            </div>

            {/* Bottom Right Unified Toolbar */}
            <div
                ref={spriteToolbarRef}
                style={{
                    position: 'absolute',
                    // Use custom position if set, otherwise default to bottom-right
                    bottom: spriteToolbarPos ? undefined : 20,
                    top: spriteToolbarPos ? spriteToolbarPos.y : undefined,
                    left: spriteToolbarPos ? spriteToolbarPos.x : undefined,
                    right: spriteToolbarPos ? undefined : 20,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}
            >
                {selectedSprite && (
                    <div className="theatre-toolbar theatre-toolbar-horizontal">
                        {/* Drag Handle */}
                        <div
                            className="toolbar-drag-handle"
                            onMouseDown={(e) => startSpriteDrag(e, spriteToolbarRef.current, containerRef.current)}
                            title="Drag to move toolbar"
                        />
                        {/* Play/Pause Sprite */}
                        <button
                            onClick={() => {
                                if (theatreRef.current) {
                                    if (theatreRef.current.soloSprite === selectedSprite) {
                                        theatreRef.current.togglePause();
                                        setIsPaused(theatreRef.current.isPaused);
                                    } else {
                                        theatreRef.current.soloSprite = selectedSprite;
                                        setSoloSprite(selectedSprite);
                                        theatreRef.current.resume();
                                        setIsPaused(false);
                                    }
                                }
                            }}
                            className={`btn-icon ${(soloSprite === selectedSprite && !isPaused) ? 'active' : ''}`}
                            title={(soloSprite === selectedSprite && !isPaused) ? "Pause Sprite" : "Play Sprite"}
                        >
                            <Icon name={(soloSprite === selectedSprite && !isPaused) ? "pause" : "play"} size={16} />
                        </button>

                        {/* Add Behavior - Moved Next to Play */}
                        {onAddBehavior && (
                            <button
                                onClick={onAddBehavior}
                                className="btn-icon"
                                title="Add Behavior"
                            >
                                <Icon name="add" size={16} />
                            </button>
                        )}

                        <div className="theatre-toolbar-divider theatre-toolbar-divider-h" />

                        {/* Rotation */}
                        {onSpriteRotationChanged && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Icon
                                    name="rotate"
                                    size={16}
                                    className="text-muted cursor-pointer hover:text-white transition-colors"
                                    title="Click to rotate 90°"
                                    onClick={() => {
                                        let nextRot = (localRotation + 90);
                                        if (nextRot > 180) nextRot -= 360;

                                        const layer = scene.layers.find(l => l.sprite_name === selectedSprite);
                                        const loc = (layer?.behaviors || []).find(b => b.type === 'location' && b.time_offset !== undefined && Math.abs(b.time_offset - (currentTime || 0)) < 0.2);
                                        const targetDesc = loc ? `Behavior at ${loc.time_offset}s` : "Base Rotation";

                                        log.debug(`Rotating sprite ${selectedSprite} (${targetDesc}) by 90° to ${nextRot}°`);
                                        setLocalRotation(nextRot);
                                        updateTheatreRotation(nextRot);
                                        onSpriteRotationChanged(selectedSprite, nextRot, currentTime || 0);
                                    }}
                                />
                                <input
                                    type="range"
                                    min="-180"
                                    max="180"
                                    value={localRotation}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setLocalRotation(val);
                                        updateTheatreRotation(val);
                                    }}
                                    onMouseUp={() => {
                                        const layer = scene.layers.find(l => l.sprite_name === selectedSprite);
                                        const loc = (layer?.behaviors || []).find(b => b.type === 'location' && b.time_offset !== undefined && Math.abs(b.time_offset - (currentTime || 0)) < 0.2);
                                        const targetDesc = loc ? `Behavior at ${loc.time_offset}s` : "Base Rotation";

                                        log.debug(`Rotation slider interaction end: ${selectedSprite} (${targetDesc}) at ${localRotation}°`);
                                        onSpriteRotationChanged(selectedSprite, localRotation, currentTime || 0);
                                    }}
                                    onTouchEnd={() => {
                                        log.debug(`Rotation slider interaction (touch) end: ${selectedSprite} at ${localRotation}°`);
                                        onSpriteRotationChanged(selectedSprite, localRotation, currentTime || 0);
                                    }}
                                    onKeyUp={() => {
                                        log.debug(`Rotation slider keyboard interaction end: ${selectedSprite} at ${localRotation}°`);
                                        onSpriteRotationChanged(selectedSprite, localRotation, currentTime || 0);
                                    }}
                                    style={{ width: '80px', cursor: 'pointer', height: '4px' }}
                                    title="Rotate Sprite"
                                />
                            </div>
                        )}

                        <div className="theatre-toolbar-divider theatre-toolbar-divider-h" />

                        {/* Toggle Visibility */}
                        {onToggleSpriteVisibility && (
                            <button
                                onClick={onToggleSpriteVisibility}
                                className="btn-icon"
                                title={isSpriteVisible ? "Hide Sprite" : "Show Sprite"}
                                style={{ opacity: isSpriteVisible ? 1 : 0.5 }}
                            >
                                <Icon name={isSpriteVisible ? "visible" : "hidden"} size={16} />
                            </button>
                        )}

                        {/* Crop - Toggle Mode */}
                        <button
                            className={`btn-icon ${isCropMode ? 'active' : ''}`}
                            title={isCropMode ? "Exit Crop Mode" : "Crop Sprite"}
                            onClick={() => {
                                const newMode = !isCropMode;
                                setIsCropMode(newMode);
                                if (theatreRef.current) theatreRef.current.setCropMode(newMode);
                            }}
                        >
                            <Icon name="crop" size={16} />
                        </button>

                        {/* Delete */}
                        {onDeleteSprite && (
                            <button
                                onClick={onDeleteSprite}
                                className="btn-icon"
                                title="Delete Sprite"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )}

                        {/* Save */}
                        {onSave && (
                            <>
                                <div className="theatre-toolbar-divider theatre-toolbar-divider-h" />
                                <button
                                    onClick={hasChanges ? onSave : undefined}
                                    className="btn-icon"
                                    title={hasChanges ? "Save Changes" : "No Changes to Save"}
                                    style={{
                                        filter: hasChanges ? 'none' : 'grayscale(1)',
                                        opacity: hasChanges ? 1 : 0.5,
                                        cursor: hasChanges ? 'pointer' : 'default'
                                    }}
                                >
                                    <Icon name="save" size={16} />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
