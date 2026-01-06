import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from './Icon';

export function TimelineEditor({
    duration = 30,
    currentTime = 0,
    layers = [],
    selectedLayer = null,
    onTimeChange,
    onKeyframeMove,
    onKeyframeDelete,
    onPlayPause,
    onLayerUpdate,
    onSelectLayer,
    isPlaying = false,
    assetBaseUrl = '/assets'
}) {
    const [zoom, setZoom] = useState(20); // pixels per second
    const containerRef = useRef(null);
    const laneRefs = useRef({});
    const [draggingKeyframe, setDraggingKeyframe] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, item, z }

    const HEADER_WIDTH = 200;
    const TRACK_HEIGHT = 48; // Taller tracks for thumbnails
    const PADDING_LEFT = 40; // Negative time buffer

    // Deep Parse Layers to build Lanes
    // Lane = { z: number, items: [] }
    // Item = { 
    //   type: 'base' | 'behavior', 
    //   time: number, 
    //   sprite: object, 
    //   behaviorIndex: number (if behavior),
    //   key: string
    // }
    const { sortedZDepths, lanes } = useMemo(() => {
        const laneMap = {};
        const zSet = new Set();

        layers.forEach(sprite => {
            // 1. Base Z-Depth (Treat as Keyframe at t=0)
            const initialLocation = sprite.behaviors?.find(
                b => b.type === 'location' && b.time_offset === undefined
            );

            // Smart Default: If base has no Z, fallback to first behavior's Z, else 0.
            let rawBaseZ = initialLocation?.z_depth ?? sprite.z_depth;
            if (rawBaseZ === undefined || rawBaseZ === null) {
                // Look ahead for first behavior with valid Z
                const firstZBehavior = sprite.behaviors
                    ?.filter(b => b.type === 'location' && typeof b.time_offset === 'number' && b.z_depth !== undefined)
                    .sort((a, b) => a.time_offset - b.time_offset)[0];

                if (firstZBehavior) {
                    rawBaseZ = firstZBehavior.z_depth;
                }
            }
            const baseZ = Number(rawBaseZ ?? 0);
            zSet.add(baseZ);
            if (!laneMap[baseZ]) laneMap[baseZ] = [];

            laneMap[baseZ].push({
                type: 'base',
                time: 0,
                sprite: sprite,
                key: `${sprite.sprite_name}-base`
            });

            // 2. Behavior Z-Depths
            if (sprite.behaviors) {
                // Must process in time order to track current Z-depth state properly
                // (User: "defaults to the last non-null")
                const sortedBehaviors = sprite.behaviors
                    .map((b, idx) => ({ ...b, _originalIndex: idx }))
                    .filter(b => b.type === 'location' && typeof b.time_offset === 'number')
                    .sort((a, b) => a.time_offset - b.time_offset);

                let currentZ = baseZ;

                // Loop through sorted behaviors to place them on the timeline
                sortedBehaviors.forEach(b => {
                    // Update Z state if explicit
                    if (b.z_depth !== undefined && b.z_depth !== null) {
                        currentZ = Number(b.z_depth);
                    }

                    // Assign to lane of current Z
                    // This ensures "undefined" Z behaviors stay on the lane of the last known Z
                    const z = currentZ;
                    zSet.add(z);
                    if (!laneMap[z]) laneMap[z] = [];

                    laneMap[z].push({
                        type: 'behavior',
                        time: b.time_offset,
                        sprite: sprite,
                        behaviorIndex: b._originalIndex,
                        key: `${sprite.sprite_name}-b${b._originalIndex}`
                    });
                });
            }
        });

        const sortedZ = Array.from(zSet).sort((a, b) => b - a); // Descending
        return { sortedZDepths: sortedZ, lanes: laneMap };
    }, [layers]);

    // Scroll Logic (Smart "Scroll Into View")
    useEffect(() => {
        if (selectedLayer && laneRefs.current) {
            // Find Base Z for the sprite
            const sprite = layers.find(l => l.sprite_name === selectedLayer);
            if (sprite) {
                const z = sprite.z_depth || 0;
                const el = laneRefs.current[z];
                // Only scroll if element exists
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }, [selectedLayer, layers]); // Removing sortedZDepths dependency as refs are stable enough

    const handleMouseDown = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - HEADER_WIDTH - PADDING_LEFT; // Adjust for header AND padding
        const time = Math.max(0, Math.min(duration, x / zoom));
        onTimeChange(time);

        const handleMouseMove = (moveEvent) => {
            const moveRect = rect;
            const moveX = moveEvent.clientX - moveRect.left - HEADER_WIDTH - PADDING_LEFT;
            const newTime = Math.max(0, Math.min(duration, moveX / zoom));
            onTimeChange(newTime);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Generalized Drag Handler (Handles Time X and Lane Y)
    const handleItemDragStart = (e, item, initialZ) => {
        e.stopPropagation();
        const startX = e.clientX;
        const initialTime = item.time;

        // Track what we are dragging
        setDraggingKeyframe({
            id: item.key,
            spriteName: item.sprite.sprite_name,
            behaviorIndex: item.type === 'behavior' ? item.behaviorIndex : null,
            initialX: (item.time * zoom) + PADDING_LEFT
        });

        const handleDragMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const newTimeRaw = initialTime + (dx / zoom);
            // Snap to 0.1s
            const newTime = Math.max(0, Math.min(duration, Math.round(newTimeRaw * 10) / 10));

            // Preview Time Update
            if (item.type === 'behavior') {
                onKeyframeMove && onKeyframeMove(item.sprite.sprite_name, item.behaviorIndex, newTime, false);
            }

            setDraggingKeyframe(prev => ({
                ...prev,
                currentX: (newTime * zoom) + PADDING_LEFT
            }));
        };

        const handleDragUp = (upEvent) => {
            const dx = upEvent.clientX - startX;

            // 1. Calculate New Time
            let newTime = initialTime;
            if (item.type === 'behavior') {
                const newTimeRaw = initialTime + (dx / zoom);
                newTime = Math.max(0, Math.min(duration, Math.round(newTimeRaw * 10) / 10));
            }

            // 2. Calculate New Z-Depth (Vertical Drop)
            let finalZ = initialZ;
            if (containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const relativeY = upEvent.clientY - containerRect.top + containerRef.current.scrollTop;
                const trackIndex = Math.floor(relativeY / TRACK_HEIGHT);
                if (trackIndex >= 0 && trackIndex < sortedZDepths.length) {
                    finalZ = sortedZDepths[trackIndex];
                }
            }

            // 3. Commit Changes
            if (item.type === 'behavior') {
                // Update Time
                onKeyframeMove && onKeyframeMove(item.sprite.sprite_name, item.behaviorIndex, newTime, true);

                // Update Z if changed
                if (finalZ !== initialZ && onLayerUpdate) {
                    onLayerUpdate(item.sprite.sprite_name, {
                        z_depth: finalZ,
                        behaviorIndex: item.behaviorIndex
                    });
                }
            } else {
                // Base Item
                if (finalZ !== initialZ && onLayerUpdate) {
                    onLayerUpdate(item.sprite.sprite_name, { z_depth: finalZ });
                }
            }

            setDraggingKeyframe(null);
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragUp);
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragUp);
    };

    const handleContextMenu = (e, item, z) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            item,
            z
        });
    };

    const closeContextMenu = () => setContextMenu(null);

    useEffect(() => {
        if (contextMenu) {
            window.addEventListener('click', closeContextMenu);
            return () => window.removeEventListener('click', closeContextMenu);
        }
    }, [contextMenu]);

    return (
        <div className="timeline-main">
            {/* Controls Bar */}
            <div className="timeline-toolbar">
                <button
                    className="btn-icon"
                    onClick={onPlayPause}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    style={{ padding: '4px', display: 'flex' }}
                >
                    <Icon name={isPlaying ? "pause" : "play"} />
                </button>
                <span className="timeline-time-info" title={`Current time: ${currentTime.toFixed(2)} seconds`}>
                    {currentTime.toFixed(2)}s / {duration}s
                </span>
                <input
                    type="range"
                    min="0"
                    max={duration}
                    step="0.1"
                    value={currentTime}
                    onChange={e => onTimeChange(parseFloat(e.target.value))}
                    style={{ flex: 1, maxWidth: '200px', cursor: 'pointer' }}
                    title={`Scrub to ${currentTime.toFixed(1)}s`}
                />
                <div style={{ flex: 1 }} />
                <div className="timeline-zoom-controls">
                    <span className="timeline-zoom-label" title="Timeline Zoom">Zoom:</span>
                    <input
                        type="range"
                        min="5"
                        max="100"
                        value={zoom}
                        onChange={e => setZoom(parseInt(e.target.value))}
                        style={{ width: '80px', cursor: 'pointer' }}
                        title={`Zoom: ${zoom}px per second`}
                    />
                </div>
            </div>

            {/* Timeline Content */}
            <div
                data-testid="timeline-tracks"
                className="flex-1 overflow-auto relative"
                ref={containerRef}
            >
                {/* Ruler - Must be at top level of scrolling container for sticky to work */}
                <div
                    data-testid="timeline-ruler"
                    className="sticky top-0 bg-surface z-50 flex crosshair border-b h-6"
                    style={{ minWidth: HEADER_WIDTH + (duration * zoom) + 100 + PADDING_LEFT }}
                    onMouseDown={handleMouseDown}
                >
                    <div className="border-r flex-shrink-0 w-header sticky left-0 bg-surface z-30"></div>
                    <div className="flex-1 relative">
                        {(() => {
                            const textInterval = zoom < 15 ? 5 : zoom < 30 ? 2 : 1;
                            const tickInterval = 1;
                            const ticks = [];
                            for (let sec = 0; sec <= duration; sec += tickInterval) {
                                const showText = sec % textInterval === 0;
                                ticks.push(
                                    <div key={sec} className="absolute" style={{ left: (sec * zoom) + PADDING_LEFT }}>
                                        <div className="absolute top-0 left-0" style={{
                                            height: showText ? '8px' : '4px',
                                            borderLeft: `1px solid ${showText ? 'var(--color-text-muted)' : 'var(--color-border)'}`
                                        }} />
                                        {showText && (
                                            <div className="absolute top-2 left-1 whitespace-nowrap text-subtle text-xxs">
                                                {sec}s
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return ticks;
                        })()}
                    </div>
                </div>

                <div
                    className="min-h-full"
                    style={{
                        minWidth: HEADER_WIDTH + (duration * zoom) + 100 + PADDING_LEFT,
                    }}
                >

                    {/* Fixed Headers Column Background */}
                    <div className="absolute left-0 top-0 bottom-0 bg-surface border-r z-10 w-header" />
                    {sortedZDepths.map((z) => {
                        const items = lanes[z];
                        return (
                            <div
                                key={z}
                                ref={el => laneRefs.current[z] = el}
                                className="border-b-subtle flex relative h-track"
                            >
                                {/* Header */}
                                <div className="timeline-lane-header" style={{ width: HEADER_WIDTH }}>
                                    Layer {z}
                                </div>

                                {/* Track Content */}
                                <div className="flex-1 relative">
                                    {items.map((item) => {
                                        const isDragging = draggingKeyframe && draggingKeyframe.id === item.key;
                                        const isSelected = selectedLayer === item.sprite.sprite_name;

                                        // Image URL
                                        const src = `${assetBaseUrl}/users/default/sprites/${item.sprite.sprite_name}/${item.sprite.sprite_name}.png`;

                                        return (
                                            <div
                                                key={item.key}
                                                className={`timeline-keyframe-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                                                style={{
                                                    left: (isDragging && draggingKeyframe.currentX !== undefined) ? draggingKeyframe.currentX : (item.time * zoom) + PADDING_LEFT,
                                                }}
                                                title={`${item.sprite.sprite_name} (${item.type}) at ${item.time.toFixed(2)}s`}
                                                onMouseDown={(e) => handleItemDragStart(e, item, z)}
                                                onContextMenu={(e) => handleContextMenu(e, item, z)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectLayer && onSelectLayer(item.sprite.sprite_name);
                                                }}
                                            >
                                                <img
                                                    src={src}
                                                    alt={item.sprite.sprite_name}
                                                    className="w-full h-full object-contain"
                                                    draggable={false}
                                                    onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.style.backgroundColor = 'var(--color-text-muted)'; }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Playhead Line - Absolute position spanning full scroll height */}
                <div
                    className="absolute z-15 pointer-events-none"
                    style={{
                        left: HEADER_WIDTH + (currentTime * zoom) + PADDING_LEFT,
                        top: 0,
                        height: `${Math.max(sortedZDepths.length * TRACK_HEIGHT + 24, 200)}px`,
                        width: '2px',
                        background: 'var(--color-text-subtle)'
                    }}
                >
                    {/* Header Triangle */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: '-4px',
                        width: 0,
                        height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '6px solid var(--color-text-subtle)'
                    }} />
                </div>
            </div>

            {/* Context Menu Overlay */}
            {contextMenu && (
                <div
                    className="fixed z-1000 bg-elevated border rounded shadow-lg py-1 min-w-120"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y
                    }}
                >
                    {contextMenu.item.type === 'behavior' && (
                        <button
                            className="btn-ghost w-full text-left p-2 text-sm flex-row items-center gap-sm text-danger"
                            onClick={() => {
                                onKeyframeDelete && onKeyframeDelete(contextMenu.item.sprite.sprite_name, contextMenu.item.behaviorIndex);
                                closeContextMenu();
                            }}
                        >
                            <Icon name="delete" size={14} />
                            Delete Keyframe
                        </button>
                    )}
                    <button
                        className="btn-ghost w-full text-left p-2 text-sm flex-row items-center gap-sm"
                        onClick={() => {
                            onSelectLayer && onSelectLayer(contextMenu.item.sprite.sprite_name);
                            closeContextMenu();
                        }}
                    >
                        <Icon name="edit" size={14} />
                        Focus {contextMenu.item.sprite.sprite_name}
                    </button>
                </div>
            )}
        </div>
    );
}
