import { createLogger } from '../utils/logger.js';

const log = createLogger('CameraController');

/**
 * CameraController - Single source of truth for camera state.
 * 
 * Eliminates race conditions between React state and Theatre by:
 * 1. Owning all camera state in one place
 * 2. Providing controlled mutation methods with validation
 * 3. Syncing to Theatre on demand (not on every React render)
 */
export class CameraController {
    constructor(theatre = null) {
        this.theatre = theatre;

        // Private state
        this._zoom = 1.0;
        this._panX = 0;
        this._panY = 0;

        // Bounds
        this.minZoom = 0.05;
        this.maxZoom = 20;

        // Change listeners
        this._listeners = new Set();

        log.debug('CameraController initialized');
    }

    // --- State Accessors ---

    get zoom() { return this._zoom; }
    get panX() { return this._panX; }
    get panY() { return this._panY; }

    get state() {
        return {
            zoom: this._zoom,
            pan: { x: this._panX, y: this._panY }
        };
    }

    // --- Mutations with Validation ---

    /**
     * Set zoom level with optional anchor point for pivot behavior.
     * @param {number} value - New zoom level
     * @param {number|null} anchorX - Screen X to pivot around (optional)
     * @param {number|null} anchorY - Screen Y to pivot around (optional)
     * @param {DOMRect|null} rect - Canvas bounding rect for anchor calculation
     */
    setZoom(value, anchorX = null, anchorY = null, rect = null) {
        // Invariant: zoom must be finite positive number
        if (!Number.isFinite(value) || value <= 0) {
            log.error(`Invalid zoom value rejected: ${value}`);
            throw new Error(`CameraController: Invalid zoom value: ${value}`);
        }

        const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, value));

        // Pivot around anchor point if provided
        if (anchorX !== null && anchorY !== null && rect !== null) {
            const oldZoom = this._zoom;

            // Calculate world position under anchor
            const worldX = (anchorX - rect.width / 2) / oldZoom - this._panX + rect.width / 2;
            const worldY = (anchorY - rect.height / 2) / oldZoom - this._panY + rect.height / 2;

            // Validate world coordinates
            if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
                log.error(`Invalid world coords: (${worldX}, ${worldY})`);
                // Apply zoom without pivot
                this._zoom = clampedZoom;
            } else {
                // Calculate new pan to keep world point under anchor
                const newPanX = (anchorX - rect.width / 2) / clampedZoom + rect.width / 2 - worldX;
                const newPanY = (anchorY - rect.height / 2) / clampedZoom + rect.height / 2 - worldY;

                this._zoom = clampedZoom;
                this._panX = newPanX;
                this._panY = newPanY;
            }
        } else {
            this._zoom = clampedZoom;
        }

        const status = this.theatre ? 'bound to Theatre' : 'NOT bound to Theatre (view will not update)';
        log.info(`Zoom set to ${this._zoom.toFixed(3)} (${status}). Anchor: (${anchorX}, ${anchorY}), Rect: ${rect ? `${rect.width}x${rect.height}` : 'null'}`);
        this._notifyListeners();
    }

    /**
     * Set pan position.
     * @param {number} x - Pan X offset
     * @param {number} y - Pan Y offset
     */
    setPan(x, y) {
        // Invariant: pan must be finite
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            log.error(`Invalid pan rejected: (${x}, ${y})`);
            throw new Error(`CameraController: Invalid pan: (${x}, ${y})`);
        }

        this._panX = x;
        this._panY = y;

        log.debug(`Pan set to (${x.toFixed(1)}, ${y.toFixed(1)})`);
        this._notifyListeners();
    }

    /**
     * Apply relative pan delta (for drag/scroll).
     * @param {number} deltaX - X delta (in screen pixels)
     * @param {number} deltaY - Y delta (in screen pixels)
     */
    pan(deltaX, deltaY) {
        if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
            log.warn(`Invalid pan delta ignored: (${deltaX}, ${deltaY})`);
            return;
        }

        // Scale delta by current zoom for consistent feel
        this._panX -= deltaX / this._zoom;
        this._panY -= deltaY / this._zoom;

        this._notifyListeners();
    }

    /**
     * Reset camera to default state.
     */
    reset() {
        this._zoom = 1.0;
        this._panX = 0;
        this._panY = 0;

        log.info('Camera reset to defaults');
        this._notifyListeners();
    }

    // --- Theatre Synchronization ---

    /**
     * Bind to a Theatre instance.
     */
    bindTheatre(theatre) {
        this.theatre = theatre;
        this.applyToTheatre();
    }

    /**
     * Push current camera state to Theatre.
     * Call this once per frame or after batch updates.
     */
    applyToTheatre() {
        if (!this.theatre) {
            log.warn('applyToTheatre() called but no Theatre instance is bound. Camera changes will not be visible.');
            return;
        }

        log.info(`Applying state to Theatre: Zoom=${this._zoom.toFixed(3)}, Pan=(${this._panX.toFixed(1)}, ${this._panY.toFixed(1)})`);

        this.theatre.cameraZoom = this._zoom;
        this.theatre.cameraPanX = this._panX;
        this.theatre.cameraPanY = this._panY;
    }

    // --- Change Notification ---

    /**
     * Subscribe to camera state changes.
     * @param {Function} callback - Called with new state
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    _notifyListeners() {
        const state = this.state;
        this._listeners.forEach(fn => {
            try {
                fn(state);
            } catch (e) {
                log.error('Listener error:', e);
            }
        });

        // Auto-sync to Theatre
        this.applyToTheatre();
    }

    // --- Static Factory ---

    /**
     * Create controller and bind to Theatre.
     */
    static forTheatre(theatre) {
        const controller = new CameraController(theatre);
        controller.applyToTheatre();
        return controller;
    }
}
