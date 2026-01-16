import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDraggable } from '../useDraggable';
import React from 'react';

// Mock usePersistentState to behave exactly like useState for testing purposes
vi.mock('../usePersistentState', () => ({
    usePersistentState: (key, initial) => React.useState(initial)
}));

describe('useDraggable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with default position', () => {
        const { result } = renderHook(() => useDraggable('key', { x: 0, y: 0 }));
        expect(result.current.position).toEqual({ x: 0, y: 0 });
        expect(result.current.isDragging).toBe(false);
    });

    it('handles full drag interaction', () => {
        const { result } = renderHook(() => useDraggable('key', { x: 0, y: 0 }, { constrainToParent: false }));

        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 100
        };
        const mockElement = { getBoundingClientRect: () => ({ left: 50, top: 50, width: 50, height: 50 }) };
        const mockParent = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }) };

        // 1. Start Drag
        act(() => {
            result.current.startDrag(mockEvent, mockElement, mockParent);
        });
        expect(result.current.isDragging).toBe(true);

        // 2. Move Mouse (10px right, 10px down)
        // Initial mouse: 100, 100. New mouse: 110, 110.
        // Initial elem relative: 50, 50.
        // New Pos should be 50 + 10 = 60
        act(() => {
            const moveEvent = new MouseEvent('mousemove', { clientX: 110, clientY: 110 });
            document.dispatchEvent(moveEvent);
        });

        expect(result.current.position).toEqual({ x: 60, y: 60 });

        // 3. Stop Drag
        act(() => {
            const upEvent = new MouseEvent('mouseup', {});
            document.dispatchEvent(upEvent);
        });

        expect(result.current.isDragging).toBe(false);
    });

    it('constrains drag to parent', () => {
        const { result } = renderHook(() => useDraggable('key', { x: 0, y: 0 }, { constrainToParent: true }));

        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 100
        };
        const mockElement = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 50, height: 50 }) };
        const mockParent = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) };

        act(() => {
            result.current.startDrag(mockEvent, mockElement, mockParent);
        });

        // Move way out of bounds (500px right)
        act(() => {
            const moveEvent = new MouseEvent('mousemove', { clientX: 600, clientY: 100 });
            document.dispatchEvent(moveEvent);
        });

        // Parent width 200, elem width 50 -> max X = 150
        expect(result.current.position.x).toBe(150);
    });

    it('resets position', () => {
        const { result } = renderHook(() => useDraggable('key', { x: 0, y: 0 }));

        // Manually set position (simulating drag or other update)
        act(() => {
            result.current.setPosition({ x: 100, y: 100 });
        });
        expect(result.current.position).toEqual({ x: 100, y: 100 });

        act(() => {
            result.current.reset();
        });
        expect(result.current.position).toEqual({ x: 0, y: 0 });
    });
});
