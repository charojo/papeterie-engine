import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { createLogger } from '../utils/logger';

const log = createLogger('TimelineEditor');

export function TimelineEditor({
    duration = 30,
    currentTime = 0,
    layers = [],
    selectedLayer = null,
    selectedKeyframe = null, // { spriteName, behaviorIndex, time } or null
    onTimeChange,
    onKeyframeMove,
    onKeyframeDelete,
    onPlayPause,
    onLayerUpdate,
    onSelectLayer,
    onKeyframeSelect, // (spriteName, behaviorIndex, time) => void
    isPlaying = false,
    assetBaseUrl = '/assets'
}) {
    const [zoom, setZoom] = useState(20); // pixels per second
    const containerRef = useRef(null);
    const laneRefs = useRef({});
    const [draggingKeyframe, setDraggingKeyframe] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, item, z }

    const HEADER_WIDTH = 30;
    const TRACK_HEIGHT = 34; // Condensed tracks
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
            const initialLocationIndex = sprite.behaviors?.findIndex(
                b => b.type === 'location' && (b.time_offset === undefined || b.time_offset === 0)
            ) ?? -1;
            const initialLocation = initialLocationIndex !== -1 ? sprite.behaviors[initialLocationIndex] : null;

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
                behaviorIndex: initialLocationIndex !== -1 ? initialLocationIndex : null,
                key: `${sprite.sprite_name}-base`
            });

            // 2. Behavior Z-Depths
            if (sprite.behaviors) {
                // Must process in time order to track current Z-depth state properly
                const sortedBehaviors = sprite.behaviors
                    .map((b, idx) => ({ ...b, _originalIndex: idx }))
                    .filter(b => typeof b.time_offset === 'number')
                    .sort((a, b) => a.time_offset - b.time_offset);

                let currentZ = baseZ;

                // Loop through sorted behaviors to place them on the timeline
                sortedBehaviors.forEach(b => {
                    // Update Z state if explicit
                    if (b.z_depth !== undefined && b.z_depth !== null) {
                        currentZ = Number(b.z_depth);
                    }

                    // Assign to lane of current Z
                    const z = currentZ;
                    zSet.add(z);
                    if (!laneMap[z]) laneMap[z] = [];

                    const behaviorItem = {
                        type: 'behavior',
                        time: b.time_offset,
                        sprite: sprite,
                        behaviorIndex: b._originalIndex,
                        key: `${sprite.sprite_name}-b${b._originalIndex}`
                    };

                    laneMap[z].push(behaviorItem);
                });
            }
        });

        const sortedZ = Array.from(zSet).sort((a, b) => b - a); // Descending
        return { sortedZDepths: sortedZ, lanes: laneMap };
    }, [layers]);

    // Extract unique time offsets from behaviors for ruler markers
    const behaviorTimeOffsets = useMemo(() => {
        const offsets = new Set();
        Object.values(lanes).forEach(items => {
            items.forEach(item => {
                if (item.type === 'behavior' && item.time > 0) {
                    offsets.add(item.time);
                }
            });
        });
        return Array.from(offsets).sort((a, b) => a - b);
    }, [lanes]);

    // Scroll Logic (Smart "Scroll Into View")
    useEffect(() => {
        if (selectedLayer && laneRefs.current) {
            // Calculate which lane we should scroll to
            // Priority: selectedKeyframe's lane > sprite's base lane
            let targetZ = null;

            if (selectedKeyframe && selectedKeyframe.spriteName === selectedLayer) {
                // Find lane containing this specific keyframe
                for (const [z, items] of Object.entries(lanes)) {
                    const found = items.find(it =>
                        (selectedKeyframe.behaviorIndex === null ? it.type === 'base' : (it.type === 'behavior' && it.behaviorIndex === selectedKeyframe.behaviorIndex)) &&
                        Math.abs(it.time - selectedKeyframe.time) < 0.01
                    );
                    if (found) {
                        targetZ = z;
                        break;
                    }
                }
            }

            if (targetZ === null) {
                const sprite = layers.find(l => l.sprite_name === selectedLayer);
                if (sprite) {
                    targetZ = sprite.z_depth || 0;
                }
            }

            if (targetZ !== null && laneRefs.current[targetZ]) {
                const el = laneRefs.current[targetZ];
                const container = containerRef.current;
                if (el && container) {
                    const elTop = el.offsetTop;
                    const elHeight = el.offsetHeight;
                    const containerScrollTop = container.scrollTop;
                    const containerHeight = container.clientHeight;

                    // Vertical-only scroll into view logic
                    // Accounts for sticky ruler (RULER_HEIGHT = 24)
                    const RULER_HEIGHT = 24;
                    const visibleMin = containerScrollTop + RULER_HEIGHT;
                    const visibleMax = containerScrollTop + containerHeight;

                    if (elTop < visibleMin) {
                        log.debug(`Vertical scroll (Up) for layer ${selectedLayer} at Z ${targetZ}`, { elTop, visibleMin });
                        container.scrollTop = elTop - RULER_HEIGHT;
                    } else if (elTop + elHeight > visibleMax) {
                        log.debug(`Vertical scroll (Down) for layer ${selectedLayer} at Z ${targetZ}`, { elTop, elHeight, visibleMax });
                        container.scrollTop = elTop + elHeight - containerHeight;
                    }
                }
            }
        }
    }, [selectedLayer, selectedKeyframe, layers, lanes]);

    // Auto-scroll to keep playhead in view during scrub
    useEffect(() => {
        if (!isPlaying && containerRef.current) {
            const playheadX = HEADER_WIDTH + (currentTime * zoom) + PADDING_LEFT;
            const container = containerRef.current;
            const scrollLeft = container.scrollLeft;
            const width = container.clientWidth;

            // Visible range relative to the scroll container's left edge
            // We must account for the sticky labels (HEADER_WIDTH)
            const buffer = 100; // Even larger buffer to prevent erratic jumps on selection
            const visibleMin = scrollLeft + HEADER_WIDTH + buffer;
            const visibleMax = scrollLeft + width - buffer;

            // Only scroll if playhead is outside the visible area
            if (playheadX < visibleMin) {
                log.debug('Horizontal scroll (Left) for playhead', { playheadX, visibleMin });
                container.scrollLeft = Math.max(0, playheadX - HEADER_WIDTH - buffer);
            } else if (playheadX > visibleMax) {
                log.debug('Horizontal scroll (Right) for playhead', { playheadX, visibleMax });
                container.scrollLeft = playheadX - width + buffer;
            }
        }
    }, [currentTime, zoom, isPlaying]);

    const handleMouseDown = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - HEADER_WIDTH - PADDING_LEFT; // Adjust for header AND padding
        const time = Math.max(0, Math.min(duration, x / zoom));

        // Pause playback while scrubbing to prevent odd resumption behavior
        if (isPlaying && onPlayPause) {
            onPlayPause();
        }

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
        const startY = e.clientY;
        const initialTime = item.time;

        // Initialize state for dragging
        let dragActivated = false;
        let autoScrollInterval = null;

        const DRAG_THRESHOLD = 5; // pixels
        const SCROLL_EDGE_SIZE = 40; // pixels from edge to trigger scroll
        const SCROLL_SPEED = 5; // pixels per frame
        const RULER_HEIGHT = 24; // Height of the sticky ruler

        const handleDragMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only activate drag if threshold exceeded
            if (!dragActivated && distance < DRAG_THRESHOLD) {
                return;
            }

            // Activate drag mode (use local variable, not state)
            if (!dragActivated) {
                dragActivated = true;
                log.info('Drag started', {
                    item: item.key,
                    type: item.type,
                    initialZ,
                    initialTime
                });
                setDraggingKeyframe({
                    id: item.key,
                    spriteName: item.sprite.sprite_name,
                    behaviorIndex: item.type === 'behavior' ? item.behaviorIndex : null,
                    initialX: (item.time * zoom) + PADDING_LEFT - 14.5
                });
            }

            const newTimeRaw = initialTime + (dx / zoom);
            // Snap to 0.1s
            const newTime = Math.max(0, Math.min(duration, Math.round(newTimeRaw * 10) / 10));

            // Preview Time Update
            if (item.type === 'behavior') {
                onKeyframeMove && onKeyframeMove(item.sprite.sprite_name, item.behaviorIndex, newTime, false);
            }

            setDraggingKeyframe(prev => ({
                ...prev,
                currentX: (newTime * zoom) + PADDING_LEFT - 14.5
            }));

            // Auto-scroll when near edges
            if (containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const relativeY = moveEvent.clientY - containerRect.top;

                // Clear any existing scroll interval
                if (autoScrollInterval) {
                    clearInterval(autoScrollInterval);
                    autoScrollInterval = null;
                }

                // Check if near top edge (below ruler)
                if (relativeY < RULER_HEIGHT + SCROLL_EDGE_SIZE && relativeY > RULER_HEIGHT) {
                    autoScrollInterval = setInterval(() => {
                        if (containerRef.current) {
                            log.debug('Drag auto-scroll (Up)', { relativeY });
                            containerRef.current.scrollTop = Math.max(0, containerRef.current.scrollTop - SCROLL_SPEED);
                        }
                    }, 16);
                }
                // Check if near bottom edge
                else if (relativeY > containerRect.height - SCROLL_EDGE_SIZE) {
                    autoScrollInterval = setInterval(() => {
                        if (containerRef.current) {
                            log.debug('Drag auto-scroll (Down)', { relativeY });
                            containerRef.current.scrollTop += SCROLL_SPEED;
                        }
                    }, 16);
                }
            }
        };

        const handleDragUp = (upEvent) => {
            // Clear auto-scroll interval
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }

            const dx = upEvent.clientX - startX;
            const dy = upEvent.clientY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If drag threshold not met, treat as click
            if (!dragActivated && distance < DRAG_THRESHOLD) {
                setDraggingKeyframe(null);
                document.removeEventListener('mousemove', handleDragMove);
                document.removeEventListener('mouseup', handleDragUp);
                return;
            }

            log.info('Drag end', { dx, dy, dragActivated });

            // 1. Calculate New Time
            const newTimeRaw = initialTime + (dx / zoom);
            const newTime = Math.max(0, Math.min(duration, Math.round(newTimeRaw * 10) / 10));

            // 2. Calculate New Z-Depth (Vertical Drop with Lane Insertion)
            let finalZ = initialZ;
            if (containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const scrollTop = containerRef.current.scrollTop;
                // Account for ruler height when calculating Y position relative to tracks
                const relativeY = upEvent.clientY - containerRect.top + scrollTop - RULER_HEIGHT;
                const trackIndex = Math.floor(relativeY / TRACK_HEIGHT);

                log.debug('Z Calculation:', {
                    clientY: upEvent.clientY,
                    containerTop: containerRect.top,
                    scrollTop,
                    rulerHeight: RULER_HEIGHT,
                    relativeY,
                    trackHeight: TRACK_HEIGHT,
                    trackIndex,
                    sortedZDepths,
                    targetZ: sortedZDepths[trackIndex]
                });

                // Check if drop is in the gap between lanes (top 25% or bottom 25% of track)
                const trackOffset = relativeY % TRACK_HEIGHT;
                const isInTopGap = trackOffset < TRACK_HEIGHT * 0.25;
                const isInBottomGap = trackOffset > TRACK_HEIGHT * 0.75;

                log.debug('Gap Detection:', { trackOffset, isInTopGap, isInBottomGap });

                if ((isInTopGap || isInBottomGap) && trackIndex >= 0 && trackIndex < sortedZDepths.length) {
                    // Determine which gap we're in
                    let upperIndex, lowerIndex;
                    if (isInTopGap && trackIndex > 0) {
                        // Top gap: between current and previous track
                        upperIndex = trackIndex - 1;
                        lowerIndex = trackIndex;
                    } else if (isInBottomGap && trackIndex < sortedZDepths.length - 1) {
                        // Bottom gap: between current and next track
                        upperIndex = trackIndex;
                        lowerIndex = trackIndex + 1;
                    }

                    // Create new lane with midpoint Z
                    if (upperIndex !== undefined && lowerIndex !== undefined) {
                        const upperZ = sortedZDepths[upperIndex];
                        const lowerZ = sortedZDepths[lowerIndex];
                        finalZ = (upperZ + lowerZ) / 2;
                        log.info('Creating midpoint Z:', { upperZ, lowerZ, finalZ });
                    } else {
                        // Snap to nearest lane
                        finalZ = sortedZDepths[trackIndex];
                        log.debug('Snapping to lane (no midpoint):', { finalZ });
                    }
                } else if (trackIndex >= 0 && trackIndex < sortedZDepths.length) {
                    // Snap to existing lane
                    finalZ = sortedZDepths[trackIndex];
                    log.debug('Snapping to existing lane:', { trackIndex, finalZ });
                } else {
                    log.warn('Track index out of bounds:', { trackIndex, numLanes: sortedZDepths.length });
                }
            }

            log.info('Final Result:', {
                itemType: item.type,
                spriteName: item.sprite.sprite_name,
                initialZ,
                finalZ,
                zChanged: finalZ !== initialZ,
                initialTime,
                newTime
            });

            // 3. Commit Changes
            if (item.type === 'behavior' || (item.type === 'base' && item.behaviorIndex !== null)) {
                // Update Time if changed (or always if calling onKeyframeMove)
                if (newTime !== initialTime) {
                    log.info(`Moving keyframe for ${item.type}`, {
                        spriteName: item.sprite.sprite_name,
                        newTime
                    });
                    onKeyframeMove && onKeyframeMove(item.sprite.sprite_name, item.behaviorIndex, newTime, true);
                }

                // Update Z if changed
                if (finalZ !== initialZ && onLayerUpdate) {
                    log.info('Updating Z-depth for keyframe', {
                        spriteName: item.sprite.sprite_name,
                        z_depth: finalZ
                    });
                    onLayerUpdate(item.sprite.sprite_name, {
                        z_depth: finalZ,
                        behaviorIndex: item.behaviorIndex
                    });
                }
            } else if (item.type === 'base') {
                // Base Item with no behaviorIndex (update sprite-level Z only)
                if (finalZ !== initialZ && onLayerUpdate) {
                    log.info('Updating Z-depth for sprite', {
                        spriteName: item.sprite.sprite_name,
                        z_depth: finalZ
                    });
                    onLayerUpdate(item.sprite.sprite_name, { z_depth: finalZ });
                }
                if (newTime !== initialTime) {
                    log.warn('Attempted to move base item in time with no behavior index');
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
                    className="sticky top-0 bg-surface flex crosshair border-b h-6"
                    style={{
                        /* Robust Width Logic: Ensures we are at least 100% for filling, but expand for zoom */
                        width: `calc(max(100%, ${HEADER_WIDTH + (duration * zoom) + 100 + PADDING_LEFT}px))`,
                        zIndex: 120
                    }}
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex-shrink-0 w-header sticky left-0 bg-surface" style={{ zIndex: 130 }}></div>
                    <div className="flex-1 relative overflow-hidden">
                        {(() => {
                            // Adaptive tick intervals based on zoom
                            // At low zoom, show fewer ticks; at high zoom, show more
                            const majorInterval = zoom < 15 ? 5 : zoom < 30 ? 2 : 1; // Major ticks with text
                            const minorInterval = zoom < 15 ? 1 : zoom < 30 ? 0.5 : 0.5; // Minor ticks
                            const subTickInterval = zoom >= 50 ? 0.1 : zoom >= 30 ? 0.25 : null; // Subticks only when zoomed in

                            const ticks = [];

                            // Render subticks first (lowest layer)
                            if (subTickInterval) {
                                for (let t = 0; t <= duration; t += subTickInterval) {
                                    // Skip if this aligns with a minor or major tick
                                    if (t % minorInterval === 0) continue;
                                    ticks.push(
                                        <div
                                            key={`sub-${t}`}
                                            className="absolute"
                                            style={{ left: (t * zoom) + PADDING_LEFT, top: 0, height: '100%' }}
                                        >
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                height: '3px',
                                                borderLeft: '1px solid var(--color-text-muted)'
                                            }} />
                                        </div>
                                    );
                                }
                            }

                            // Render minor ticks
                            for (let t = 0; t <= duration; t += minorInterval) {
                                // Skip if this aligns with a major tick
                                if (t % majorInterval === 0) continue;
                                ticks.push(
                                    <div
                                        key={`minor-${t}`}
                                        className="absolute"
                                        style={{ left: (t * zoom) + PADDING_LEFT, top: 0, height: '100%' }}
                                    >
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            height: '6px',
                                            borderLeft: '1px solid var(--color-text-muted)'
                                        }} />
                                    </div>
                                );
                            }

                            // Render major ticks with centered text on top, large tick on bottom
                            for (let sec = 0; sec <= duration; sec += majorInterval) {
                                ticks.push(
                                    <div key={`major-${sec}`} className="absolute" style={{ left: (sec * zoom) + PADDING_LEFT, top: 0, height: '100%' }}>
                                        {/* Centered time label at top */}
                                        <div className="absolute whitespace-nowrap text-subtle text-xxs" style={{
                                            top: '1px',
                                            left: '-10px',
                                            width: '20px',
                                            textAlign: 'center'
                                        }}>
                                            {sec}s
                                        </div>
                                        {/* Large tick at bottom */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            height: '10px',
                                            borderLeft: '1px solid var(--color-text-muted)'
                                        }} />
                                    </div>
                                );
                            }
                            return ticks;
                        })()}
                        {/* Time Offset Markers - Triangles for behavior keyframes */}
                        {behaviorTimeOffsets.map(offset => {
                            const isSelectedOffset = selectedKeyframe && Math.abs(selectedKeyframe.time - offset) < 0.01;
                            return (
                                <div
                                    key={`offset-${offset}`}
                                    data-testid="time-offset-marker"
                                    className="absolute"
                                    style={{
                                        left: (offset * zoom) + PADDING_LEFT,
                                        top: 0,
                                        height: '100%'
                                    }}
                                    title={`Keyframe at ${offset.toFixed(1)}s`}
                                >
                                    {/* Upward-pointing triangle at bottom of ruler */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '2px',
                                        left: '-3px',
                                        width: 0,
                                        height: 0,
                                        borderLeft: '4px solid transparent',
                                        borderRight: '4px solid transparent',
                                        borderBottom: `5px solid ${isSelectedOffset ? 'var(--color-text-main)' : 'var(--color-primary)'}`
                                    }} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div
                    className="min-h-full"
                    style={{
                        /* Matches Ruler Width: Essential for synchronized scrolling */
                        width: `calc(max(100%, ${HEADER_WIDTH + (duration * zoom) + 100 + PADDING_LEFT}px))`,
                    }}
                >

                    {/* Fixed Headers Column Background */}
                    <div className="absolute left-0 top-0 bottom-0 bg-surface w-header" style={{ zIndex: 109 }} />
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
                                    {z}
                                </div>

                                {/* Track Content */}
                                <div className="flex-1 relative overflow-hidden">
                                    {/* Swimlane separator line - visible full-width line at bottom */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: '1px',
                                        backgroundColor: 'var(--color-border)',
                                        pointerEvents: 'none'
                                    }} />
                                    {items.map(item => {
                                        const isDragging = draggingKeyframe && draggingKeyframe.id === item.key;
                                        const isSelected = selectedLayer === item.sprite.sprite_name;
                                        // Check if this specific keyframe is the primary selection
                                        const isPrimarySelected = selectedKeyframe &&
                                            selectedKeyframe.spriteName === item.sprite.sprite_name &&
                                            ((item.type === 'behavior' && selectedKeyframe.behaviorIndex === item.behaviorIndex) ||
                                                (item.type === 'base' && selectedKeyframe.behaviorIndex === null));

                                        // Tooltip for debugging
                                        const itemTitle = item.type === 'base'
                                            ? `Base: ${item.sprite.sprite_name} (Z:${z})`
                                            : `Behavior: ${item.sprite.sprite_name} (Index:${item.behaviorIndex}, Time:${item.time}s, Z:${z})`;

                                        // Image URL
                                        const src = `${assetBaseUrl}/users/default/sprites/${item.sprite.sprite_name}/${item.sprite.sprite_name}.png`;

                                        return (
                                            <div
                                                key={item.key}
                                                className={`timeline-keyframe-card ${isSelected ? 'selected' : ''} ${isPrimarySelected ? 'selected-primary' : ''} ${isDragging ? 'dragging' : ''}`}
                                                style={{
                                                    left: (isDragging && draggingKeyframe.currentX !== undefined) ? draggingKeyframe.currentX : (item.time * zoom) + PADDING_LEFT - 14.5,
                                                }}
                                                title={itemTitle}
                                                onMouseDown={(e) => handleItemDragStart(e, item, z)}
                                                onContextMenu={(e) => handleContextMenu(e, item, z)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    log.info(`Keyframe clicked: ${item.sprite.sprite_name} (${item.type === 'behavior' ? 'behavior: ' + item.behaviorIndex : 'base'}), time: ${item.time}s`);
                                                    onSelectLayer && onSelectLayer(item.sprite.sprite_name);
                                                    // Report specific keyframe selection
                                                    onKeyframeSelect && onKeyframeSelect(
                                                        item.sprite.sprite_name,
                                                        item.type === 'behavior' ? item.behaviorIndex : null,
                                                        item.time
                                                    );
                                                    // Advance timekeeper to keyframe offset
                                                    onTimeChange && onTimeChange(item.time);
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
                    className="absolute pointer-events-none"
                    style={{
                        zIndex: 105,
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
