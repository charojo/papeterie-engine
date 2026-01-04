import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

// Define stable empty array for default prop to avoid infinite effect loops
const EMPTY_BEHAVIORS = [];

export const ImageViewer = ({
    mainSrc,
    alt,
    isOptimizing,
    tabs = [],
    actions,
    isExpanded,
    toggleExpand,
    onSaveRotation,
    behaviors = EMPTY_BEHAVIORS
}) => {
    // console.log removed
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const imgRef = useRef(null);
    const containerRef = useRef(null);
    const scaleRef = useRef(1);
    const [isPlayingBehaviors, setIsPlayingBehaviors] = useState(false);
    const [behaviorOffsets, setBehaviorOffsets] = useState({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    const requestRef = useRef();
    const startTimeRef = useRef();

    // Sync scaleRef for event listener
    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);

    // Reset Scale (Fit) when toggling view mode

    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setRotation(0);
    }, [isExpanded]);

    // Reset Position (but preserve Scale) when image changes

    useEffect(() => {
        setPosition({ x: 0, y: 0 });
        setRotation(0);
        // Persistence: We intentionally do NOT reset isPlayingBehaviors here
    }, [mainSrc]);

    // Behavior Preview Animation Loop
    useEffect(() => {
        const animate = (time) => {
            if (!startTimeRef.current) startTimeRef.current = time;
            const elapsed = (time - startTimeRef.current) / 1000; // seconds

            const offsets = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

            behaviors.forEach(b => {
                if (!b.enabled) return;

                if (b.type === 'oscillate') {
                    const phase = (elapsed * b.frequency * 2 * Math.PI) + (b.phase_offset || 0);
                    const val = Math.sin(phase) * b.amplitude;

                    if (b.coordinate === 'y') offsets.y += val;
                    else if (b.coordinate === 'x') offsets.x += val;
                    else if (b.coordinate === 'scale') offsets.scale += val / 100;
                    else if (b.coordinate === 'rotation') offsets.rotation += val;
                } else if (b.type === 'pulse') {
                    const cycle = (elapsed * b.frequency) % 1.0;
                    let value = 0;
                    if (b.waveform === 'sine') {
                        value = (Math.sin(cycle * 2 * Math.PI) + 1) / 2;
                    } else if (b.waveform === 'spike') {
                        value = Math.pow((Math.sin(cycle * 2 * Math.PI) + 1.0) / 2.0, 10);
                    }
                    const factor = b.min_value + (value * (b.max_value - b.min_value));

                    if (b.coordinate === 'opacity') offsets.opacity *= factor;
                    else if (b.coordinate === 'scale') offsets.scale *= factor;
                } else if (b.type === 'drift') {
                    // Drift is cumulative: use total elapsed time, not delta
                    const val = (b.velocity || 0) * elapsed;
                    if (b.coordinate === 'y') offsets.y += val;
                    else if (b.coordinate === 'x') offsets.x += val;
                    else if (b.coordinate === 'scale') offsets.scale += val / 100;
                }
            });

            setBehaviorOffsets(offsets);
            requestRef.current = requestAnimationFrame(animate);
        };

        if (isPlayingBehaviors && behaviors.length > 0) {
            startTimeRef.current = null; // Reset start time
            requestRef.current = requestAnimationFrame(animate);
        } else {
            setBehaviorOffsets({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlayingBehaviors, behaviors]);

    const clampPosition = (x, y, s) => {
        const container = containerRef.current;
        if (!container) return { x, y };

        const { width, height } = container.getBoundingClientRect();
        // Limit calculation: |tx| <= (dim * (scale - 1)) / 2
        // If scale <= 1, limit is 0.
        const limitX = (width * (s - 1)) / 2;
        const limitY = (height * (s - 1)) / 2;

        // Ensure strictly positive limits or zero
        const maxX = Math.max(0, limitX);
        const maxY = Math.max(0, limitY);

        return {
            x: Math.max(-maxX, Math.min(x, maxX)),
            y: Math.max(-maxY, Math.min(y, maxY))
        };
    };

    // Position Ref for stable access in event listener
    const positionRef = useRef({ x: 0, y: 0 });
    useEffect(() => { positionRef.current = position; }, [position]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e) => {
            const currentScale = scaleRef.current;
            const currentPos = positionRef.current;

            const isZooming = e.ctrlKey;
            const isPanning = currentScale > 1;

            if (isZooming || isPanning) {
                e.preventDefault();
            }

            if (isZooming) {
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left - rect.width / 2;
                const mouseY = e.clientY - rect.top - rect.height / 2;

                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.min(Math.max(1, currentScale * delta), 10);

                const ratio = newScale / currentScale;
                // Use currentPos from ref
                const stableX = mouseX - (mouseX - currentPos.x) * ratio;
                const stableY = mouseY - (mouseY - currentPos.y) * ratio;

                const clamped = clampPosition(stableX, stableY, newScale);

                setPosition(clamped);
                setScale(newScale);
            } else if (isPanning) {
                // Use functional update or ref based calculation
                const nextX = currentPos.x - e.deltaX;
                const nextY = currentPos.y - e.deltaY;
                const clamped = clampPosition(nextX, nextY, currentScale);
                setPosition(clamped);
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []); // Refs are stable

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const rawX = e.clientX - dragStartRef.current.x;
        const rawY = e.clientY - dragStartRef.current.y;

        const clamped = clampPosition(rawX, rawY, scale);
        setPosition(clamped);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const zoomIn = () => {
        const currentScale = scale;
        const newScale = Math.min(currentScale * 1.2, 10);
        const ratio = newScale / currentScale;

        // Naive center zoom calculation
        const rawX = position.x * ratio;
        const rawY = position.y * ratio;

        const clamped = clampPosition(rawX, rawY, newScale);
        setPosition(clamped);
        setScale(newScale);
    };

    const zoomOut = () => {
        const currentScale = scale;
        const newScale = Math.max(1, currentScale / 1.2);
        const ratio = newScale / currentScale;

        const rawX = position.x * ratio;
        const rawY = position.y * ratio;

        const clamped = clampPosition(rawX, rawY, newScale);
        setPosition(clamped);
        setScale(newScale);
    };



    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: isExpanded ? '100%' : 'auto' }}>
            {/* Main Image Container */}
            <div
                ref={containerRef}
                className="card glass"
                style={{
                    position: 'relative',
                    padding: 0,
                    overflow: 'hidden',
                    width: '100%',
                    flex: isExpanded ? 1 : undefined,
                    minHeight: isExpanded ? 0 : '200px', // Allow shrinking in flex if expanded
                    aspectRatio: isExpanded ? undefined : '16/9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--color-bg-base)',
                    cursor: isDragging ? 'grabbing' : (scale > 1 ? 'grab' : 'default'),
                    userSelect: 'none'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {mainSrc ? (
                    <img
                        ref={imgRef}
                        src={mainSrc}
                        alt={alt}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            translate: `${position.x + behaviorOffsets.x}px ${position.y + behaviorOffsets.y}px`,
                            scale: `${scale * behaviorOffsets.scale}`,
                            rotate: `${rotation + behaviorOffsets.rotation}deg`,
                            opacity: behaviorOffsets.opacity,
                            transition: (isDragging || isRotating || isPlayingBehaviors) ? 'none' : 'translate 0.1s ease-out, scale 0.1s ease-out, rotate 0.1s ease-out',
                            pointerEvents: 'none' // Let container handle events
                        }}
                    />
                ) : <span style={{ opacity: 0.5 }}>No Image</span>}

                {/* Overlays */}
                {isOptimizing && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                        <Icon name="optimize" className="animate-spin" />
                    </div>
                )}

                {/* Floating Controls (Zoom/Expand) */}
                <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    display: 'flex', gap: '8px', zIndex: 10
                }}>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden' }}>
                        <button onClick={zoomOut} className="btn-icon" title="Zoom Out" style={{ borderRadius: 0, borderRight: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
                            <Icon name="zoomOut" size={16} />
                        </button>
                        <button onClick={zoomIn} className="btn-icon" title="Zoom In" style={{ borderRadius: 0, color: 'white' }}>
                            <Icon name="zoomIn" size={16} />
                        </button>
                    </div>

                    {/* Behavior Playback Control */}
                    {behaviors.length > 0 && (
                        <button
                            onClick={() => setIsPlayingBehaviors(!isPlayingBehaviors)}
                            className={`btn-icon ${isPlayingBehaviors ? 'active' : ''}`}
                            title={isPlayingBehaviors ? "Stop Preview" : "Play Preview"}
                            style={{
                                background: isPlayingBehaviors ? 'var(--color-primary)' : 'rgba(0,0,0,0.6)',
                                border: 'none', borderRadius: '4px',
                                color: isPlayingBehaviors ? 'var(--color-text-on-primary)' : 'white',
                                padding: '6px'
                            }}
                        >
                            <Icon name={isPlayingBehaviors ? "pause" : "play"} size={16} />
                        </button>
                    )}

                    {/* Fine Rotation Slider */}
                    <div
                        onMouseDown={(e) => { e.stopPropagation(); setIsRotating(true); }}
                        onMouseUp={() => setIsRotating(false)}
                        onMouseLeave={() => setIsRotating(false)}
                        style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-surface-2)', padding: '0 8px', height: '100%', minHeight: '32px' }}
                    >
                        <input
                            type="range"
                            min="-180"
                            max="180"
                            value={rotation}
                            onChange={(e) => setRotation(parseInt(e.target.value))}
                            style={{ width: '80px', cursor: 'grab' }}
                        />
                        <span style={{ fontSize: '10px', marginLeft: '4px', width: '24px', textAlign: 'right' }}>{rotation}°</span>
                    </div>
                    {onSaveRotation && (
                        <button
                            onClick={() => onSaveRotation(rotation)}
                            disabled={rotation === 0}
                            className={`btn-icon ${rotation === 0 ? 'disabled' : ''}`}
                            title="Save Rotation"
                            style={{
                                borderRadius: 0,
                                borderLeft: '1px solid rgba(255,255,255,0.2)',
                                background: rotation === 0 ? 'rgba(255,255,255,0.1)' : 'var(--color-primary)',
                                opacity: rotation === 0 ? 0.3 : 1,
                                cursor: rotation === 0 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <Icon name="save" size={16} />
                        </button>
                    )}

                    <button
                        onClick={toggleExpand}
                        className="btn-icon"
                        style={{
                            background: isExpanded ? 'var(--color-primary)' : 'rgba(0,0,0,0.6)',
                            border: 'none', borderRadius: '4px',
                            color: isExpanded ? 'var(--color-text-on-primary)' : 'white', cursor: 'pointer',
                        }}
                        title={isExpanded ? "Minimize" : "Maximize (Zen Mode)"}
                    >
                        <Icon name={isExpanded ? "close" : "maximize"} size={16} />
                    </button>
                </div>

                {/* Reset View Button (only shows if tweaked) */}
                {(scale !== 1 || position.x !== 0 || position.y !== 0 || rotation !== 0) && (
                    <button
                        onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); setRotation(0); }}
                        style={{
                            position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '20px',
                            color: 'var(--color-text-main)', padding: '4px 12px', fontSize: '0.75rem', cursor: 'pointer', zIndex: 10
                        }}
                    >
                        Reset View
                    </button>
                )}
            </div>

            {/* Controls Bar: Tabs & Actions */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                flexShrink: 0,
                padding: isExpanded ? '16px' : '0'
            }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {tabs.map(tab => (
                        <div key={tab.id}
                            onClick={tab.onClick}
                            style={{
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: tab.isActive ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                                color: tab.isActive ? 'var(--color-text-on-primary)' : 'var(--color-text-main)',
                                fontSize: '0.75rem',
                                fontWeight: tab.isActive ? '600' : '400',
                                border: tab.isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {tab.isSprite && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); tab.onToggleVisibility?.(); }}
                                    title={tab.isVisible ? 'Hide sprite' : 'Show sprite'}
                                    className="btn-icon"
                                    style={{
                                        padding: 0,
                                        width: 'auto',
                                        height: 'auto',
                                        opacity: tab.isVisible ? 0.7 : 0.5,
                                        color: 'currentColor',
                                        background: 'transparent'
                                    }}
                                >
                                    <Icon name={tab.isVisible ? "visible" : "hidden"} size={12} />
                                </button>
                            )}
                            <span style={{ opacity: (tab.isSprite && !tab.isVisible) ? 0.5 : 1 }}>
                                {tab.label}
                            </span>
                            {tab.isSprite && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); tab.onDelete?.(); }}
                                    title="Remove from scene"
                                    className="btn-icon"
                                    style={{
                                        marginLeft: '2px',
                                        opacity: 0.5,
                                        padding: 0,
                                        width: 'auto',
                                        height: 'auto',
                                        color: 'currentColor',
                                        background: 'transparent'
                                    }}
                                >
                                    <Icon name="close" size={10} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {actions}
                </div>
            </div>

            {/* Inline Styles for btn-icon helper */}
            {/* Styles moved to global CSS */}
        </div>
    );
};
