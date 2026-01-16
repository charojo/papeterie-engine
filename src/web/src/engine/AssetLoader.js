import { createLogger } from '../utils/logger.js';

const log = createLogger('AssetLoader');

export class AssetLoader {
    constructor(assetBaseUrl, userType = "default", sceneName = "Unknown") {
        this.assetBaseUrl = assetBaseUrl;
        this.userType = userType || "default";
        this.sceneName = sceneName;
        this.spriteCache = new Map(); // Map<string, Promise<HTMLImageElement>>
    }

    /**
     * Robustly load a sprite image, handling userType prioritization and fallbacks.
     * @param {string} spriteName
     * @returns {Promise<HTMLImageElement|null>}
     */
    async loadSprite(spriteName) {
        if (this.spriteCache.has(spriteName)) {
            return this.spriteCache.get(spriteName);
        }

        const loadPromise = (async () => {
            const user = this.userType;
            const assetUrl = `${this.assetBaseUrl}/users/${user}/sprites/${spriteName}/${spriteName}.png`;
            let image = null;

            try {
                log.debug(`[${this.sceneName}] Loading sprite '${spriteName}' from: ${assetUrl}`);
                image = await this.loadImage(assetUrl);
                log.debug(`Loaded sprite '${spriteName}' from ${user}`);
                return image;
            } catch (err) {
                log.warn(`Failed to load sprite '${spriteName}' from ${user}.`, err);
            }

            // Last ditch fallback - check if assetBaseUrl is actually correct (local dev mismatch)
            if (this.assetBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
                const altUrl = assetUrl.replace(/https?:\/\/[^/]+/, window.location.origin);
                log.warn(`Retrying with origin fallback: ${altUrl}`);
                try {
                    image = await this.loadImage(altUrl);
                    log.debug('Success on origin fallback');
                    return image;
                } catch {
                    log.error(`Origin fallback failed for ${spriteName}`);
                }
            }

            log.error(`CRITICAL: Failed to load sprite '${spriteName}' from all paths.`);
            return null; // Return null so we can proceed without crashing
        })();

        this.spriteCache.set(spriteName, loadPromise);
        return loadPromise;
    }

    loadImage(url, retry = true) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // specific for canvas manipulation
            img.onload = () => resolve(img);
            img.onerror = () => {
                if (retry) {
                    // Retry with cache buster
                    log.warn(`Retrying image load with cache buster: ${url}`);
                    const bustUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
                    const retryImg = new Image();
                    retryImg.crossOrigin = "Anonymous";
                    retryImg.onload = () => {
                        log.debug(`Recovered image with cache buster: ${url}`);
                        resolve(retryImg);
                    };
                    retryImg.onerror = (err) => {
                        log.error(`Image load retry failed: ${url}`, err);
                        reject(new Error(`Failed to load image: ${url}`));
                    };
                    retryImg.src = bustUrl;
                } else {
                    reject(new Error(`Failed to load image: ${url}`));
                }
            };
            img.src = url;
        });
    }

    /**
     * Internal helper to fetch metadata and merge with scene config.
     * Metadata serves as the "base" which scene overrides.
     */
    async fetchAndMergeMetadata(config, image) {
        if (!image || !image.src) return config;

        try {
            const cleanSrc = image.src.split('?')[0];
            const metaUrl = cleanSrc.replace(/\.png$/, '.prompt.json');
            const metaRes = await fetch(metaUrl);
            if (metaRes.ok) {
                const meta = await metaRes.json();
                // MERGE: Scene (config) is AUTHORITATIVE over Metadata (meta)
                const merged = { ...meta, ...config };
                log.debug(`[${this.sceneName}] Merged metadata for ${config.sprite_name}`, {
                    meta_scale: meta.scale,
                    scene_scale: config.scale,
                    final_scale: merged.scale
                });
                return merged;
            }
        } catch (err) {
            log.warn(`Failed to fetch metadata for ${config.sprite_name}`, err);
        }
        return config;
    }
}
