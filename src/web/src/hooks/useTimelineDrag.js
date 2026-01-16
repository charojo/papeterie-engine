import { useState } from 'react';


import { createLogger } from '../utils/logger';

const log = createLogger('useTimelineDrag');

export function useTimelineDrag({
    containerRef,
    zoom,
    duration,
    sortedZDepths,
    onKeyframeMove,
    onLayerUpdate,
    TRACK_HEIGHT = 34,
    RULER_HEIGHT = 24,
    PADDING_LEFT = 40

}) {
    const [draggingKeyframe, setDraggingKeyframe] = useState(null);

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
                log.debug('Drag started', { item: item.key, type: item.type });
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

            log.debug('Drag end', { dx, dy });

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
                        finalZ = Math.max(1, (upperZ + lowerZ) / 2);
                        log.debug('Creating midpoint Z:', { finalZ });
                    } else {
                        // Snap to nearest lane
                        finalZ = Math.max(1, sortedZDepths[trackIndex]);
                        log.debug('Snapping to lane (no midpoint):', { finalZ });
                    }
                } else if (trackIndex >= 0 && trackIndex < sortedZDepths.length) {
                    // Snap to existing lane
                    finalZ = Math.max(1, sortedZDepths[trackIndex]);
                    log.debug('Snapping to existing lane:', { trackIndex, finalZ });
                } else {
                    log.warn('Track index out of bounds:', { trackIndex, numLanes: sortedZDepths.length });
                }
            }

            log.debug('Final Result:', { spriteName: item.sprite.sprite_name, finalZ, newTime });

            // 3. Commit Changes
            if (item.type === 'behavior' || (item.type === 'base' && item.behaviorIndex !== null)) {
                // Update Time if changed (or always if calling onKeyframeMove)
                if (newTime !== initialTime) {
                    log.debug(`Moving keyframe for ${item.type}`);
                    onKeyframeMove && onKeyframeMove(item.sprite.sprite_name, item.behaviorIndex, newTime, true);
                }

                // Update Z if changed
                if (finalZ !== initialZ && onLayerUpdate) {
                    log.debug('Updating Z-depth for keyframe:', finalZ);
                    onLayerUpdate(item.sprite.sprite_name, {
                        z_depth: finalZ,
                        behaviorIndex: item.behaviorIndex
                    });
                }
            } else if (item.type === 'base') {
                // Base Item with no behaviorIndex (update sprite-level Z only)
                if (finalZ !== initialZ && onLayerUpdate) {
                    log.debug('Updating Z-depth for sprite:', finalZ);
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

    return {
        handleItemDragStart,
        draggingKeyframe
    };
}
