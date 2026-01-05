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
    onRemoveLayer,
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '2px' }}>
                {sortedLayers.map((layer) => (
                    <SpriteAccordionItem
                        key={layer.sprite_name}
                        layer={layer}
                        isSelected={selectedSprite === layer.sprite_name}
                        isVisible={layerVisibility[layer.sprite_name] !== false}
                        onSelect={() => onSpriteSelected(layer.sprite_name)}
                        onToggleVisibility={() => onToggleVisibility(layer.sprite_name)}
                        onRemove={() => onRemoveLayer(layer.sprite_name)}
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
    onRemove,
    onBehaviorsChange,
    behaviorGuidance,
    isScene,
    displayZ
}) {
    const [isExpanded, setIsExpanded] = useState(isSelected);
    const [isAdding, setIsAdding] = useState(false);

    const itemRef = React.useRef(null);

    // Auto-scroll if selected
    React.useEffect(() => {
        if (isSelected && itemRef.current && itemRef.current.scrollIntoView) {
            itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setIsExpanded(true);
        }
    }, [isSelected]);

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
            className="card"
            style={{
                background: isSelected ? 'rgba(var(--color-primary-rgb), 0.1)' : 'var(--color-bg-elevated)',
                border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                borderRadius: '6px',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                padding: '0',
                flexShrink: 0
            }}
        >
            {/* Header / Collapsed View */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    minHeight: '28px'
                }}
                onClick={() => {
                    onSelect();
                    setIsExpanded(!isExpanded);
                }}
            >
                {/* Left Side: Thumbnail */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0, paddingRight: '8px' }}>
                    <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        background: 'rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        <img
                            src={thumbnailSrc}
                            alt=""
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.target.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }}
                        />
                    </div>
                </div>
                <div style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 600 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: isVisible ? 1 : 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    gap: '6px'
                }}>
                    <span style={{ opacity: 0.5, fontSize: '0.7rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: '3px', minWidth: '24px', textAlign: 'center' }}>
                        {displayZ}
                    </span>
                    {layer.sprite_name}
                </div>

                {/* Right Side: Controls - Symmetrical fixed width */}
                <div style={{ width: '80px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', flexShrink: 0, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                        <button
                            className="btn-icon"
                            onClick={() => setIsAdding(!isAdding)}
                            title="Add Behavior"
                            style={{ padding: '2px' }}
                        >
                            <Icon name="add" size={14} />
                        </button>

                        <button
                            className="btn-icon"
                            onClick={onToggleVisibility}
                            title={isVisible ? "Hide in Theatre" : "Show in Theatre"}
                            style={{ opacity: isVisible ? 1 : 0.5, padding: '2px' }}
                        >
                            <Icon name={isVisible ? "visible" : "hidden"} size={14} />
                        </button>
                        {isScene && (
                            <button
                                className="btn-icon"
                                onClick={onRemove}
                                title="Remove from Scene"
                                style={{ opacity: 0.5, padding: '2px' }}
                            >
                                <Icon name="delete" size={14} />
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px' }}>
                        <button
                            className="btn-icon"
                            title={isExpanded ? "Collapse Behaviors" : "Expand Behaviors"}
                            style={{ padding: '2px', opacity: 0.5 }}
                        >
                            <Icon name={isExpanded ? "collapse" : "expand"} size={16} />
                        </button>
                    </div>

                    {/* Add Behavior Menu */}
                    {isAdding && (
                        <div style={{
                            position: 'absolute', top: '100%', right: '24px', zIndex: 10,
                            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '120px'
                        }} onClick={e => e.stopPropagation()}>
                            {Object.values(BehaviorTypes).map(type => (
                                <div
                                    key={type}
                                    style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem' }}
                                    className="hover-bg"
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
                        padding: '0 6px 6px 6px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(0,0,0,0.25)',
                        minHeight: '0'
                    }}>
                        <div style={{ marginTop: '4px' }}>
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
