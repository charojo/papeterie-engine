import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransformEditor } from '../useTransformEditor';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../utils/Commands', () => ({
    UpdateConfigCommand: class {
        constructor(type, name, oldConfig, newConfig) {
            this.type = type;
            this.name = name;
            this.newConfig = newConfig;
            this.execute = vi.fn();
        }
    }
}));

global.fetch = vi.fn();

describe('useTransformEditor', () => {
    const mockAsset = {
        name: 'test-scene',
        config: {
            layers: [
                {
                    sprite_name: 'sprite1',
                    x_offset: 100,
                    y_offset: 100,
                    rotation: 0,
                    scale: 1,
                    behaviors: []
                }
            ]
        }
    };
    const mockRefresh = vi.fn();
    const mockExecuteCommand = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({})
        });
    });

    it('handles position change without command manager (direct fetch)', async () => {
        const { result } = renderHook(() => useTransformEditor(mockAsset, mockRefresh, null));

        await act(async () => {
            await result.current.handleSpritePositionChanged('sprite1', 200, 200, 0);
        });

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/test-scene/config'),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"x_offset":200')
            })
        );
        expect(mockRefresh).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalled();
    });

    it('handles position change with command manager', async () => {
        const { result } = renderHook(() => useTransformEditor(mockAsset, mockRefresh, mockExecuteCommand));

        await act(async () => {
            await result.current.handleSpritePositionChanged('sprite1', 300, 300, 0);
        });

        expect(mockExecuteCommand).toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('creates keyframe for position change when time > 0', async () => {
        const { result } = renderHook(() => useTransformEditor(mockAsset, mockRefresh, mockExecuteCommand));

        await act(async () => {
            await result.current.handleSpritePositionChanged('sprite1', 400, 400, 2.5);
        });

        // Verify the command argument contains the new keyframe
        const commandCall = mockExecuteCommand.mock.calls[0][0];
        const updatedLayer = commandCall.newConfig.layers[0];
        const keyframe = updatedLayer.behaviors.find(b => b.time_offset === 2.5);

        expect(keyframe).toBeDefined();
        expect(keyframe).toMatchObject({
            type: 'location',
            x: 400,
            y: 400,
            time_offset: 2.5
        });
    });

    it('handles rotation change', async () => {
        const { result } = renderHook(() => useTransformEditor(mockAsset, mockRefresh, null));

        await act(async () => {
            await result.current.handleSpriteRotationChanged('sprite1', 90, 0);
        });

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/test-scene/config'),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"rotation":90')
            })
        );
        expect(toast.success).not.toHaveBeenCalled(); // No toast for rotation in code
    });

    it('handles scale change', async () => {
        const { result } = renderHook(() => useTransformEditor(mockAsset, mockRefresh, null));

        await act(async () => {
            await result.current.handleSpriteScaleChanged('sprite1', 2.0, 0);
        });

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/test-scene/config'),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"scale":2')
            })
        );
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Updated base scale'));
    });

    it('handles keyframe move', async () => {
        const assetWithKeyframe = {
            ...mockAsset,
            config: {
                layers: [{
                    sprite_name: 'sprite1',
                    behaviors: [{ type: 'location', time_offset: 1.0, x: 50, y: 50 }]
                }]
            }
        };
        const { result } = renderHook(() => useTransformEditor(assetWithKeyframe, mockRefresh, null));

        await act(async () => {
            // commit=true to trigger save
            await result.current.handleKeyframeMove('sprite1', 0, 2.0, true);
        });

        expect(fetch).toHaveBeenCalled();
        const callBody = JSON.parse(fetch.mock.calls[0][1].body);
        expect(callBody.layers[0].behaviors[0].time_offset).toBe(2.0);
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Moved keyframe'));
    });

    it('handles keyframe delete', async () => {
        const assetWithKeyframe = {
            ...mockAsset,
            config: {
                layers: [{
                    sprite_name: 'sprite1',
                    behaviors: [{ type: 'location', time_offset: 1.0 }]
                }]
            }
        };

        // Mock confirm to return true
        vi.spyOn(window, 'confirm').mockImplementation(() => true);

        const { result } = renderHook(() => useTransformEditor(assetWithKeyframe, mockRefresh, null));

        await act(async () => {
            await result.current.handleKeyframeDelete('sprite1', 0);
        });

        expect(fetch).toHaveBeenCalled();
        const callBody = JSON.parse(fetch.mock.calls[0][1].body);
        expect(callBody.layers[0].behaviors).toHaveLength(0);
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Deleted keyframe'));
    });

    it('handles missing layer errors gracefully', async () => {
        const { result } = renderHook(() => useTransformEditor(mockAsset, mockRefresh, null));

        await act(async () => {
            await result.current.handleSpritePositionChanged('non-existent', 0, 0, 0);
        });

        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Layer non-existent not found'));
    });
});
