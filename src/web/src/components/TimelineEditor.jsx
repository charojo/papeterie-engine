import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import './TimelineEditor.css';
import { createLogger } from '../utils/logger';
import { useTimelineDrag } from '../hooks/useTimelineDrag';

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
    assetBaseUrl = '/assets',
    forceScrollToSelection = 0, // Counter to force scroll even if selection hasn't changed
    onHeaderDoubleClick,
    onAddSpriteRequested
}) {
    const [zoom, setZoom] = useState(20); // pixels per second
    const containerRef = useRef(null);
    const laneRefs = useRef({});
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

    // Track last scrolled selection to prevent re-scrolling oscillation
    const lastScrolledSelectionRef = useRef(null);

    // Track forceScrollToSelection to detect when external selection wants to force scroll
    const lastForceScrollRef = useRef(forceScrollToSelection);

    // Flag to skip scrolling when selection originates from a timeline click
    const skipScrollRef = useRef(false);

    // Scroll Logic (Smart "Scroll Into View" - both vertical and horizontal)
    useEffect(() => {
        // Guard: Skip if nothing selected
        if (!selectedLayer && !selectedKeyframe) return;

        // Skip scrolling if selection originated from a timeline click
        if (skipScrollRef.current) {
            log.debug('[TimelineScroll] Skipping - selection from timeline click');
            skipScrollRef.current = false;
            return;
        }

        // If forceScrollToSelection changed, reset the scroll cache to force scroll
        if (forceScrollToSelection !== lastForceScrollRef.current) {
            log.debug('[TimelineScroll] Force scroll requested, resetting cache', {
                prev: lastForceScrollRef.current,
                new: forceScrollToSelection
            });
            lastScrolledSelectionRef.current = null;
            lastForceScrollRef.current = forceScrollToSelection;
        }

        if (selectedLayer && laneRefs.current) {
            // Generate a unique key for this selection to prevent re-scrolling oscillation
            const selectionKey = selectedKeyframe
                ? `${selectedLayer}-${selectedKeyframe.behaviorIndex}-${selectedKeyframe.time}`
                : selectedLayer;

            // Skip if we've already scrolled to this exact selection (and no force scroll was requested)
            if (lastScrolledSelectionRef.current === selectionKey) {
                // Double check if we are still visible? No, trust the cache to prevent loop.
                return;
            }

            // requestAnimationFrame to decouple read/write and prevent synchronous layout thrashing loops
            requestAnimationFrame(() => {
                if (!containerRef.current) return;

                log.debug('[TimelineScroll] Processing scroll for:', selectionKey);

                // Calculate which lane we should scroll to
                // Priority: selectedKeyframe's lane > sprite's base lane
                let targetZ = null;

                if (selectedKeyframe && selectedKeyframe.spriteName === selectedLayer) {
                    // Find lane containing this specific keyframe - MUST match sprite name
                    for (const [z, items] of Object.entries(lanes)) {
                        const found = items.find(it =>
                            it.sprite.sprite_name === selectedLayer &&
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
                        targetZ = sprite.z_depth !== undefined ? sprite.z_depth : 0;
                    }
                }

                if (targetZ !== null && laneRefs.current[targetZ]) {
                    const el = laneRefs.current[targetZ];
                    const container = containerRef.current;
                    if (el && container) {
                        const RULER_HEIGHT = 24;
                        const elRect = el.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();

                        // 1. Vertical Visibility (Lanes)
                        const elTopRel = elRect.top - containerRect.top;
                        const elBottomRel = elRect.bottom - containerRect.top;
                        const visibleMinY = RULER_HEIGHT;
                        const visibleMaxY = containerRect.height;

                        const isFullyVisibleY = elTopRel >= visibleMinY && elBottomRel <= visibleMaxY;
                        const isPartiallyVisibleY = (elTopRel < visibleMaxY && elBottomRel > visibleMinY);

                        // 2. Horizontal Visibility (Time)
                        const targetTime = (selectedKeyframe && selectedKeyframe.spriteName === selectedLayer) ? selectedKeyframe.time : 0;
                        const targetX = HEADER_WIDTH + (targetTime * zoom) + PADDING_LEFT;
                        const scrollLeft = container.scrollLeft;
                        const containerWidth = container.clientWidth;

                        const buffer = 50;
                        const visibleMinX = scrollLeft + HEADER_WIDTH + buffer;
                        const visibleMaxX = scrollLeft + containerWidth - buffer;

                        const isVisibleX = targetX >= visibleMinX && targetX <= visibleMaxX;

                        let scrolled = false;

                        // Vertical Scroll
                        if (!isFullyVisibleY && !isPartiallyVisibleY) {
                            const newScrollTop = container.scrollTop + elTopRel - RULER_HEIGHT;
                            if (Math.abs(container.scrollTop - newScrollTop) > 1) {
                                container.scrollTop = newScrollTop;
                                scrolled = true;
                            }
                        } else if (!isFullyVisibleY) {
                            let dest = container.scrollTop;
                            if (elTopRel < visibleMinY) {
                                dest = container.scrollTop + (elTopRel - visibleMinY);
                            } else if (elBottomRel > visibleMaxY) {
                                dest = container.scrollTop + (elBottomRel - visibleMaxY);
                            }
                            if (Math.abs(container.scrollTop - dest) > 1) {
                                container.scrollTop = dest;
                                scrolled = true;
                            }
                        }

                        // Horizontal Scroll
                        if (!isVisibleX) {
                            const newScrollLeft = Math.max(0, targetX - (containerWidth / 2));
                            if (Math.abs(container.scrollLeft - newScrollLeft) > 1) {
                                container.scrollLeft = newScrollLeft;
                                scrolled = true;
                            }
                        }

                        if (scrolled) {
                            log.debug('[TimelineScroll] Performed scroll');
                        }
                    }
                }

                // Always update cache to prevent re-trying this selection
                lastScrolledSelectionRef.current = selectionKey;
            });

        }
    }, [selectedLayer, selectedKeyframe, layers, lanes, forceScrollToSelection, zoom]);

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

    // Generalized Drag Handler (Handles Time X and Lane Y) extracted to hook
    const { handleItemDragStart, draggingKeyframe } = useTimelineDrag({
        containerRef,
        zoom,
        duration,
        sortedZDepths,
        onKeyframeMove,
        onLayerUpdate,
        TRACK_HEIGHT,
        RULER_HEIGHT: 24, // Matches constant in hook
        HEADER_WIDTH,
        PADDING_LEFT
    });

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

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY;
            const zoomFactor = delta > 0 ? 0.9 : 1.1;
            setZoom(z => Math.max(1, Math.min(200, z * zoomFactor)));
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // We need to add valid event listener to a container that covers the timeline.
        // However, containerRef is attached to the tracks container, not the main wrapper.
        // Let's attach to the main wrapper if we can, but we don't have a ref for it yet.
        // Or we can just use the onWheel prop on the div, but React's onWheel is passive by default? 
        // No, React's onWheel works for preventing default if we use it correctly, 
        // but sometimes browser zooming happens before JS can prevent it?
        // Actually, for Ctrl+Wheel, browsers invoke browser zoom. To prevent browser zoom, 
        // we MUST use a non-passive event listener on the window or document, OR the element.
        // React 18 event delegation might handle it, but preventing default on Ctrl+Wheel is tricky.

        // Let's try the React prop first.
    }, []);

    // ROBUST HOVER LOGIC (Rule 8)
    const [hoveredItems, setHoveredItems] = useState([]);
    const [hoverPosition, setHoverPosition] = useState(null); // { x, y }
    const hoverTimeoutRef = useRef(null);

    const handleItemMouseEnter = (e, targetItem, z) => {
        if (draggingKeyframe || contextMenu) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

        const rect = e.currentTarget.getBoundingClientRect();

        // Find overlapping items (Same Layer, Same Time)
        const laneItems = lanes[z] || [];
        const overlapping = laneItems.filter(it =>
            Math.abs(it.time - targetItem.time) < 0.05
        );

        if (overlapping.length > 0) {
            setHoveredItems(overlapping.map(it => ({ ...it, z }))); // Inject Z for display

            // Anchor: Bottom-Right of Thumbnail with ~10% overlap
            setHoverPosition({
                x: rect.right - (rect.width * 0.1),
                y: rect.bottom - (rect.height * 0.1)
            });
        }
    };

    const handleItemMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItems([]);
            setHoverPosition(null);
        }, 300); // 300ms grace period to move into popup
    };

    const handlePopupMouseEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };

    const handlePopupMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItems([]);
            setHoverPosition(null);
        }, 300);
    };

    useEffect(() => {
        // Clear hover when scrolling
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (hoveredItems.length > 0) {
                setHoveredItems([]);
                setHoverPosition(null);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hoveredItems.length]);

    return (
        <div
            className="timeline-main"
            onWheel={handleWheel}
        >
            {/* Controls Bar */}
            <div
                className="timeline-toolbar cursor-pointer select-none"
                onDoubleClick={onHeaderDoubleClick}
                title="Double-click to toggle timeline height"
            >
                <Button
                    variant="icon"
                    size="sm"
                    onClick={onAddSpriteRequested}
                    title="Add Sprite (Shift+Click on Stage)"
                    icon="add"
                />
                <div className="w-0.5" />
                <Button
                    variant="icon"
                    size="sm"
                    onClick={onPlayPause}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    icon={isPlaying ? "pause" : "play"}
                />
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
                    className="timeline-scrubber"
                    title={`Scrub to ${currentTime.toFixed(1)}s`}
                />
                <div className="flex-1" />
                <div className="timeline-zoom-controls">
                    <span className="timeline-zoom-label" title="Timeline Zoom">Zoom:</span>
                    <input
                        type="range"
                        min="5"
                        max="100"
                        value={zoom}
                        onChange={e => setZoom(parseInt(e.target.value))}
                        className="timeline-zoom-input"
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
                    className="timeline-ruler-container"
                    style={{
                        /* Robust Width Logic: Ensures we are at least 100% for filling, but expand for zoom */
                        width: `calc(max(100%, var(--timeline-header-width) + (${duration * zoom}px) + 100px + var(--timeline-padding-left)))`,
                    }}
                    onMouseDown={handleMouseDown}
                >
                    <div className="timeline-ruler-header"></div>
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
                                            className="timeline-track-tick"
                                            style={{ left: (t * zoom) + PADDING_LEFT }}
                                        >
                                            <div className="timeline-tick-line h-3px" />
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
                                        className="timeline-track-tick"
                                        style={{ left: (t * zoom) + PADDING_LEFT }}
                                    >
                                        <div className="timeline-tick-line h-6px" />
                                    </div>
                                );
                            }

                            // Render major ticks with centered text on top, large tick on bottom
                            for (let sec = 0; sec <= duration; sec += majorInterval) {
                                ticks.push(
                                    <div
                                        key={`major-${sec}`}
                                        className="timeline-track-tick"
                                        style={{ left: (sec * zoom) + PADDING_LEFT }}
                                    >
                                        {/* Centered time label at top */}
                                        <div className="absolute  text-subtle text-xxs timeline-major-tick-label">
                                            {sec}s
                                        </div>
                                        {/* Large tick at bottom */}
                                        <div className="timeline-tick-line h-10px" />
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
                                    className="timeline-track-tick"
                                    style={{
                                        left: (offset * zoom) + PADDING_LEFT,
                                        width: '1px'
                                    }}
                                    title={`Keyframe at ${offset.toFixed(1)}s`}
                                >
                                    {/* Upward-pointing triangle at bottom of ruler */}
                                    <div className={`timeline-offset-marker-triangle ${isSelectedOffset ? 'selected' : ''}`} />
                                </div>
                            );
                        })}
                    </div>
                </div >

                <div
                    className="min-h-full"
                    style={{
                        /* Matches Ruler Width: Essential for synchronized scrolling */
                        width: `calc(max(100%, var(--timeline-header-width) + (${duration * zoom}px) + 100px + var(--timeline-padding-left)))`,
                    }}
                >

                    {/* Fixed Headers Column Background */}
                    <div className="timeline-lane-header-bg" />
                    {sortedZDepths.map((z) => {
                        const items = lanes[z];

                        return (
                            <div
                                key={z}
                                ref={el => laneRefs.current[z] = el}
                                className="border-b-subtle flex relative h-track"
                            >
                                {/* Header */}
                                <div
                                    className="timeline-lane-header"
                                    title={`Layer ${z} (${z >= 25 ? 'Front' : 'Back'})\nHigher Z = Foreground`}
                                >
                                    {z}
                                </div>

                                {/* Track Content */}
                                <div className="flex-1 relative overflow-hidden">
                                    {/* Swimlane separator line - visible full-width line at bottom */}
                                    <div className="timeline-swimlane-separator" />
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
                                                onMouseEnter={(e) => handleItemMouseEnter(e, item, z)}
                                                onMouseLeave={handleItemMouseLeave}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    log.debug(`Keyframe clicked: ${item.sprite.sprite_name}, time: ${item.time}s`);
                                                    // Mark that selection is from a timeline click - skip auto-scroll
                                                    skipScrollRef.current = true;
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
                    className="timeline-playhead-line"
                    style={{
                        left: HEADER_WIDTH + (currentTime * zoom) + PADDING_LEFT,
                        height: `${Math.max(sortedZDepths.length * TRACK_HEIGHT + 24, 200)}px`
                    }}
                >
                    {/* Header Triangle */}
                    <div className="timeline-playhead-triangle" />
                </div>
            </div >

            {/* Context Menu Overlay */}
            {
                contextMenu && (
                    <div
                        className="timeline-context-menu"
                        style={{
                            left: contextMenu.x,
                            top: contextMenu.y
                        }}
                    >
                        {contextMenu.item.type === 'behavior' && (
                            <Button
                                variant="danger"
                                size="sm"
                                isBlock
                                className="btn-ghost"
                                onClick={() => {
                                    onKeyframeDelete && onKeyframeDelete(contextMenu.item.sprite.sprite_name, contextMenu.item.behaviorIndex);
                                    closeContextMenu();
                                }}
                                icon="delete"
                            >
                                Delete Keyframe
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            isBlock
                            onClick={() => {
                                onSelectLayer && onSelectLayer(contextMenu.item.sprite.sprite_name);
                                closeContextMenu();
                            }}
                            icon="edit"
                        >
                            Focus {contextMenu.item.sprite.sprite_name}
                        </Button>
                    </div>
                )
            }
            {/* Hover Popup for Overlapping Sprites */}
            {
                hoveredItems.length > 0 && hoverPosition && (
                    <div
                        className="timeline-hover-popup"
                        style={{
                            left: hoverPosition.x,
                            top: hoverPosition.y
                        }}
                        onMouseEnter={handlePopupMouseEnter}
                        onMouseLeave={handlePopupMouseLeave}
                    >
                        <div className="text-xs text-subtle px-2 pb-1 border-b-muted">Select Sprite</div>
                        {hoveredItems.map((item, idx) => (
                            <Button
                                key={`${item.key}-${idx}`}
                                variant="ghost"
                                size="sm"
                                isBlock
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectLayer && onSelectLayer(item.sprite.sprite_name);
                                    // Report specific keyframe selection
                                    onKeyframeSelect && onKeyframeSelect(
                                        item.sprite.sprite_name,
                                        item.type === 'behavior' ? item.behaviorIndex : null,
                                        item.time
                                    );
                                    setHoveredItems([]);
                                }}
                            >
                                <div className="flex-row items-center gap-sm">
                                    <img
                                        src={`${assetBaseUrl}/users/default/sprites/${item.sprite.sprite_name}/${item.sprite.sprite_name}.png`}
                                        className="w-6 h-6 object-contain"
                                        alt=""
                                    />
                                    <span>{item.sprite.sprite_name}</span>
                                    <span className="text-xs text-muted ml-auto">Z:{item.z}</span>
                                </div>
                            </Button>
                        ))}
                    </div>
                )
            }
        </div >
    );
}

