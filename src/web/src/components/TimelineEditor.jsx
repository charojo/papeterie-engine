import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from './Icon';

export function TimelineEditor({
    duration = 30,
    currentTime = 0,
    layers = [],
    selectedLayer = null,
    onTimeChange,
    onKeyframeMove,
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

    const totalHeight = sortedZDepths.length * TRACK_HEIGHT;

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
            behaviorIndex: item.type === 'behavior' ? item.behaviorIndex : null
        });

        const handleDragMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const newTime = Math.max(0, initialTime + (dx / zoom));

            // Preview Time Update
            if (item.type === 'behavior') {
                onKeyframeMove && onKeyframeMove(item.sprite.sprite_name, item.behaviorIndex, newTime, false);
            }
            // Note: Base items (t=0) usually can't change time (it's base). 
            // We could allow dragging base to become a keyframe? For now, lock Base time to 0.
        };

        const handleDragUp = (upEvent) => {
            const dx = upEvent.clientX - startX;

            // 1. Calculate New Time
            let newTime = initialTime;
            if (item.type === 'behavior') {
                newTime = Math.max(0, initialTime + (dx / zoom));
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
                    if (onLayerUpdate) {
                        onLayerUpdate(item.sprite.sprite_name, {
                            z_depth: finalZ,
                            // Signal that this is for a behavior
                            behaviorIndex: item.behaviorIndex
                        });
                    }
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

    return (
        <div style={{
            background: 'var(--color-bg-surface)',
            borderTop: '1px solid var(--color-border)',
            height: '250px',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none'
        }}>
            {/* Controls Bar */}
            <div style={{ height: '32px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', background: 'var(--color-bg-elevated)' }}>
                <button
                    className="btn-icon"
                    onClick={onPlayPause}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    style={{ padding: '4px', display: 'flex' }}
                >
                    <Icon name={isPlaying ? "pause" : "play"} />
                </button>
                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', minWidth: '70px' }} title={`Current time: ${currentTime.toFixed(2)} seconds`}>
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
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }} title="Timeline Zoom">Zoom:</span>
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

            {/* Timeline Content */}
            <div
                ref={containerRef}
                data-testid="timeline-tracks"
                style={{
                    flex: 1,
                    display: 'flex',
                    overflow: 'auto',
                    position: 'relative'
                }}
            >
                <div style={{
                    minWidth: HEADER_WIDTH + (duration * zoom) + 100 + PADDING_LEFT,
                    minHeight: totalHeight + 24
                }}>

                    {/* Fixed Headers Column Background */}
                    <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: HEADER_WIDTH,
                        background: 'var(--color-bg-surface)',
                        borderRight: '1px solid var(--color-border)',
                        zIndex: 10
                    }} />

                    {/* Ruler */}
                    <div
                        data-testid="timeline-ruler"
                        style={{
                            height: '24px',
                            borderBottom: '1px solid var(--color-border)',
                            position: 'sticky', top: 0,
                            background: 'var(--color-bg-surface)',
                            zIndex: 20,
                            display: 'flex',
                            cursor: 'crosshair'
                        }}
                        onMouseDown={handleMouseDown}
                    >
                        <div style={{ width: HEADER_WIDTH, borderRight: '1px solid var(--color-border)', flexShrink: 0 }}></div>
                        <div style={{ flex: 1, position: 'relative' }}>
                            {(() => {
                                const textInterval = zoom < 15 ? 5 : zoom < 30 ? 2 : 1;
                                const tickInterval = 1;
                                const ticks = [];
                                for (let sec = 0; sec <= duration; sec += tickInterval) {
                                    const showText = sec % textInterval === 0;
                                    ticks.push(
                                        <div key={sec} style={{ position: 'absolute', left: (sec * zoom) + PADDING_LEFT }}>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0,
                                                height: showText ? '8px' : '4px',
                                                borderLeft: `1px solid ${showText ? 'var(--color-text-muted)' : 'var(--color-border)'}`
                                            }} />
                                            {showText && (
                                                <div style={{
                                                    position: 'absolute', top: 10, left: 2,
                                                    fontSize: '0.6rem', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap'
                                                }}>
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

                    {/* Parallax Lanes */}
                    {sortedZDepths.map((z) => {
                        const items = lanes[z];
                        return (
                            <div
                                key={z}
                                ref={el => laneRefs.current[z] = el}
                                style={{ height: TRACK_HEIGHT, borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', position: 'relative' }}
                            >
                                {/* Header */}
                                <div style={{
                                    width: HEADER_WIDTH,
                                    borderRight: '1px solid var(--color-border)',
                                    flexShrink: 0,
                                    position: 'sticky',
                                    left: 0,
                                    background: 'var(--color-bg-surface)',
                                    zIndex: 15,
                                    display: 'flex',
                                    alignItems: 'center',
                                    paddingLeft: '12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    color: 'var(--color-text-primary)'
                                }}>
                                    Layer {z}
                                </div>

                                {/* Track Content */}
                                <div style={{ flex: 1, position: 'relative' }}>
                                    {items.map((item) => {
                                        const isDragging = draggingKeyframe && draggingKeyframe.id === item.key;
                                        const isSelected = selectedLayer === item.sprite.sprite_name;

                                        // Image URL
                                        const src = `${assetBaseUrl}/users/default/sprites/${item.sprite.sprite_name}/${item.sprite.sprite_name}.png`;

                                        return (
                                            <div
                                                key={item.key}
                                                style={{
                                                    position: 'absolute',
                                                    left: (item.time * zoom) + PADDING_LEFT,
                                                    top: '8px',
                                                    width: '32px', // Thumbnail size
                                                    height: '32px',
                                                    borderRadius: '4px',
                                                    border: isDragging ? '2px solid var(--color-primary-active)' :
                                                        isSelected ? '2px solid var(--color-primary)' :
                                                            '1px solid var(--color-border-hover)',
                                                    boxShadow: isSelected ? '0 0 0 2px rgba(var(--color-primary-rgb), 0.3)' : 'none',
                                                    background: 'var(--color-bg-surface)',
                                                    cursor: 'move',
                                                    zIndex: isDragging ? 100 : isSelected ? 50 : 2,
                                                    transform: 'translateX(-50%)', // Center on time
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden'
                                                }}
                                                title={`${item.sprite.sprite_name} (${item.type}) at ${item.time.toFixed(2)}s`}
                                                onMouseDown={(e) => handleItemDragStart(e, item, z)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectLayer && onSelectLayer(item.sprite.sprite_name);
                                                }}
                                            >
                                                <img
                                                    src={src}
                                                    alt={item.sprite.sprite_name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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

                    {/* Playhead Line */}
                    <div style={{
                        position: 'absolute',
                        left: HEADER_WIDTH + (currentTime * zoom) + PADDING_LEFT,
                        top: 24, bottom: 0,
                        width: '2px', background: 'var(--color-danger)',
                        zIndex: 15, pointerEvents: 'none'
                    }}>
                        <div style={{
                            position: 'absolute', top: -4, left: -4,
                            width: 10, height: 10, background: 'var(--color-danger)',
                            transform: 'rotate(45deg)'
                        }} />
                    </div>

                </div>
            </div>
        </div>
    );
}
