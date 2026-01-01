import { useEffect, useRef } from 'react';
import { Theatre } from '../engine/Theatre';

export function TheatreStage({ scene, assetBaseUrl = "http://localhost:8000/assets", style }) {
    const canvasRef = useRef(null);
    const theatreRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !scene) return;

        // Cleanup previous instance
        if (theatreRef.current) {
            theatreRef.current.stop();
        }

        const theatre = new Theatre(canvasRef.current, scene, scene.name, assetBaseUrl);
        theatreRef.current = theatre;

        const init = async () => {
            await theatre.initialize();
            theatre.start();
        };

        init();

        return () => {
            if (theatreRef.current) {
                theatreRef.current.stop();
            }
        };
    }, [scene, assetBaseUrl]);

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

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', ...style }}>
            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
            {/* Loading overlay or controls could go here */}
        </div>
    );
}
