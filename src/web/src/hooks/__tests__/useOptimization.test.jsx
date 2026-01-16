
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOptimization } from '../useOptimization';
import { toast } from 'sonner';

// Mock Dependencies
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

vi.mock('../../config', () => ({
    API_BASE: 'http://localhost:8000/api'
}));

describe('useOptimization', () => {
    let mockRefresh;
    let mockAsset;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRefresh = vi.fn();
        mockAsset = { name: 'testAsset' };
        global.fetch = vi.fn();
        // Default confirm to true
        window.confirm = vi.fn(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('handles sprite processing (Optimize)', async () => {
        const { result } = renderHook(() => useOptimization('sprite', mockAsset, mockRefresh));

        global.fetch.mockResolvedValueOnce({ ok: true });

        await act(async () => {
            await result.current.handleOptimize();
        });

        // Verify loading state cycle (hard to verify intermediate state without manual Promise, but we check final state)
        expect(result.current.isOptimizing).toBe(false);

        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/sprites/testAsset/process',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ optimize: true, remove_background: true })
            })
        );
        expect(toast.success).toHaveBeenCalledWith('Transformation Complete');
        expect(mockRefresh).toHaveBeenCalled();
    });

    it('handles scene optimization (LLM)', async () => {
        const { result } = renderHook(() => useOptimization('scene', mockAsset, mockRefresh));

        act(() => {
            result.current.setVisualPrompt('make it sunny');
            result.current.setProcessingMode('llm');
        });

        global.fetch.mockResolvedValueOnce({ ok: true });

        await act(async () => {
            await result.current.handleOptimize();
        });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/scenes/testAsset/optimize',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ prompt_guidance: 'make it sunny', processing_mode: 'llm' })
            })
        );
    });

    it('handles optimization error', async () => {
        const { result } = renderHook(() => useOptimization('sprite', mockAsset, mockRefresh));

        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ detail: 'Backend Error' })
        });

        await act(async () => {
            await result.current.handleOptimize();
        });

        expect(toast.error).toHaveBeenCalledWith('Backend Error');
        expect(result.current.isOptimizing).toBe(false);
    });

    it('handles revert (Success)', async () => {
        const { result } = renderHook(() => useOptimization('sprite', mockAsset, mockRefresh));

        global.fetch.mockResolvedValueOnce({ ok: true });

        await act(async () => {
            await result.current.handleRevert();
        });

        expect(window.confirm).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/sprites/testAsset/revert',
            { method: 'POST' }
        );
        expect(toast.success).toHaveBeenCalledWith('Reverted to original');
        expect(mockRefresh).toHaveBeenCalled();
    });

    it('handles revert (Cancel)', async () => {
        window.confirm.mockReturnValueOnce(false);
        const { result } = renderHook(() => useOptimization('sprite', mockAsset, mockRefresh));

        await act(async () => {
            await result.current.handleRevert();
        });

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles save rotation', async () => {
        const { result } = renderHook(() => useOptimization('sprite', mockAsset, mockRefresh));

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: 'Rotated' })
        });

        await act(async () => {
            await result.current.handleSaveRotation(90);
        });

        expect(window.confirm).toHaveBeenCalled(); // Should ask confirm
        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/sprites/testAsset/rotate',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ angle: 90 })
            })
        );
        expect(toast.success).toHaveBeenCalledWith('Rotated');
    });
});
