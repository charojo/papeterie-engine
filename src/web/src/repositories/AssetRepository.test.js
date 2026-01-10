import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAssetRepository, LocalAssetRepository, ServerAssetRepository } from './AssetRepository';

// Mock idb
vi.mock('idb', () => ({
    openDB: vi.fn(),
}));

describe('AssetRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
        global.URL.createObjectURL = vi.fn();
    });

    describe('Factory', () => {
        it('creates LocalAssetRepository when mode is LOCAL', () => {
            const repo = createAssetRepository('LOCAL');
            expect(repo).toBeInstanceOf(LocalAssetRepository);
        });

        it('creates ServerAssetRepository when mode is SERVER', () => {
            const repo = createAssetRepository('SERVER', 'token');
            expect(repo).toBeInstanceOf(ServerAssetRepository);
            expect(repo.token).toBe('token');
        });
    });

    describe('ServerAssetRepository', () => {
        let repo;

        beforeEach(() => {
            repo = new ServerAssetRepository('token');
        });

        it('getSprites calls fetch', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [{ name: 'test' }]
            });
            const sprites = await repo.getSprites();
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/sprites'), expect.anything());
            expect(sprites).toEqual([{ name: 'test' }]);
        });

        it('getSpriteImage returns null', async () => {
            const url = await repo.getSpriteImage('test');
            expect(url).toBeNull();
        });
    });
});
