const protocol = window.location.protocol;
const hostname = window.location.hostname;
const port = "8000"; // Backend is fixed to 8000 for local dev

export const ASSET_BASE = `${protocol}//${hostname}:${port}`;
export const API_BASE = `${ASSET_BASE}/api`;
export const ASSETS_DIR_BASE = `${ASSET_BASE}/assets`;

/**
 * Fetch with timeout support to avoid hanging on unresponsive backends.
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

/**
 * Check if the backend is available by attempting to fetch the config endpoint.
 * @returns {Promise<boolean>}
 */
export async function isBackendAvailable() {
    try {
        const response = await fetchWithTimeout(`${API_BASE}/config`, {}, 3000);
        return response.ok;
    } catch {
        return false;
    }
}
