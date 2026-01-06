const protocol = window.location.protocol;
const hostname = window.location.hostname;
const port = "8000"; // Backend is fixed to 8000 for local dev

export const ASSET_BASE = `${protocol}//${hostname}:${port}`;
export const API_BASE = `${ASSET_BASE}/api`;
export const ASSETS_DIR_BASE = `${ASSET_BASE}/assets`;
