import React, { useState } from 'react';
import { Icon } from './Icon';
import { BehaviorEditor } from './BehaviorEditor';
import { BehaviorTypes, createDefaultBehavior } from './BehaviorConstants';

export function SpriteListEditor({
    type,
    asset,
    selectedSprite,
    onSpriteSelected,
    layerVisibility,
    onToggleVisibility,
    onDeleteSprite,
    onBehaviorsChange,
    behaviorGuidance,
    currentTime
}) {
    const isScene = type === 'scene';
    const layers = isScene ? (asset.config?.layers || []) : [{ sprite_name: asset.name, behaviors: asset.metadata?.behaviors || [] }];

    // Sort layers by CURRENT z_depth descending (front to back)
    // Note: If we sort dynamically, the list will jump around during playback. 
    // User probably just wants the LABEL to be correct, but maybe sorting too?
    // "The sprites in the sprite list should show the current z-depth"
    // Usually lists shouldn't reorder wildly during playback unless requested.
    // Let's keep the user's stable sort (or base sort) but update the label first.
    // Actually, if Z changes, they might WANT to see it pop to top?
    // Let's calculated derived layers with resolved Z.

    // Helper to calculate Z at current time
    const getZAtTime = (layer, time) => {
        // 1. Initial Candidate: Static Behavior > Root Prop
        const staticLocation = layer.behaviors?.find(
            b => b.type === 'location' && b.time_offset === undefined
        );

        // Smart Default logic matching TimelineEditor
        let currentZ = staticLocation?.z_depth ?? layer.z_depth;

        // 2. Identify Dynamic Behaviors with Z (filter out null/undefined)
        const zBehaviors = layer.behaviors
            ?.filter(b => b.type === 'location' && typeof b.time_offset === 'number' && b.z_depth !== undefined && b.z_depth !== null)
            .sort((a, b) => a.time_offset - b.time_offset) || [];

        // 3. Fallback: If no base Z, look ahead to the first dynamic behavior's Z
        if (currentZ === undefined || currentZ === null) {
            if (zBehaviors.length > 0) {
                currentZ = zBehaviors[0].z_depth;
            } else {
                currentZ = 0; // Absolute fallback if NOTHING is defined
            }
        }
        currentZ = Number(currentZ);

        // 4. Apply Time-Based Changes (Step Function)
        for (const b of zBehaviors) {
            if (b.time_offset <= time) {
                currentZ = Number(b.z_depth);
            } else {
                break;
            }
        }
        return currentZ;
    };

    const evaluatedLayers = layers.map(l => ({
        ...l,
        displayZ: getZAtTime(l, currentTime || 0)
    }));

    // Sort by displayZ descending
    const sortedLayers = [...evaluatedLayers].sort((a, b) => b.displayZ - a.displayZ);

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto flex flex-col gap-px pr-px">
                {sortedLayers.map((layer) => (
                    <SpriteAccordionItem
                        key={layer.sprite_name}
                        layer={layer}
                        isSelected={selectedSprite === layer.sprite_name}
                        isVisible={layerVisibility[layer.sprite_name] !== false}
                        onSelect={() => onSpriteSelected(layer.sprite_name)}
                        onToggleVisibility={() => onToggleVisibility(layer.sprite_name)}
                        onDeleteSprite={() => onDeleteSprite(layer.sprite_name)}
                        onBehaviorsChange={(newBehaviors) => onBehaviorsChange(newBehaviors)}
                        behaviorGuidance={selectedSprite === layer.sprite_name ? behaviorGuidance : null}
                        isScene={isScene}
                        displayZ={layer.displayZ}
                    />
                ))}
            </div>
        </div>
    );
}

function SpriteAccordionItem({
    layer,
    isSelected,
    isVisible,
    onSelect,
    onToggleVisibility,
    onDeleteSprite,
    onBehaviorsChange,
    behaviorGuidance,
    isScene,
    displayZ
}) {
    const [isExpanded, setIsExpanded] = useState(isSelected);
    const [isAdding, setIsAdding] = useState(false);

    const itemRef = React.useRef(null);

    // Auto-scroll if selected OR expanded
    React.useEffect(() => {
        if ((isSelected || isExpanded) && itemRef.current && itemRef.current.scrollIntoView) {
            // Increased timeout to 100ms to verify layout stability before scrolling
            // This helps with "expanding out of view" issues at the bottom
            const timeoutId = setTimeout(() => {
                itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [isSelected, isExpanded]);

    // Verify URL construction - defaulting to standard path
    const assetBase = window.API_BASE ? window.API_BASE.replace('/api', '/assets') : `${window.location.protocol}//${window.location.hostname}:8000/assets`;
    const thumbnailSrc = `${assetBase}/users/default/sprites/${layer.sprite_name}/${layer.sprite_name}.png`;

    const handleAddBehavior = (type) => {
        const newBehavior = createDefaultBehavior(type);
        const currentBehaviors = layer.behaviors || [];
        onBehaviorsChange([...currentBehaviors, newBehavior]);
        setIsAdding(false);
        setIsExpanded(true); // Ensure expanded to see the new behavior
    };
    return (
        <div
            ref={itemRef}
            id={`sprite-list-item-${layer.sprite_name}`}
            className={`card card-interactive overflow-hidden p-0 flex-shrink-0 no-round ${isSelected ? 'selected' : ''}`}
        >
            {/* Header / Collapsed View */}
            <div
                className="flex items-center gap-1 px-2 py-1 cursor-pointer select-none min-h-7"
                onClick={() => {
                    onSelect();
                    setIsExpanded(!isExpanded);
                }}
            >
                {/* Left Side: Thumbnail */}
                <div className="flex items-center justify-start flex-shrink-0 pr-2">
                    <div className="w-6 h-6 rounded bg-surface flex items-center justify-center overflow-hidden">
                        <img
                            src={thumbnailSrc}
                            alt=""
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => { e.target.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }}
                        />
                    </div>
                </div>
                <div className={`flex-1 text-sm ${isSelected ? 'text-main font-semibold' : 'text-muted font-medium'} whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-start text-left gap-2 ${isVisible ? 'opacity-100' : 'opacity-50'}`}>
                    <span className="text-subtle text-xxs font-mono bg-surface py-xs rounded-sm min-w-6 text-center">
                        {displayZ}
                    </span>
                    {layer.sprite_name}
                </div>

                {/* Right Side: Controls - Tight and Right-Justified */}
                {/* Removed extra padding/gaps to make icons 'much closer' */}
                <div className="flex-shrink-0 flex items-center justify-end gap-0 relative">
                    <div className="flex items-center" style={{ gap: 0 }} onClick={e => e.stopPropagation()}>
                        <button
                            className="btn-icon flex items-center justify-center"
                            style={{ padding: 0, width: 18, height: 20 }}
                            title="Add Behavior"
                        >
                            <Icon name="add" size={14} />
                        </button>

                        <button
                            className="btn-icon flex items-center justify-center"
                            style={{ padding: 0, width: 18, height: 20, opacity: isVisible ? 1 : 0.5 }}
                            onClick={() => onToggleVisibility()} // Changed onClick
                            title={isVisible ? "Hide Layer" : "Show Layer"} // Changed title
                        >
                            <Icon name={isVisible ? "eye" : "eyeOff"} size={14} /> {/* Changed icon name */}
                        </button>
                        {isScene && (
                            <button
                                className="btn-icon flex items-center justify-center text-error"
                                style={{ padding: 0, width: 18, height: 20 }}
                                onClick={() => onDeleteSprite()}
                                title="Delete Sprite"
                            >
                                <Icon name="delete" size={14} />
                            </button>
                        )}
                        <button
                            className="btn-icon flex items-center justify-center"
                            style={{ padding: 0, width: 18, height: 20 }}
                            title={isExpanded ? "Collapse Behaviors" : "Expand Behaviors"}
                        >
                            <Icon name={isExpanded ? "collapse" : "expand"} size={16} />
                        </button>
                    </div>

                    {/* Add Behavior Menu */}
                    {isAdding && (
                        <div className="absolute top-full right-6 z-10 bg-surface border rounded shadow-md p-1 grid grid-cols-2 gap-1 min-w-120" onClick={e => e.stopPropagation()}>
                            {Object.values(BehaviorTypes).map(type => (
                                <div
                                    key={type}
                                    className="hover-bg p-xs cursor-pointer text-xs"
                                    onClick={() => handleAddBehavior(type)}
                                >
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div >

            {/* Expanded Content: Behaviors */}
            {
                isExpanded && (
                    <div style={{
                        padding: '6px 6px 6px 36px', // Left padding indentation
                        borderTop: '1px solid var(--color-border-muted)',
                        background: 'var(--color-bg-surface)',
                        minHeight: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end' // Right conform
                    }}>
                        <div style={{ width: '100%' }}>
                            <BehaviorEditor
                                behaviors={layer.behaviors || []}
                                onChange={onBehaviorsChange}
                                readOnly={false}
                                inline={true}
                                behaviorGuidance={behaviorGuidance}
                            />
                        </div>
                    </div>
                )
            }
        </div >
    );
}
