import { useState, useEffect, useCallback, useRef } from 'react';
import { usePersistentState } from './usePersistentState';

/**
 * Hook for creating resizable panels with persistent size.
 * 
 * @param {string} storageKey - localStorage key for persistence
 * @param {number} initialSize - Initial size (percentage or pixels based on usage)
 * @param {Object} options - Configuration options
 * @param {number} options.min - Minimum size
 * @param {number} options.max - Maximum size  
 * @param {'horizontal'|'vertical'} options.direction - Resize direction
 * @returns {Object} - { size, isResizing, startResize, handleRef }
 */
export function useResizable(storageKey, initialSize, options = {}) {
    const { min = 100, max = Infinity, direction = 'horizontal' } = options;

    const [size, setSize] = usePersistentState(storageKey, initialSize);
    const [isResizing, setIsResizing] = useState(false);
    const startPosRef = useRef(0);
    const startSizeRef = useRef(size);
    const containerRef = useRef(null);

    const startResize = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
        startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
        startSizeRef.current = size;
    }, [direction, size]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e) => {
            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = currentPos - startPosRef.current;
            const newSize = Math.max(min, Math.min(max, startSizeRef.current + delta));
            setSize(newSize);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, direction, min, max, setSize]);

    const reset = useCallback(() => {
        setSize(initialSize);
    }, [initialSize, setSize]);

    return {
        size,
        setSize,
        isResizing,
        startResize,
        containerRef,
        reset
    };
}

/**
 * Hook for resizable panels using percentage-based sizing.
 * More suitable for flex/grid layouts.
 * 
 * @param {string} storageKey - localStorage key for persistence
 * @param {number} initialRatio - Initial ratio (0-1, e.g., 0.67 for 2:1 split)
 * @param {Object} options - Configuration options
 * @param {number} options.minRatio - Minimum ratio (default 0.2)
 * @param {number} options.maxRatio - Maximum ratio (default 0.8)
 * @param {'horizontal'|'vertical'} options.direction - Resize direction
 * @returns {Object} - { ratio, isResizing, startResize, reset }
 */
export function useResizableRatio(storageKey, initialRatio, options = {}) {
    const { minRatio = 0.2, maxRatio = 0.8, direction = 'horizontal' } = options;

    const [ratio, setRatio] = usePersistentState(storageKey, initialRatio);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef(null);
    const startPosRef = useRef(0);
    const startRatioRef = useRef(ratio);

    const startResize = useCallback((e, container) => {
        e.preventDefault();
        const mousePos = direction === 'horizontal' ? e.clientX : e.clientY;
        console.log(`[useResizableRatio:${storageKey}] startResize called`, {
            container: container,
            containerExists: !!container,
            direction,
            currentRatio: ratio,
            mousePos
        });
        setIsResizing(true);
        startPosRef.current = mousePos;
        startRatioRef.current = ratio;  // Capture current ratio at start of drag
        containerRef.current = container;
    }, [direction, ratio, storageKey]);

    useEffect(() => {
        if (!isResizing) return;

        console.log(`[useResizableRatio:${storageKey}] Resize started, attaching listeners`);

        const handleMouseMove = (e) => {
            if (!containerRef.current) {
                console.warn(`[useResizableRatio:${storageKey}] No container ref!`);
                return;
            }

            const containerRect = containerRef.current.getBoundingClientRect();
            const containerSize = direction === 'horizontal'
                ? containerRect.width
                : containerRect.height;

            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;

            // Calculate delta-based ratio change to avoid jumps on start
            const delta = currentPos - startPosRef.current;
            const deltaRatio = delta / containerSize;
            const rawRatio = startRatioRef.current + deltaRatio;
            const newRatio = Math.max(minRatio, Math.min(maxRatio, rawRatio));

            console.log(`[useResizableRatio:${storageKey}] mousemove`, {
                containerSize,
                startPos: startPosRef.current,
                currentPos,
                delta,
                startRatio: startRatioRef.current.toFixed(3),
                deltaRatio: deltaRatio.toFixed(3),
                rawRatio: rawRatio.toFixed(3),
                clampedRatio: newRatio.toFixed(3)
            });

            setRatio(newRatio);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            containerRef.current = null;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Prevent text selection while resizing
        document.body.style.userSelect = 'none';
        document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isResizing, direction, minRatio, maxRatio, setRatio, storageKey]);

    const reset = useCallback(() => {
        setRatio(initialRatio);
    }, [initialRatio, setRatio]);

    return {
        ratio,
        setRatio,
        isResizing,
        startResize,
        reset
    };
}
