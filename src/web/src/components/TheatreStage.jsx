import { useEffect, useRef } from 'react';
import { Theatre } from '../engine/Theatre';

export function TheatreStage({
    scene,
    sceneName,
    assetBaseUrl = "http://localhost:8000/assets",
    style,
    onTelemetry,
    debugMode = false,
    layerVisibility = {},
    onSpriteSelected,
    onSpritePositionChanged,
    selectedSprite
}) {
    const canvasRef = useRef(null);
    const theatreRef = useRef(null);
    const containerRef = useRef(null);
    const isDraggingRef = useRef(false);

    // Sync debugMode and layerVisibility
    useEffect(() => {
        if (theatreRef.current) {
            theatreRef.current.debugMode = debugMode;
            // Apply layer visibility
            Object.entries(layerVisibility).forEach(([name, visible]) => {
                theatreRef.current.setLayerVisibility(name, visible);
            });
        }
    }, [debugMode, layerVisibility]);

    // Sync selected sprite
    useEffect(() => {
        if (theatreRef.current && selectedSprite) {
            theatreRef.current.selectSprite(selectedSprite);
        }
    }, [selectedSprite]);

    useEffect(() => {
        if (!canvasRef.current || !scene) return;

        // Cleanup previous instance
        if (theatreRef.current) {
            theatreRef.current.stop();
        }

        const theatre = new Theatre(canvasRef.current, scene, sceneName, assetBaseUrl);
        theatre.onTelemetry = onTelemetry;
        theatre.debugMode = debugMode;

        // Wire up interaction callbacks
        theatre.onSpriteSelected = onSpriteSelected;
        theatre.onSpritePositionChanged = onSpritePositionChanged;

        theatreRef.current = theatre;

        let isMounted = true;

        const init = async () => {
            await theatre.initialize();
            if (isMounted) {
                // Apply initial visibility now that layers are loaded
                Object.entries(layerVisibility).forEach(([name, visible]) => {
                    theatre.setLayerVisibility(name, visible);
                });
                theatre.start();
            }
        };

        init();

        return () => {
            isMounted = false;
            if (theatreRef.current) {
                theatreRef.current.stop();
            }
        };
    }, [scene, sceneName, assetBaseUrl]);

    // Handle Resizing
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                // Set actual canvas size to match display size for 1:1 pixel mapping
                // For HighDPI we might want to multiply by window.devicePixelRatio
                canvasRef.current.width = width;
                canvasRef.current.height = height;
            }
        };

        // Initial resize
        handleResize();

        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const handleMouseDown = (e) => {
        if (!theatreRef.current) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (theatreRef.current.handleDragStart(x, y)) {
            isDraggingRef.current = true;
        } else {
            theatreRef.current.handleCanvasClick(x, y);
        }
    };

    const handleMouseMove = (e) => {
        if (!theatreRef.current) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        theatreRef.current.setMousePosition(x, y);

        if (isDraggingRef.current) {
            theatreRef.current.handleDragMove(x, y);
        }
    };

    const handleMouseUp = () => {
        if (!theatreRef.current) return;
        if (isDraggingRef.current) {
            theatreRef.current.handleDragEnd();
            isDraggingRef.current = false;
        }
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', ...style }}>
            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: isDraggingRef.current ? 'grabbing' : 'pointer' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
            {/* Loading overlay or controls could go here */}
        </div>
    );
}
