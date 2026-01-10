import { useState, useCallback, useEffect, useRef } from 'react';
import { CameraController } from '../engine/CameraController.js';
import { usePersistentState } from './usePersistentState';
import { createLogger } from '../utils/logger';

const log = createLogger('useCameraController');

/**
 * React hook that provides camera state and controls backed by CameraController.
 * 
 * Benefits:
 * - Single source of truth (CameraController)
 * - Automatic validation and error handling
 * - Seamless Theatre synchronization
 * - React state for UI updates
 * 
 * @param {Theatre} theatre - Optional Theatre instance to bind
 * @returns {Object} Camera state and control methods
 */
export function useCameraController(theatre = null, storageKey = null) {
    // Use lazy initialization to avoid reading ref during render
    const [controller] = useState(() => new CameraController(theatre));

    // React state mirrors controller state for UI reactivity.
    // If storageKey is provided, use PersistentState.
    // We updated usePersistentState to handle null keys gracefully (acting as useState).
    const [cameraState, setCameraState] = usePersistentState(storageKey, controller.state);

    const lastSyncedKeyRef = useRef(null);

    // Initial Sync from Storage -> Controller (on mount or key change)
    useEffect(() => {
        // Only sync if we have a key, state, and it's a NEW key (or first run)
        // This prevents the feedback loop where:
        // User Zoom -> Controller Update -> setCameraState -> cameraState change -> Effect fires -> Controller setZoom -> circular dependency
        const isNewKey = storageKey !== lastSyncedKeyRef.current;

        if (storageKey && cameraState && isNewKey) {
            // Update the Ref immediately to lock out future updates from this loop
            lastSyncedKeyRef.current = storageKey;

            // Apply stored state to controller
            log.debug(`Restoring state for key ${storageKey}: Z=${cameraState.zoom}`);
            controller.setPan(cameraState.pan.x, cameraState.pan.y);
            controller.setZoom(cameraState.zoom); // No anchor, plain set
        }
    }, [storageKey, controller, cameraState]); // Dependent on cameraState from storage

    // Subscribe to controller changes -> Update React State
    useEffect(() => {
        const unsubscribe = controller.subscribe((newState) => {
            setCameraState(newState);
        });
        return unsubscribe;
    }, [controller, setCameraState]); // Update when controller instance changes

    // Bind Theatre when available
    useEffect(() => {
        if (theatre) {
            controller.bindTheatre(theatre);
            // Also ensure theatre gets current state immediately upon bind
            controller.applyToTheatre();
        }
    }, [theatre, controller]);

    // Memoized control methods
    const setZoom = useCallback((value, anchorX = null, anchorY = null, rect = null) => {
        controller.setZoom(value, anchorX, anchorY, rect);
    }, [controller]);

    const zoomIn = useCallback((factor = 1.2) => {
        setZoom(controller.zoom * factor);
    }, [controller, setZoom]);

    const zoomOut = useCallback((factor = 1.2) => {
        setZoom(controller.zoom / factor);
    }, [controller, setZoom]);

    const setPan = useCallback((x, y) => {
        controller.setPan(x, y);
    }, [controller]);

    const pan = useCallback((deltaX, deltaY) => {
        controller.pan(deltaX, deltaY);
    }, [controller]);

    const reset = useCallback(() => {
        controller.reset();
    }, [controller]);

    // Handle wheel events (for zoom around cursor)
    const handleWheel = useCallback((e, canvas) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const isZoom = e.ctrlKey || e.metaKey;

        if (isZoom) {
            // Adaptive sensitivity
            const absDelta = Math.abs(e.deltaY);
            const isTrackpad = absDelta > 0 && absDelta < 50;
            const sensitivity = isTrackpad ? 0.015 : 0.002;

            const safeDeltaY = isNaN(e.deltaY) ? 0 : e.deltaY;
            const scaleFactor = Math.exp(-safeDeltaY * sensitivity);
            const newZoom = controller.zoom * scaleFactor;

            setZoom(newZoom, mouseX, mouseY, rect);
        } else {
            pan(e.deltaX, e.deltaY);
        }
    }, [controller, setZoom, pan]);

    return {
        // State (readonly)
        zoom: cameraState.zoom,
        panX: cameraState.pan.x,
        panY: cameraState.pan.y,
        state: cameraState,

        // Control methods
        setZoom,
        zoomIn,
        zoomOut,
        setPan,
        pan,
        reset,
        handleWheel,

        // Direct access for advanced use
        controller
    };
}
