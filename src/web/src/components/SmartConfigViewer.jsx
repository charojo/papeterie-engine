import React, { useRef, useEffect } from 'react';

// Helper to render JSON with auto-scroll focus
export function SmartConfigViewer({ configData, selectedImage, type, scrollContainerRef }) {
    // containerRef is now passed from parent
    const fallbackRef = useRef(null);
    const containerRef = scrollContainerRef || fallbackRef;

    // Auto-scroll when selectedImage changes
    useEffect(() => {
        if (!selectedImage || !containerRef.current) return;

        // Find target element

        const targetId = `json-layer-${selectedImage}`;
        const el = document.getElementById(targetId);

        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Highlight effect
            el.style.backgroundColor = 'var(--color-selection-glow)';
            setTimeout(() => {
                if (el) el.style.backgroundColor = 'transparent';
            }, 1000);
        } else if (selectedImage === 'original') {
            // Scroll to top for general config
            if (containerRef.current && containerRef.current.scrollTo) {
                containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [selectedImage, configData, containerRef]);

    if (!configData) return <div className="text-subtle text-sm">No configuration data.</div>;

    // For sprites, simplified view
    if (type === 'sprite') {
        return (
            <pre className="m-0 text-sm text-monospace">
                {JSON.stringify(configData, null, 2)}
            </pre>
        );
    }

    // For scenes, split structure
    const { layers, ...rest } = configData;

    return (
        <div className="flex-col gap-xl text-monospace text-sm">
            {/* General Settings */}
            <div>
                <div className="text-subtle mb-1 font-bold">// Scene Settings</div>
                <pre className="m-0">{JSON.stringify(rest, null, 2)}</pre>
            </div>

            {/* Layers */}
            {layers && layers.length > 0 && (
                <div className="flex-col gap-md">
                    <div className="text-subtle font-bold">// Layers</div>
                    {layers.map((layer, idx) => (
                        <div
                            key={idx}
                            id={`json-layer-${layer.sprite_name}`}
                            className={`json-layer-item ${layer.sprite_name === selectedImage ? 'selected' : ''}`}
                        >
                            <div className="text-subtle mb-1 text-primary">
                                {`[${idx}] ${layer.sprite_name}`}
                            </div>
                            <pre className="m-0">{JSON.stringify(layer, null, 2)}</pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
