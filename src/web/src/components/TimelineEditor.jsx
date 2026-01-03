import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

export function TimelineEditor({
    duration = 30,
    currentTime = 0,
    layers = [],
    selectedLayer,
    onTimeChange,
    onKeyframeMove,
    onPlayPause,
    isPlaying
}) {
    const containerRef = useRef(null);
    const [zoom, setZoom] = useState(20);
    const [draggingKeyframe, setDraggingKeyframe] = useState(null); // { layerName, behaviorIndex }

    // Handle scrubbing
    const handleMouseDown = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 100; // 100px for labels
        const time = Math.max(0, Math.min(duration, x / zoom));
        onTimeChange(time);

        const handleMouseMove = (moveEvent) => {
            const moveRect = containerRef.current.getBoundingClientRect();
            const moveX = moveEvent.clientX - moveRect.left - 100;
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

    const handleKeyframeDragStart = (e, layerName, behaviorIndex, behaviors) => {
        e.stopPropagation();
        setDraggingKeyframe({ layerName, behaviorIndex, behaviors });

        const handleMouseMove = (moveEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = moveEvent.clientX - rect.left;
            const newTime = Math.max(0, Math.min(duration, x / zoom));

            // Update visual position during drag (optimistic)
            if (onKeyframeMove) {
                onKeyframeMove(layerName, behaviorIndex, newTime, false); // false = preview only
            }
        };

        const handleMouseUp = (upEvent) => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            if (containerRef.current && onKeyframeMove) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = upEvent.clientX - rect.left;
                const newTime = Math.max(0, Math.min(duration, x / zoom));
                onKeyframeMove(layerName, behaviorIndex, newTime, true); // true = commit
            }

            setDraggingKeyframe(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div style={{
            background: '#1e1e1e',
            borderTop: '1px solid #333',
            height: '200px',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none'
        }}>
            {/* Toolbar */}
            <div style={{
                height: '32px',
                borderBottom: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: '8px',
                background: '#252525'
            }}>
                <button className="btn-icon" onClick={onPlayPause}>
                    <Icon name={isPlaying ? "delete" : "generate"} size={14} />
                    {isPlaying ? "Pause" : "Play"}
                </button>
                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', minWidth: '60px' }}>
                    {currentTime.toFixed(2)}s / {duration}s
                </span>
                <div style={{ flex: 1 }}></div>
                <input
                    type="range"
                    min="5"
                    max="100"
                    value={zoom}
                    onChange={e => setZoom(parseInt(e.target.value))}
                    style={{ width: '100px' }}
                />
            </div>

            {/* Timeline Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Labels Column */}
                <div style={{
                    width: '100px',
                    borderRight: '1px solid #333',
                    background: '#222',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'hidden' // Sync scroll later?
                }}>
                    <div style={{ height: '24px', borderBottom: '1px solid #444' }}></div> {/* Ruler header spacer */}
                    {layers.map((l, i) => (
                        <div key={l.sprite_name} style={{
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            fontSize: '0.75rem',
                            background: selectedLayer === l.sprite_name ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                            borderBottom: '1px solid #333',
                            color: '#ccc',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {l.sprite_name}
                        </div>
                    ))}
                </div>

                {/* Ruler and Tracks */}
                <div
                    ref={containerRef}
                    style={{
                        flex: 1,
                        overflowX: 'auto',
                        overflowY: 'auto',
                        position: 'relative',
                        cursor: 'crosshair'
                    }}
                >
                    <div style={{ width: duration * zoom + 50, height: '100%' }}>
                        {/* Playhead */}
                        <div style={{
                            position: 'absolute',
                            left: currentTime * zoom,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: '#ef4444',
                            zIndex: 10,
                            pointerEvents: 'none'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: '-4px',
                                width: '10px',
                                height: '10px',
                                background: '#ef4444',
                                transform: 'rotate(45deg)'
                            }}></div>
                        </div>

                        {/* Ruler */}
                        <div
                            style={{ height: '24px', borderBottom: '1px solid #444', position: 'sticky', top: 0, background: '#1e1e1e', zIndex: 5 }}
                            onMouseDown={handleMouseDown}
                        >
                            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, sec) => (
                                <div key={sec} style={{ position: 'absolute', left: sec * zoom, top: 12, fontSize: '0.6rem', color: '#666' }}>
                                    <div style={{ position: 'absolute', top: -12, left: 0, height: '6px', borderLeft: '1px solid #666' }}></div>
                                    {sec}s
                                </div>
                            ))}
                        </div>

                        {/* Tracks */}
                        {layers.map((l, i) => (
                            <div key={l.sprite_name} style={{
                                height: '28px',
                                borderBottom: '1px solid #333',
                                position: 'relative',
                                background: selectedLayer === l.sprite_name ? 'rgba(139, 92, 246, 0.05)' : 'transparent'
                            }}>
                                {/* Render keyframes if any */}
                                {(l.behaviors || []).filter(b => b.type === 'location' && b.time_offset !== undefined).map((b, idx) => {
                                    const behaviorIndex = (l.behaviors || []).indexOf(b);
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                position: 'absolute',
                                                left: b.time_offset * zoom,
                                                top: '8px',
                                                width: '12px',
                                                height: '12px',
                                                background: '#ec4899',
                                                borderRadius: '50%',
                                                zIndex: 2,
                                                transform: 'translateX(-50%)',
                                                border: '2px solid #fff',
                                                cursor: 'grab',
                                                boxShadow: draggingKeyframe?.layerName === l.sprite_name && draggingKeyframe?.behaviorIndex === behaviorIndex
                                                    ? '0 0 8px rgba(236, 72, 153, 0.8)'
                                                    : 'none'
                                            }}
                                            title={`Keyframe at ${b.time_offset.toFixed(2)}s (drag to move)`}
                                            onMouseDown={(e) => handleKeyframeDragStart(e, l.sprite_name, behaviorIndex, l.behaviors)}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
