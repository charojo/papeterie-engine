import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLayerOperations } from '../useLayerOperations';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn()
    }
}));

// Mock Commands
const mockExecuteCommand = vi.fn();
vi.mock('../../utils/Commands', () => ({
    UpdateConfigCommand: vi.fn(function (type, name, oldConfig, newConfig, refresh, desc) {
        this.type = type;
        this.name = name;
        this.oldConfig = oldConfig;
        this.newConfig = newConfig;
        this.refresh = refresh;
        this.desc = desc;
        return this;
    })
}));

global.fetch = vi.fn();

describe('useLayerOperations', () => {
    const mockRefresh = vi.fn();
    const initialAsset = {
        name: 'test-scene',
        config: {
            layers: [
                { sprite_name: 'sprite1', visible: true, z_depth: 10 },
                { sprite_name: 'sprite2', visible: false, z_depth: 20 }
            ]
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('Success'),
            json: () => Promise.resolve({})
        });
    });

    it('initializes visibility from config', () => {
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, mockExecuteCommand));

        act(() => {
            result.current.initializeVisibility(initialAsset.config);
        });

        expect(result.current.layerVisibility).toEqual({
            sprite1: true,
            sprite2: false
        });
    });

    it('toggles layer visibility (optimistic + command)', async () => {
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, mockExecuteCommand));

        // Initialize first
        act(() => {
            result.current.initializeVisibility(initialAsset.config);
        });

        await act(async () => {
            await result.current.toggleLayerVisibility('sprite1');
        });

        // Optimistic update
        expect(result.current.layerVisibility.sprite1).toBe(false);

        // Command execution
        expect(mockExecuteCommand).toHaveBeenCalled();
        const command = mockExecuteCommand.mock.calls[0][0];
        expect(command.desc).toContain('Hid layer sprite1');
        expect(command.newConfig.layers.find(l => l.sprite_name === 'sprite1').visible).toBe(false);
    });

    it('toggles layer visibility (direct API fallback)', async () => {
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, null)); // No command executor

        act(() => {
            result.current.initializeVisibility(initialAsset.config);
        });

        await act(async () => {
            await result.current.toggleLayerVisibility('sprite2');
        });

        expect(result.current.layerVisibility.sprite2).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/config'),
            expect.objectContaining({ method: 'PUT' })
        );
        expect(mockRefresh).toHaveBeenCalled();
    });

    it('reverts visibility on error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        global.fetch.mockRejectedValue(new Error('API Error'));
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, null));

        act(() => {
            result.current.initializeVisibility(initialAsset.config);
        });

        await act(async () => {
            await result.current.toggleLayerVisibility('sprite1');
        });

        // Should have attempted update (optimistic false) -> error -> revert to true
        expect(result.current.layerVisibility.sprite1).toBe(true);
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to save visibility'));
        consoleSpy.mockRestore();
    });

    it('adds sprite to scene', async () => {
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, mockExecuteCommand));
        const newSprite = { name: 'new-sprite', metadata: { z_depth: 5 } };

        await act(async () => {
            await result.current.handleAddSprite(newSprite);
        });

        expect(mockExecuteCommand).toHaveBeenCalled();
        const command = mockExecuteCommand.mock.calls[0][0];
        expect(command.newConfig.layers).toHaveLength(3);
        const addedLayer = command.newConfig.layers.find(l => l.sprite_name === 'new-sprite');
        expect(addedLayer.z_depth).toBe(5);
        expect(result.current.showSpriteLibrary).toBe(false);
    });

    it('prevents duplicate sprites', async () => {
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, mockExecuteCommand));

        await act(async () => {
            await result.current.handleAddSprite({ name: 'sprite1' });
        });

        expect(mockExecuteCommand).not.toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('already in the scene'));
    });

    it('removes layer', async () => {
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, mockExecuteCommand));

        await act(async () => {
            await result.current.handleRemoveLayer('sprite1');
        });

        expect(mockExecuteCommand).toHaveBeenCalled();
        const command = mockExecuteCommand.mock.calls[0][0];
        expect(command.newConfig.layers).toHaveLength(1);
        expect(command.newConfig.layers.find(l => l.sprite_name === 'sprite1')).toBeUndefined();
    });

    it('updates layer order', async () => {
        const { result } = renderHook(() => useLayerOperations(initialAsset, mockRefresh, mockExecuteCommand));

        const newOrderMap = { 'sprite1': 99, 'sprite2': 1 }; // swapped depths

        await act(async () => {
            await result.current.handleUpdateLayerOrder(newOrderMap);
        });

        expect(mockExecuteCommand).toHaveBeenCalled();
        const command = mockExecuteCommand.mock.calls[0][0];
        expect(command.newConfig.layers.find(l => l.sprite_name === 'sprite1').z_depth).toBe(99);
        expect(command.newConfig.layers.find(l => l.sprite_name === 'sprite2').z_depth).toBe(1);
    });
});
