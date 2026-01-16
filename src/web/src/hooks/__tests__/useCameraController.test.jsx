import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCameraController } from '../useCameraController';

// Mock CameraController class
const mockControllerInstance = {
    state: { zoom: 1, pan: { x: 0, y: 0 } },
    zoom: 1,
    subscribe: vi.fn(() => vi.fn()),
    bindTheatre: vi.fn(),
    applyToTheatre: vi.fn(),
    setZoom: vi.fn(),
    setPan: vi.fn(),
    pan: vi.fn(),
    reset: vi.fn()
};

vi.mock('../../engine/CameraController.js', () => ({
    CameraController: vi.fn(function () { return mockControllerInstance; })
}));

// Mock usePersistentState
vi.mock('../usePersistentState', () => ({
    usePersistentState: (key, defaultValue) => {
        // Simple mock implementation using a variable closure isn't perfect for hooks,
        // but for this test we mainly want to intercept the set call or initial value.
        // Better: mock the hook to return [value, setter]
        return [defaultValue, vi.fn()];
    }
}));

describe('useCameraController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockControllerInstance.state = { zoom: 1, pan: { x: 0, y: 0 } };
        mockControllerInstance.zoom = 1;
    });

    it('initializes controller', () => {
        const { result } = renderHook(() => useCameraController());
        expect(result.current.controller).toBe(mockControllerInstance);
        expect(result.current.zoom).toBe(1);
    });

    it('binds theatre if provided', () => {
        const mockTheatre = { studio: {} };
        renderHook(() => useCameraController(mockTheatre));
        expect(mockControllerInstance.bindTheatre).toHaveBeenCalledWith(mockTheatre);
        expect(mockControllerInstance.applyToTheatre).toHaveBeenCalled();
    });

    it('calls control methods', () => {
        const { result } = renderHook(() => useCameraController());

        act(() => {
            result.current.setZoom(2);
        });
        expect(mockControllerInstance.setZoom).toHaveBeenCalledWith(2, null, null, null);

        act(() => {
            result.current.zoomIn();
        });
        // zoomIn calls setZoom(current * 1.2)
        expect(mockControllerInstance.setZoom).toHaveBeenCalledWith(1.2, null, null, null);

        act(() => {
            result.current.setPan(10, 20);
        });
        expect(mockControllerInstance.setPan).toHaveBeenCalledWith(10, 20);

        act(() => {
            result.current.pan(5, 5);
        });
        expect(mockControllerInstance.pan).toHaveBeenCalledWith(5, 5);

        act(() => {
            result.current.reset();
        });
        expect(mockControllerInstance.reset).toHaveBeenCalled();
    });

    it('handles wheel events for zoom (adaptive)', () => {
        const { result } = renderHook(() => useCameraController());

        const mockCanvas = {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
        };

        const mockEvent = {
            preventDefault: vi.fn(),
            ctrlKey: true,
            deltaY: -100, // Zoom in
            clientX: 50,
            clientY: 50
        };

        act(() => {
            result.current.handleWheel(mockEvent, mockCanvas);
        });

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        // Check if setZoom was called (adaptive logic calculation is internal, but setZoom must be called)
        expect(mockControllerInstance.setZoom).toHaveBeenCalled();
    });

    it('handles wheel events for pan (no Ctrl)', () => {
        const { result } = renderHook(() => useCameraController());

        const mockCanvas = {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
        };

        const mockEvent = {
            preventDefault: vi.fn(),
            ctrlKey: false,
            deltaX: 10,
            deltaY: 20
        };

        act(() => {
            result.current.handleWheel(mockEvent, mockCanvas);
        });

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockControllerInstance.pan).toHaveBeenCalledWith(10, 20);
    });
});
