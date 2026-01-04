import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from './Icon';

export function TimelineEditor({
    duration = 30,
    currentTime = 0,
    layers = [],
    selectedLayer,
    layerVisibility = {},
    onTimeChange,
    onKeyframeMove,
    onPlayPause,
    onLayerUpdate, // ({ spriteName, z_depth, visible })
    onSelectLayer,
    isPlaying,
    assetBaseUrl = '/assets'
}) {
    const containerRef = useRef(null);
    const [zoom, setZoom] = useState(20);
    const [draggingKeyframe, setDraggingKeyframe] = useState(null); // { layerName, behaviorIndex, initialZ, currentZ, ... }

    // Group layers by Z-depth
    const levels = useMemo(() => {
        const grouped = layers.reduce((acc, layer) => {
            const z = layer.z_depth || 0;
            if (!acc[z]) acc[z] = [];
            acc[z].push(layer);
            return acc;
        }, {});
        return grouped;
    }, [layers]);

    const sortedZDepths = useMemo(() => {
        const depths = Object.keys(levels).map(Number).sort((a, b) => b - a);
        return depths;
    }, [levels]);

    // Handle scrubbing
    const handleMouseDown = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = Math.max(0, Math.min(duration, x / zoom));
        onTimeChange(time);

        const handleMouseMove = (moveEvent) => {
            if (!containerRef.current) return;
            const moveRect = containerRef.current.getBoundingClientRect();
            const moveX = moveEvent.clientX - moveRect.left;
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

    const handleKeyframeDragStart = (e, layerName, behaviorIndex, behaviors, initialZ) => {
        e.stopPropagation();
        setDraggingKeyframe({ layerName, behaviorIndex, behaviors, initialZ, currentZ: initialZ });

        const handleMouseMove = (moveEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();

            // X-axis: Time
            const x = moveEvent.clientX - rect.left;
            const newTime = Math.max(0, Math.min(duration, x / zoom));

            // Y-axis: Z-depth
            const y = moveEvent.clientY - rect.top;
            const trackY = y - 24; // 24px is ruler height
            const floatIndex = trackY / 40;
            const roundedIndex = Math.round(floatIndex);
            const onLine = Math.abs(floatIndex - roundedIndex) < 0.25;

            let targetZ = initialZ;
            let dropMode = 'snap';

            if (onLine) {
                if (roundedIndex <= 0) {
                    targetZ = (sortedZDepths[0] || 0) + 10;
                    dropMode = 'new_top';
                } else if (roundedIndex >= sortedZDepths.length) {
                    targetZ = (sortedZDepths[sortedZDepths.length - 1] || 0) - 10;
                    dropMode = 'new_bottom';
                } else {
                    const zUpper = sortedZDepths[roundedIndex - 1];
                    const zLower = sortedZDepths[roundedIndex];
                    targetZ = Math.round((zUpper + zLower) / 2);
                    dropMode = Math.abs(zUpper - zLower) <= 1 ? 'normalize' : 'midpoint';
                }
            } else {
                let trackIndex = Math.floor(floatIndex);
                if (trackIndex < 0) trackIndex = 0;
                if (trackIndex >= sortedZDepths.length) trackIndex = sortedZDepths.length - 1;
                targetZ = sortedZDepths[trackIndex];
                dropMode = 'snap';
            }

            setDraggingKeyframe(prev => ({ ...prev, currentZ: targetZ, dropMode }));

            // Update visual position during drag (optimistic)
            if (onKeyframeMove) {
                onKeyframeMove(layerName, behaviorIndex, newTime, false);
            }
        };

        const handleMouseUp = (upEvent) => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();

                // Final Time
                const x = upEvent.clientX - rect.left;
                const newTime = Math.max(0, Math.min(duration, x / zoom));

                // Final Z-depth
                const y = upEvent.clientY - rect.top;
                const trackY = y - 24;
                const floatIndex = trackY / 40;
                const roundedIndex = Math.round(floatIndex);
                const onLine = Math.abs(floatIndex - roundedIndex) < 0.25;

                let targetZ = initialZ;
                let dropMode = 'snap';

                if (onLine) {
                    if (roundedIndex <= 0) {
                        targetZ = (sortedZDepths[0] || 0) + 10;
                        dropMode = 'new_top';
                    } else if (roundedIndex >= sortedZDepths.length) {
                        targetZ = (sortedZDepths[sortedZDepths.length - 1] || 0) - 10;
                        dropMode = 'new_bottom';
                    } else {
                        const zUpper = sortedZDepths[roundedIndex - 1];
                        const zLower = sortedZDepths[roundedIndex];
                        targetZ = Math.round((zUpper + zLower) / 2);
                        dropMode = Math.abs(zUpper - zLower) <= 1 ? 'normalize' : 'midpoint';
                    }
                } else {
                    let trackIndex = Math.floor(floatIndex);
                    if (trackIndex < 0) trackIndex = 0;
                    if (trackIndex >= sortedZDepths.length) trackIndex = sortedZDepths.length - 1;
                    targetZ = sortedZDepths[trackIndex];
                    dropMode = 'snap';
                }

                // Commit Time
                if (onKeyframeMove) {
                    onKeyframeMove(layerName, behaviorIndex, newTime, true);
                }

                // Commit Z-depth if changed
                if ((targetZ !== initialZ || dropMode === 'normalize') && onLayerUpdate) {
                    onLayerUpdate(layerName, { z_depth: targetZ, dropMode });
                }
            }

            setDraggingKeyframe(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Auto-scroll when time advances
    useEffect(() => {
        if (!containerRef.current) return;

        const scrollContainer = containerRef.current;
        const playheadX = currentTime * zoom;
        const { scrollLeft, clientWidth } = scrollContainer;
        const bufferPixels = 5 * zoom;

        if (playheadX > scrollLeft + clientWidth - bufferPixels) {
            if (scrollContainer.scrollTo) {
                scrollContainer.scrollTo({
                    left: Math.max(0, playheadX - clientWidth * 0.2),
                    behavior: 'smooth'
                });
            } else {
                scrollContainer.scrollLeft = Math.max(0, playheadX - clientWidth * 0.2);
            }
        }
        else if (playheadX < scrollLeft) {
            if (scrollContainer.scrollTo) {
                scrollContainer.scrollTo({
                    left: Math.max(0, playheadX - clientWidth * 0.2),
                    behavior: 'smooth'
                });
            } else {
                scrollContainer.scrollLeft = Math.max(0, playheadX - clientWidth * 0.2);
            }
        }
    }, [currentTime, zoom]);

    // Auto-scroll vertically to selected layer
    useEffect(() => {
        if (!containerRef.current || !selectedLayer) return;

        const scrollContainer = containerRef.current;
        const tracks = scrollContainer.querySelectorAll('[data-layer-name]');
        let targetTrack = null;
        for (const track of tracks) {
            if (track.getAttribute('data-layer-name') === selectedLayer) {
                targetTrack = track;
                break;
            }
        }

        if (targetTrack) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const trackRect = targetTrack.getBoundingClientRect();

            if (trackRect.top < containerRect.top + 24 || trackRect.bottom > containerRect.bottom) {
                // Not using smooth scroll here to avoid fighting with other animations
                // but we could if it feels better.
                const newScrollTop = scrollContainer.scrollTop + (trackRect.top - containerRect.top - 24);
                if (scrollContainer.scrollTo) {
                    scrollContainer.scrollTo({ top: newScrollTop, behavior: 'smooth' });
                } else {
                    scrollContainer.scrollTop = newScrollTop;
                }
            }
        }
    }, [selectedLayer, levels]); // Re-run if levels change (Z-depth updates)

    return (
        <div style={{
            background: 'var(--color-bg-surface)',
            borderTop: '1px solid var(--color-border)',
            height: '200px',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none'
        }}>
            {/* Toolbar */}
            <div style={{
                height: '32px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: '8px',
                background: 'var(--color-bg-elevated)'
            }}>
                <button
                    className="btn-icon"
                    onClick={onPlayPause}
                    style={{ padding: '4px', display: 'flex' }}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                    <Icon name={isPlaying ? "pause" : "play"} size={14} />
                </button>
                <span
                    style={{ fontSize: '0.8rem', fontFamily: 'monospace', minWidth: '70px' }}
                    title={`Current time: ${currentTime.toFixed(2)} seconds`}
                >
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

                <div style={{ flex: 1 }}></div>

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
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Labels Column (Z-Levels) */}
                <div style={{
                    width: '60px',
                    borderRight: '1px solid var(--color-border)',
                    background: 'var(--color-bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'hidden'
                }}>
                    <div style={{ height: '24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                        Z
                    </div>
                    {sortedZDepths.map((z) => (
                        <div key={z} style={{
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            borderBottom: '1px solid var(--color-border)',
                            color: 'var(--color-text-normal)',
                            position: 'relative',
                            background: (draggingKeyframe?.currentZ === z && draggingKeyframe?.dropMode === 'snap') ? 'var(--color-primary-glow)' : 'transparent'
                        }}>
                            {z}
                            {/* Drop indicator above */}
                            {draggingKeyframe?.dropMode !== 'snap' && draggingKeyframe?.currentZ > z && (draggingKeyframe?.currentZ < (sortedZDepths[sortedZDepths.indexOf(z) - 1] || Infinity)) && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-2px',
                                    left: 0,
                                    right: 0,
                                    height: '4px',
                                    background: 'var(--color-primary)',
                                    zIndex: 10,
                                    boxShadow: '0 0 8px var(--color-primary-glow)'
                                }} />
                            )}
                            {/* Drop indicator below if it's the last one */}
                            {draggingKeyframe?.dropMode !== 'snap' && draggingKeyframe?.currentZ < z && sortedZDepths.indexOf(z) === sortedZDepths.length - 1 && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-2px',
                                    left: 0,
                                    right: 0,
                                    height: '4px',
                                    background: 'var(--color-primary)',
                                    zIndex: 10,
                                    boxShadow: '0 0 8px var(--color-primary-glow)'
                                }} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Ruler and Tracks */}
                <div
                    ref={containerRef}
                    data-testid="timeline-tracks"
                    style={{
                        flex: 1,
                        overflowX: 'auto',
                        overflowY: 'auto',
                        position: 'relative'
                    }}
                >
                    <div style={{ width: duration * zoom + 100, height: '100%', minHeight: (sortedZDepths.length * 40) + 24 }}>
                        {/* Playhead */}
                        <div style={{
                            position: 'absolute',
                            left: currentTime * zoom,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: 'var(--color-danger)',
                            zIndex: 10,
                            pointerEvents: 'none'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: '-4px',
                                width: '10px',
                                height: '10px',
                                background: 'var(--color-danger)',
                                transform: 'rotate(45deg)'
                            }}></div>
                        </div>

                        {/* Ruler */}
                        <div
                            data-testid="timeline-ruler"
                            style={{ height: '24px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-surface)', zIndex: 5, cursor: 'crosshair' }}
                            onMouseDown={handleMouseDown}
                            title="Click or drag to scrub timeline"
                        >
                            {(() => {
                                const textInterval = zoom < 15 ? 5 : zoom < 30 ? 2 : 1;
                                const tickInterval = 1;
                                const ticks = [];

                                for (let sec = 0; sec <= duration; sec += tickInterval) {
                                    const showText = sec % textInterval === 0;
                                    ticks.push(
                                        <div key={sec} style={{ position: 'absolute', left: sec * zoom }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                height: showText ? '8px' : '4px',
                                                borderLeft: `1px solid ${showText ? 'var(--color-text-muted)' : 'var(--color-border)'}`
                                            }} />
                                            {showText && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 10,
                                                    left: 2,
                                                    fontSize: '0.6rem',
                                                    color: 'var(--color-text-subtle)',
                                                    whiteSpace: 'nowrap'
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

                        {/* Tracks by Z-Level */}
                        {sortedZDepths.map((z) => (
                            <div
                                key={z}
                                data-layer-group={z}
                                style={{
                                    height: '40px',
                                    borderBottom: '1px solid var(--color-border)',
                                    position: 'relative',
                                    background: (draggingKeyframe?.currentZ === z && draggingKeyframe?.dropMode === 'snap') ? 'var(--color-primary-glow)' : 'transparent'
                                }}
                            >
                                {/* Drop indicator horizontal lines across tracks */}
                                {draggingKeyframe?.dropMode !== 'snap' && draggingKeyframe?.currentZ > z && (draggingKeyframe?.currentZ < (sortedZDepths[sortedZDepths.indexOf(z) - 1] || Infinity)) && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-2px',
                                        left: 0,
                                        right: 0,
                                        height: '4px',
                                        background: 'var(--color-primary)',
                                        zIndex: 10,
                                        boxShadow: '0 0 8px var(--color-primary-glow)'
                                    }} />
                                )}
                                {draggingKeyframe?.dropMode !== 'snap' && draggingKeyframe?.currentZ < z && sortedZDepths.indexOf(z) === sortedZDepths.length - 1 && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-2px',
                                        left: 0,
                                        right: 0,
                                        height: '4px',
                                        background: 'var(--color-primary)',
                                        zIndex: 10,
                                        boxShadow: '0 0 8px var(--color-primary-glow)'
                                    }} />
                                )}

                                {/* Render icons for each sprite in this level */}
                                {levels[z].map((l) => (
                                    <React.Fragment key={l.sprite_name}>
                                        {/* Hidden div just to tag this track with sprite names for auto-scroll logic */}
                                        <div
                                            data-layer-name={l.sprite_name}
                                            style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
                                        />
                                        {(l.behaviors || []).filter(b => b.type === 'location' && b.time_offset !== undefined).map((b, idx) => {
                                            const behaviorIndex = (l.behaviors || []).indexOf(b);
                                            const isDragging = draggingKeyframe?.layerName === l.sprite_name && draggingKeyframe?.behaviorIndex === behaviorIndex;

                                            return (
                                                <div
                                                    key={`${l.sprite_name}-${idx}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: b.time_offset * zoom,
                                                        top: '4px',
                                                        width: '32px',
                                                        height: '32px',
                                                        background: 'var(--color-bg-elevated)',
                                                        borderRadius: '4px',
                                                        zIndex: isDragging ? 20 : 2,
                                                        transform: 'translateX(-50%)',
                                                        border: selectedLayer === l.sprite_name ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                                        cursor: 'grab',
                                                        boxShadow: isDragging ? '0 0 15px var(--color-primary-glow)' : 'none',
                                                        overflow: 'hidden',
                                                        opacity: layerVisibility[l.sprite_name] === false ? 0.4 : 1,
                                                        pointerEvents: 'auto'
                                                    }}
                                                    title={`${l.sprite_name} keyframe at ${b.time_offset.toFixed(2)}s (drag to move time/Z)`}
                                                    onMouseDown={(e) => handleKeyframeDragStart(e, l.sprite_name, behaviorIndex, l.behaviors, z)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onSelectLayer) onSelectLayer(l.sprite_name);
                                                    }}
                                                >
                                                    <img
                                                        src={`${assetBaseUrl}/users/default/sprites/${l.sprite_name}/${l.sprite_name}.png`}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                                                        onError={(e) => e.target.style.display = 'none'}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
