import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResizable, useResizableRatio } from '../useResizable';

describe('useResizable', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(document, 'addEventListener');
        vi.spyOn(document, 'removeEventListener');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with default size', () => {
        const { result } = renderHook(() => useResizable('test-key', 200));
        expect(result.current.size).toBe(200);
    });

    it('loads persisted size', () => {
        localStorage.setItem('test-key', '300');
        const { result } = renderHook(() => useResizable('test-key', 200));
        expect(result.current.size).toBe(300);
    });

    it('handles resize interactions', () => {
        const { result } = renderHook(() => useResizable('test-key', 200, { min: 100, max: 500 }));

        // Start resizing
        const mockEvent = { preventDefault: vi.fn(), clientX: 100 };
        act(() => {
            result.current.startResize(mockEvent);
        });

        expect(result.current.isResizing).toBe(true);
        expect(document.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
        expect(document.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));

        // Simulate mouse move
        const moveEvent = new MouseEvent('mousemove', { clientX: 150 });
        act(() => {
            document.dispatchEvent(moveEvent);
        });

        // 200 + (150 - 100) = 250
        expect(result.current.size).toBe(250);

        // Simulate mouse up
        const upEvent = new MouseEvent('mouseup');
        act(() => {
            document.dispatchEvent(upEvent);
        });

        expect(result.current.isResizing).toBe(false);
    });

    it('respects min/max constraints', () => {
        const { result } = renderHook(() => useResizable('test-key', 200, { min: 100, max: 300 }));

        act(() => {
            result.current.startResize({ preventDefault: vi.fn(), clientX: 0 });
        });

        // Try to go below min
        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: -200 }));
        });
        expect(result.current.size).toBe(100);

        // Try to go above max
        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
        });
        expect(result.current.size).toBe(300);
    });
});

describe('useResizableRatio', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('initializes with default ratio', () => {
        const { result } = renderHook(() => useResizableRatio('test-ratio', 0.5));
        expect(result.current.ratio).toBe(0.5);
    });

    it('handles ratio resizing', () => {
        const { result } = renderHook(() => useResizableRatio('test-ratio', 0.5));

        const mockContainer = {
            getBoundingClientRect: () => ({ width: 1000, height: 500 })
        };

        // Start resize at x=500 (middle of 1000px container)
        act(() => {
            result.current.startResize(
                { preventDefault: vi.fn(), clientX: 500 },
                mockContainer
            );
        });

        // Move 100px to right -> +0.1 change in ratio (100/1000)
        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }));
        });

        expect(result.current.ratio).toBeCloseTo(0.6);
    });
});
