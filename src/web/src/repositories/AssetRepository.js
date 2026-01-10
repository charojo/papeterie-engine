import { openDB } from 'idb';
import { API_BASE } from '../config';

const DB_NAME = 'papeterie-db';
const STORE_SPRITES = 'sprites';
const STORE_SCENES = 'scenes';

/**
 * Interface-like class for Asset Storage
 */
class AssetRepository {
    async getSprites() { throw new Error("Not implemented"); }
    async getScenes() { throw new Error("Not implemented"); }
    async getSpriteImage(_name) { throw new Error("Not implemented"); }
    async saveSprite(_name, _file) { throw new Error("Not implemented"); }
    async saveScene(_name, _file, _metadata) { throw new Error("Not implemented"); }
    async saveSceneConfig(_name, _data) { throw new Error("Not implemented"); }
}

/**
 * Server Implementation (Legacy/Default)
 * Fetches from the Python Backend
 */
export class ServerAssetRepository extends AssetRepository {
    constructor(token) {
        super();
        this.token = token;
    }

    get headers() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    }

    async getSprites() {
        const res = await fetch(`${API_BASE}/sprites`, { headers: this.headers });
        if (!res.ok) throw new Error("Failed to fetch sprites");
        return res.json();
    }

    async getScenes() {
        const res = await fetch(`${API_BASE}/scenes`, { headers: this.headers });
        if (!res.ok) throw new Error("Failed to fetch scenes");
        return res.json();
    }

    async getSpriteImage(_name) {
        // In Server mode, we return null to let Theatre use its legacy logic
        return null;
    }

    async getSpriteMetadata(_name) {
        // Fallback to null, Theatre will use legacy fetch logic
        return null;
    }

    async saveSprite(name, file) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/sprites/upload`, {
            method: 'POST',
            body: formData,
            headers: this.headers
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    async saveScene(name, file) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/scenes/upload`, {
            method: 'POST',
            body: formData,
            headers: this.headers
        });

        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
}

/**
 * Local Implementation (Client-Side Storage)
 * Uses IndexedDB to store assets and /processing/sprite for "compute".
 */
export class LocalAssetRepository extends AssetRepository {
    constructor() {
        super();
        this.dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_SPRITES)) {
                    db.createObjectStore(STORE_SPRITES, { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains(STORE_SCENES)) {
                    db.createObjectStore(STORE_SCENES, { keyPath: 'name' });
                }
            },
        });
        // Cache created ObjectURLs to revoke them later if needed
        this.urlCache = new Map();
    }

    async getSprites() {
        // Return list of sprites in metadata format expected by UI
        const db = await this.dbPromise;
        const items = await db.getAll(STORE_SPRITES);
        // Map to SpriteInfo-like structure
        return items.map(item => ({
            name: item.name,
            type: 'sprite',
            ...item.metadata
        }));
    }

    async getScenes() {
        const db = await this.dbPromise;
        const localItems = await db.getAll(STORE_SCENES);
        const localScenes = localItems.map(item => ({
            name: item.name,
            type: 'scene',
            config: item.config,
            has_config: true,
            has_original: !!item.originalBlob,
            original_url: item.originalBlob ? URL.createObjectURL(item.originalBlob) : null,
            is_local: true
        }));

        try {
            // Attempt to fetch standard scenes from server as well
            const res = await fetch(`${API_BASE}/scenes`);
            if (res.ok) {
                const serverScenes = await res.json();
                // Merge, preferring local if names conflict
                const localNames = new Set(localScenes.map(s => s.name));
                const merged = [...localScenes];
                for (const s of serverScenes) {
                    if (!localNames.has(s.name)) {
                        merged.push({ ...s, is_local: false });
                    }
                }
                return merged;
            }
        } catch {
            // Fallback to local only if server is down
        }

        return localScenes;
    }

    async getSpriteImage(name) {
        if (this.urlCache.has(name)) return this.urlCache.get(name);

        const db = await this.dbPromise;
        const item = await db.get(STORE_SPRITES, name);
        if (!item || !item.blob) return null;

        const url = URL.createObjectURL(item.blob);
        this.urlCache.set(name, url);
        return url;
    }

    async getSpriteMetadata(name) {
        const db = await this.dbPromise;
        const item = await db.get(STORE_SPRITES, name);
        return item ? item.metadata : null;
    }

    async saveSprite(name, file) {
        // 1. Send to Backend for PROCESSING (Stateless)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', 'local'); // Use local rembg
        // Prompt optional? 

        const res = await fetch(`${API_BASE}/processing/sprite`, {
            method: 'POST',
            body: formData
            // No auth headers needed for local processing usually, but good practice if protected
        });

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json(); // { name, image_base64, metadata }

        // 2. data contains { image_base64: "...", metadata: {...} }
        // Convert base64 back to Blob
        const byteCharacters = atob(data.image_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const processedBlob = new Blob([byteArray], { type: 'image/png' });

        // 3. Store in IDB
        const db = await this.dbPromise;
        await db.put(STORE_SPRITES, {
            name: name,
            blob: processedBlob,
            metadata: data.metadata,
            timestamp: Date.now()
        });

        return { name }; // Return data compatible with UI expectations
    }

    async saveScene(name, file) {
        const db = await this.dbPromise;

        // Match server behavior: Create basic config
        const sceneConfig = {
            name: name,
            layers: []
        };

        await db.put(STORE_SCENES, {
            name: name,
            config: sceneConfig,
            originalBlob: file,
            timestamp: Date.now()
        });

        return { name };
    }
}

export function createAssetRepository(mode, token) {
    if (mode === 'LOCAL') {
        return new LocalAssetRepository();
    }
    return new ServerAssetRepository(token);
}
