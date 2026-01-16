import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpdateConfigCommand } from '../Commands';
import { API_BASE } from '../../config';
import { toast } from 'sonner';

// Mock Dependencies
vi.mock('../../config', () => ({
    API_BASE: 'http://test-api'
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        info: vi.fn(),
        error: vi.fn()
    }
}));

describe('Commands', () => {
    describe('UpdateConfigCommand', () => {
        let mockRefresh;
        const mockOldConfig = { val: 'old' };
        const mockNewConfig = { val: 'new' };

        beforeEach(() => {
            mockRefresh = vi.fn();
            global.fetch = vi.fn(() => Promise.resolve({
                ok: true,
                text: () => Promise.resolve('ok')
            }));
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('executes correctly for sprites', async () => {
            const cmd = new UpdateConfigCommand(
                'sprite',
                'test_sprite',
                mockOldConfig,
                mockNewConfig,
                mockRefresh,
                'Update sprite'
            );

            await cmd.execute();

            // Verify Fetch
            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE}/sprites/test_sprite/config`,
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(mockNewConfig)
                })
            );

            // Verify Refresh
            expect(mockRefresh).toHaveBeenCalled();

            // Verify Toast
            expect(toast.success).toHaveBeenCalledWith('Update sprite');
        });

        it('executes correctly for scenes', async () => {
            const cmd = new UpdateConfigCommand(
                'scene',
                'test_scene',
                mockOldConfig,
                mockNewConfig,
                mockRefresh
            );

            await cmd.execute();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE}/scenes/test_scene/config`,
                expect.any(Object)
            );
        });

        it('undoes correctly', async () => {
            const cmd = new UpdateConfigCommand(
                'sprite',
                'test_sprite',
                mockOldConfig,
                mockNewConfig,
                mockRefresh,
                'Update sprite'
            );

            await cmd.undo();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE}/sprites/test_sprite/config`,
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(mockOldConfig)
                })
            );

            expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Undone:'));
        });

        it('handles fetch errors', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                text: () => Promise.resolve('Error from API')
            }));

            const cmd = new UpdateConfigCommand(
                'sprite', 'test', {}, {}, mockRefresh
            );

            await expect(cmd.execute()).rejects.toThrow('Failed to apply config: Error from API');
            expect(mockRefresh).not.toHaveBeenCalled();
        });
    });
});
