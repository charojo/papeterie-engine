import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBehaviorEditor } from '../useBehaviorEditor';
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
        constructor(type, name) {
            console.log('UpdateConfigCommand constructed with:', { type, name });
            this.type = type;
            this.name = name;
            this.execute = vi.fn();
        }
    }
}));

global.fetch = vi.fn();

describe('useBehaviorEditor', () => {
    const mockSpriteAsset = {
        name: 'test-sprite',
        metadata: {
            behaviors: []
        },
        config: null
    };

    const mockSceneAsset = {
        name: 'test-scene',
        metadata: {},
        config: {
            layers: [
                {
                    sprite_name: 'sprite1',
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

    it('handles sprite behavior change without command manager', async () => {
        const { result } = renderHook(() => useBehaviorEditor('sprite', mockSpriteAsset, null, mockRefresh, null));

        const newBehaviors = [{ type: 'physics', enabled: true }];

        await act(async () => {
            await result.current.handleBehaviorsChange(newBehaviors);
        });

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sprites/test-sprite/config'),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"type":"physics"')
            })
        );
        expect(toast.success).toHaveBeenCalledWith('Sprite behaviors updated');
        expect(mockRefresh).toHaveBeenCalled();
    });

    it('handles scene layer behavior change without command manager', async () => {
        const { result } = renderHook(() => useBehaviorEditor('scene', mockSceneAsset, 'sprite1', mockRefresh, null));

        const newBehaviors = [{ type: 'shake', intensity: 0.5 }];

        await act(async () => {
            await result.current.handleBehaviorsChange(newBehaviors);
        });

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/test-scene/config'),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"intensity":0.5')
            })
        );
        expect(toast.success).toHaveBeenCalledWith('Updated behaviors for sprite1');
        expect(mockRefresh).toHaveBeenCalled();
    });

    it('handles behavior change with command manager', async () => {
        const { result } = renderHook(() => useBehaviorEditor('sprite', mockSpriteAsset, null, mockRefresh, mockExecuteCommand));

        const newBehaviors = [{ type: 'physics', enabled: true }];

        await act(async () => {
            await result.current.handleBehaviorsChange(newBehaviors);
        });

        expect(mockExecuteCommand).toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();

        const commandCall = mockExecuteCommand.mock.calls[0][0];
        expect(commandCall.type).toBe('sprite');
        expect(commandCall.name).toBe('test-sprite');
    });

    it('handles errors gracefully', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        fetch.mockResolvedValueOnce({
            ok: false,
            text: () => Promise.resolve('Backend error')
        });

        const { result } = renderHook(() => useBehaviorEditor('sprite', mockSpriteAsset, null, mockRefresh, null));

        await act(async () => {
            await result.current.handleBehaviorsChange([]);
        });

        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to save changes'));
        consoleSpy.mockRestore();
    });
});
