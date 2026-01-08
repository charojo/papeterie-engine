import { useState, useEffect, useCallback, useRef } from 'react';
import { usePersistentState } from './usePersistentState';

/**
 * Hook for creating draggable elements with persistent position.
 * 
 * @param {string} storageKey - localStorage key for persistence
 * @param {Object} initialPosition - Initial position { x, y } or null for default positioning
 * @param {Object} options - Configuration options
 * @param {boolean} options.constrainToParent - Keep element within parent bounds
 * @returns {Object} - { position, isDragging, startDrag, dragHandleProps, reset }
 */
export function useDraggable(storageKey, initialPosition = null, options = {}) {
    const { constrainToParent = true } = options;

    const [position, setPosition] = usePersistentState(storageKey, initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, elemX: 0, elemY: 0 });
    const elementRef = useRef(null);
    const parentRef = useRef(null);

    const startDrag = useCallback((e, element, parent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsDragging(true);
        elementRef.current = element;
        parentRef.current = parent;

        const rect = element.getBoundingClientRect();
        const parentRect = parent?.getBoundingClientRect() || { left: 0, top: 0 };

        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            elemX: rect.left - parentRect.left,
            elemY: rect.top - parentRect.top
        };
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            const deltaX = e.clientX - dragStartRef.current.mouseX;
            const deltaY = e.clientY - dragStartRef.current.mouseY;

            let newX = dragStartRef.current.elemX + deltaX;
            let newY = dragStartRef.current.elemY + deltaY;

            // Constrain to parent bounds
            if (constrainToParent && parentRef.current && elementRef.current) {
                const parentRect = parentRef.current.getBoundingClientRect();
                const elemRect = elementRef.current.getBoundingClientRect();

                const maxX = parentRect.width - elemRect.width;
                const maxY = parentRect.height - elemRect.height;

                newX = Math.max(0, Math.min(maxX, newX));
                newY = Math.max(0, Math.min(maxY, newY));
            }

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            elementRef.current = null;
            parentRef.current = null;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, constrainToParent, setPosition]);

    const reset = useCallback(() => {
        setPosition(initialPosition);
    }, [initialPosition, setPosition]);

    // Props to spread on the drag handle element
    const dragHandleProps = {
        style: { cursor: isDragging ? 'grabbing' : 'grab' },
        onMouseDown: (_e) => {
            // The element and parent refs must be passed at call time
            // This is a convenience for simpler cases
        }
    };

    return {
        position,
        setPosition,
        isDragging,
        startDrag,
        dragHandleProps,
        reset
    };
}
