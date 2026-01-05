import { useEffect, useRef, useState } from 'react';
import { Theatre } from '../engine/Theatre';
import { Icon } from './Icon';
import { createLogger } from '../utils/logger';

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
    isExpanded,
    toggleExpand,
    isCommunity = false, // New prop
    // New Props for Unified Toolbar
    isSpriteVisible,
    onToggleSpriteVisibility,
    onDeleteSprite,
    onAddBehavior,
    onSave,
    hasChanges
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
    const isPausedRef = useRef(isPaused);

    // Dynamic Asset Base URL resolution
    const resolvedAssetBaseUrl = assetBaseUrl ||
        (window.API_BASE ? window.API_BASE.replace('/api', '/assets') :
            `${window.location.protocol}//${window.location.hostname}:8000/assets`);

    // Unified Camera State for atomic updates (prevents zoom/pan desync during wheel)
    const [camera, setCamera] = useState({ zoom: 1.0, pan: { x: 0, y: 0 } });
    const zoom = camera.zoom;
    const pan = camera.pan;

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Safety: Reset State if NaN (Fixes Blank Screen Issue)
    useEffect(() => {
        if (isNaN(camera.zoom) || isNaN(camera.pan.x) || isNaN(camera.pan.y) || !Number.isFinite(camera.zoom)) {
            log.error('Camera state corruption detected. Resetting.');
            setCamera({ zoom: 1.0, pan: { x: 0, y: 0 } });
        }
    }, [camera]);

    // Sync camera to engine
    useEffect(() => {
        if (theatreRef.current) {
            theatreRef.current.cameraZoom = zoom;
            theatreRef.current.cameraPanX = pan.x;
            theatreRef.current.cameraPanY = pan.y;
        }
    }, [zoom, pan]);

    // Sync debugMode
    useEffect(() => {
        if (theatreRef.current) {
            theatreRef.current.debugMode = debugMode;
        }
    }, [debugMode]);

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
        const theatre = new Theatre(canvasRef.current, scene, sceneName, resolvedAssetBaseUrl, userType);
        theatre.onTelemetry = onTelemetry;
        theatre.debugMode = debugMode;
        theatreRef.current = theatre;

        // Wire up interaction callbacks (initial)
        theatre.onSpriteSelected = onSpriteSelected;
        theatre.onSpritePositionChanged = onSpritePositionChanged;
        theatre.onSpriteScaleChanged = onSpriteScaleChanged;
        theatre.onSpriteRotationChanged = onSpriteRotationChanged;
        theatre.onTimeUpdate = onTimeUpdate;

        const init = async () => {
            await theatre.initialize();

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
        };

        init();

        return () => {
            if (theatreRef.current) {
                theatreRef.current.stop();
            }
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

    // Use Ref to avoid re-binding wheel listener on every camera change
    const cameraRef = useRef(camera);
    useEffect(() => {
        cameraRef.current = camera;
    }, [camera]);

    // Re-implemented fully correct version below:
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            log.warn('Canvas ref is null, cannot attach wheel listener');
            return;
        }

        const onWheel = (e) => {
            // Debug Log: Check if event is firing at all
            log.debug(`Raw Wheel: deltaY=${e.deltaY.toFixed(1)}, ctrl=${e.ctrlKey}, meta=${e.metaKey}`);

            if (!theatreRef.current) return;
            e.preventDefault();

            const rect = canvas.getBoundingClientRect();
            // ClientX/Y relative to viewport, minus rect.left = local X
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Use functional update to guarantee 'prev' is the LATEST state
            // This fixes the concurrency/race condition with rapid scrolling
            setCamera(prev => {
                const isZoom = e.ctrlKey || e.metaKey;

                if (isZoom) {
                    // Adaptive Sensitivity:
                    // Trackpads send small deltas (1-10). Mice send large deltas (100+).
                    const absDelta = Math.abs(e.deltaY);
                    const isTrackpad = absDelta > 0 && absDelta < 50;
                    const ZOOM_SENSITIVITY = isTrackpad ? 0.015 : 0.002;

                    // Protect against weird deltas
                    const safeDeltaY = isNaN(e.deltaY) ? 0 : e.deltaY;
                    const scaleFactor = Math.exp(-safeDeltaY * ZOOM_SENSITIVITY);

                    const newZoom = Math.max(0.05, Math.min(20, prev.zoom * scaleFactor));

                    log.debug(`ZOOM (${isTrackpad ? 'Trackpad' : 'Mouse'}) | dY=${safeDeltaY.toFixed(1)} | Target: ${newZoom.toFixed(2)}`);

                    // Safety Check: NaN
                    if (isNaN(newZoom)) {
                        log.error('Calculated NaN zoom:', prev.zoom, scaleFactor);
                        return prev;
                    }

                    // Helper to get world pos from screen pos
                    // Must calc strictly on 'prev' state
                    const worldX = (mouseX - rect.width / 2) / prev.zoom - prev.pan.x + rect.width / 2;
                    const worldY = (mouseY - rect.height / 2) / prev.zoom - prev.pan.y + rect.height / 2;

                    // Safety Check: World Pos
                    if (isNaN(worldX) || isNaN(worldY)) {
                        log.error('World calc failed', worldX, worldY);
                        return prev;
                    }

                    // Calculate new Pan to keep worldPos under mouse
                    const newPanX = (mouseX - rect.width / 2) / newZoom + rect.width / 2 - worldX;
                    const newPanY = (mouseY - rect.height / 2) / newZoom + rect.height / 2 - worldY;

                    return {
                        zoom: newZoom,
                        pan: { x: newPanX, y: newPanY }
                    };
                } else {
                    // Pan
                    const newPanX = prev.pan.x - e.deltaX / prev.zoom;
                    const newPanY = prev.pan.y - e.deltaY / prev.zoom;

                    if (Math.abs(e.deltaX) > 1 || Math.abs(e.deltaY) > 1) {
                        log.debug(`PAN | dX=${e.deltaX.toFixed(1)} dY=${e.deltaY.toFixed(1)} | Target: (${newPanX.toFixed(1)}, ${newPanY.toFixed(1)})`);
                    }

                    return {
                        ...prev,
                        pan: {
                            x: newPanX,
                            y: newPanY
                        }
                    };
                }
            });
        };

        log.debug('Attaching wheel listener');
        canvas.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            log.debug('Removing wheel listener');
            canvas.removeEventListener('wheel', onWheel);
        };
    }, []); // Empty dependency array ensures listener is bound ONCE

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
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 100, overflow: 'visible', background: '#1a1a1a', ...style }}>
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
            <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(0,0,0,0.6)',
                padding: '6px',
                borderRadius: '8px',
                backdropFilter: 'blur(5px)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {/* Layers Panel Hanging Off Right Side */}
                {showLayersPanel && scene && (() => {
                    const zLevels = [...new Set((scene.layers || []).map(l => l.z_depth || 0))].sort((a, b) => b - a);
                    return (
                        <div style={{
                            position: 'absolute',
                            top: 42, // Align with Layers button
                            left: '100%', // Hang off the right side (Toolbar Width)
                            zIndex: 20,
                            background: 'rgba(0,0,0,0.9)',
                            borderRadius: '0 6px 6px 0',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderLeft: 'none',
                            padding: '4px',
                            minWidth: '40px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            boxShadow: '4px 4px 12px rgba(0,0,0,0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end'
                        }}>
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
                                            color: allVisible ? 'white' : 'rgba(255,255,255,0.5)',
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
                        className="btn-icon"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isExpanded ? 'var(--color-primary)' : 'white', cursor: 'pointer',
                            padding: '6px'
                        }}
                        title={isExpanded ? "Collapse" : "Maximize (Zen Mode)"}
                    >
                        <Icon name={isExpanded ? "close" : "maximize"} size={16} />
                    </button>
                )}

                <button
                    className="btn-icon"
                    onClick={() => setShowLayersPanel(!showLayersPanel)}
                    style={{
                        background: showLayersPanel ? 'rgba(255,255,255,0.15)' : 'transparent',
                        border: 'none',
                        color: showLayersPanel ? 'var(--color-primary)' : 'white',
                        cursor: 'pointer',
                        padding: '6px'
                    }}
                    title="Toggle Layers Panel"
                >
                    <Icon name="background" size={16} />
                </button>

                <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)', margin: '4px 0' }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        className="btn-icon"
                        style={{
                            background: 'transparent',
                            color: (!isPaused && !soloSprite) ? 'var(--color-success)' : 'white', padding: '6px'
                        }}
                        onClick={() => {
                            if (theatreRef.current) {
                                if (theatreRef.current.soloSprite) {
                                    // Switch from solo to all
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
                            setCamera(prev => ({ ...prev, zoom: Math.min(20, prev.zoom * 1.2) }));
                        }}
                        title="Zoom In"
                        style={{ background: 'transparent', color: 'white', padding: '6px' }}
                    >
                        <Icon name="zoomIn" size={16} />
                    </button>
                    <button
                        className="btn-icon"
                        onClick={() => {
                            log.debug('Button Zoom Out');
                            setCamera(prev => ({ ...prev, zoom: Math.max(0.05, prev.zoom / 1.2) }));
                        }}
                        title="Zoom Out"
                        style={{ background: 'transparent', color: 'white', padding: '6px' }}
                    >
                        <Icon name="zoomOut" size={16} />
                    </button>
                    <button
                        className="btn-icon"
                        onClick={() => setCamera({ zoom: 1.0, pan: { x: 0, y: 0 } })}
                        title="Reset View"
                        disabled={zoom === 1.0 && pan.x === 0 && pan.y === 0}
                        style={{
                            background: 'transparent',
                            color: 'white',
                            padding: '6px',
                            opacity: (zoom === 1.0 && pan.x === 0 && pan.y === 0) ? 0.3 : 1,
                            cursor: (zoom === 1.0 && pan.x === 0 && pan.y === 0) ? 'default' : 'pointer'
                        }}
                    >
                        <Icon name="revert" size={16} />
                    </button>
                </div>
            </div>

            {/* Bottom Right Unified Toolbar */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                {selectedSprite && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(0,0,0,0.6)',
                        padding: '6px 8px',
                        borderRadius: '24px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(5px)'
                    }}>
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
                            className="btn-icon"
                            title={(soloSprite === selectedSprite && !isPaused) ? "Pause Sprite" : "Play Sprite"}
                            style={{
                                color: (soloSprite === selectedSprite && !isPaused) ? 'white' : 'white',
                                padding: '4px',
                                background: 'transparent'
                            }}
                        >
                            <Icon name={(soloSprite === selectedSprite && !isPaused) ? "pause" : "play"} size={18} />
                        </button>

                        {/* Add Behavior - Moved Next to Play */}
                        {onAddBehavior && (
                            <button
                                onClick={onAddBehavior}
                                className="btn-icon"
                                title="Add Behavior"
                                style={{ color: 'white', padding: '4px' }}
                            >
                                <Icon name="add" size={18} />
                            </button>
                        )}

                        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

                        {/* Rotation */}
                        {onSpriteRotationChanged && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Icon name="rotate" size={16} style={{ opacity: 0.8, color: 'white' }} />
                                <input
                                    type="range"
                                    min="-180"
                                    max="180"
                                    value={(() => {
                                        if (!scene) return 0;
                                        const layer = scene.layers.find(l => l.sprite_name === selectedSprite);
                                        if (!layer) return 0;
                                        const loc = (layer.behaviors || []).find(b => b.type === 'location' && b.time_offset === undefined);
                                        return loc?.rotation ?? layer.rotation ?? 0;
                                    })()}
                                    onChange={(e) => onSpriteRotationChanged(selectedSprite, parseFloat(e.target.value))}
                                    style={{ width: '80px', cursor: 'pointer', height: '4px' }}
                                    title="Rotate Sprite"
                                />
                            </div>
                        )}

                        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

                        {/* Toggle Visibility */}
                        {onToggleSpriteVisibility && (
                            <button
                                onClick={onToggleSpriteVisibility}
                                className="btn-icon"
                                title={isSpriteVisible ? "Hide Sprite" : "Show Sprite"}
                                style={{ color: isSpriteVisible ? 'white' : 'rgba(255,255,255,0.5)', padding: '4px' }}
                            >
                                <Icon name={isSpriteVisible ? "visible" : "hidden"} size={18} />
                            </button>
                        )}

                        {/* Crop - Toggle Mode */}
                        <button
                            className="btn-icon"
                            title={isCropMode ? "Exit Crop Mode" : "Crop Sprite"}
                            style={{
                                color: isCropMode ? 'var(--color-primary)' : 'white',
                                padding: '4px',
                                background: isCropMode ? 'rgba(255,255,255,0.1)' : 'transparent',
                                borderRadius: '4px'
                            }}
                            onClick={() => {
                                const newMode = !isCropMode;
                                setIsCropMode(newMode);
                                if (theatreRef.current) theatreRef.current.setCropMode(newMode);
                            }}
                        >
                            <Icon name="crop" size={18} />
                        </button>

                        {/* Delete */}
                        {onDeleteSprite && (
                            <button
                                onClick={onDeleteSprite}
                                className="btn-icon"
                                title="Delete Sprite"
                                style={{ color: 'white', padding: '4px' }}
                            >
                                <Icon name="delete" size={18} />
                            </button>
                        )}

                        {/* Save */}
                        {onSave && (
                            <>
                                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
                                <button
                                    onClick={hasChanges ? onSave : undefined}
                                    className="btn-icon"
                                    title={hasChanges ? "Save Changes" : "No Changes to Save"}
                                    style={{
                                        color: 'var(--color-primary)',
                                        padding: '4px',
                                        filter: hasChanges ? 'none' : 'grayscale(1)',
                                        opacity: hasChanges ? 1 : 0.5,
                                        cursor: hasChanges ? 'pointer' : 'default'
                                    }}
                                >
                                    <Icon name="save" size={18} />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
