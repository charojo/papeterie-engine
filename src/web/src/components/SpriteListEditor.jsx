import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { Button } from './Button';
import { BehaviorEditor } from './BehaviorEditor';
import { BehaviorTypes, createDefaultBehavior } from './BehaviorConstants';

export function SpriteListEditor({
    type,
    asset,
    selectedSprite,
    selectedSprites,
    selectedBehaviorIndex,
    onSpriteSelected,
    _onOpenSprite,
    onBehaviorSelect,
    layerVisibility,
    onToggleVisibility,
    onDeleteSprite,
    onBehaviorsChange,
    behaviorGuidance,
    currentTime,
    telemetry,
    showTelemetry,
    onHeaderDoubleClick,
    onLayerUpdate
}) {
    // console.log('SpriteListEditor telemetry prop:', telemetry);
    const [sortConfig, setSortConfig] = useState({ key: 'layer', direction: 'desc' });
    const [isShiftHeld, setIsShiftHeld] = useState(false);

    // Track Shift key for expansion behavior
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift') setIsShiftHeld(true);
        };
        const handleKeyUp = (e) => {
            if (e.key === 'Shift') setIsShiftHeld(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Create telemetry lookup map for sorting/rendering
    const telemetryMap = useMemo(() => {
        if (!telemetry) return new Map();
        return new Map(telemetry.map(t => [t.name, t]));
    }, [telemetry]);
    const isScene = type === 'scene';
    const layers = isScene ? (asset.config?.layers || []) : [{ sprite_name: asset.name, behaviors: asset.metadata?.behaviors || [] }];

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

    // Sort layers
    const sortedLayers = [...evaluatedLayers].sort((a, b) => {
        let diff = 0;
        if (sortConfig.key === 'name') {
            diff = a.sprite_name.localeCompare(b.sprite_name);
        } else if (sortConfig.key === 'layer') {
            diff = a.displayZ - b.displayZ;
        } else {
            // Telemetry sorting
            const tA = telemetryMap.get(a.sprite_name);
            const tB = telemetryMap.get(b.sprite_name);
            const valA = tA ? tA[sortConfig.key] : -Infinity;
            const valB = tB ? tB[sortConfig.key] : -Infinity;
            // Handle undefined/null as lowest
            const safeA = (valA === undefined || valA === null) ? -Infinity : valA;
            const safeB = (valB === undefined || valB === null) ? -Infinity : valB;
            diff = safeA - safeB;
        }

        if (sortConfig.direction === 'desc') diff *= -1;

        // Tie-break with name always (asc)
        if (diff === 0 && sortConfig.key !== 'name') {
            return a.sprite_name.localeCompare(b.sprite_name);
        }
        return diff;
    });

    const toggleSort = (key) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
            }
            // Default desc for numbers (layer, telemetry), asc for name
            const defaultDirection = key === 'name' ? 'asc' : 'desc';
            return { key, direction: defaultDirection };
        });
    };

    const renderHeaderParams = (key, label, extraClass) => (
        <div
            className={`flex items-center justify-end cursor-pointer transition-colors ${extraClass}`}
            onClick={() => toggleSort(key)}
            title={`Sort by ${label}`}
        >
            <span className={sortConfig.key === key ? 'text-primary' : 'hover:text-main'}>{label}</span>
            <Icon
                name={sortConfig.key === key ? (sortConfig.direction === 'desc' ? 'sortDown' : 'sortUp') : 'sortDown'}
                size={12}
                className={`inline ml-0.5 ${sortConfig.key === key ? 'text-primary opacity-100' : 'opacity-20'}`}
            />
        </div>
    );


    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto flex flex-col gap-px px-0.5">
                {/* Column Headers - Sticky inside scrollable container */}
                <div
                    className="sticky top-0 z-10 flex items-center gap-1 px-1 py-1 border-b border-muted bg-surface text-xxs font-bold uppercase tracking-wider text-muted select-none cursor-pointer"
                    onDoubleClick={onHeaderDoubleClick}
                    title="Double-click to toggle sidebar size"
                >
                    {/* Visibility Header */}
                    <div className="flex items-center justify-center gap-0.5 sl-col-vis" title="Twisty / Expand">
                        <div className="sl-col-spacer-12"></div>
                        {/* Placeholder for Add Behavior is integrated into the width/spacing if needed, or separate column */}
                    </div>

                    {/* Spacer for Add Behavior Button in Rows */}
                    <div className="sl-col-add"></div>

                    <div
                        className="flex items-center justify-center cursor-pointer transition-colors sl-col-z"
                        onClick={() => toggleSort('layer')}
                        title="Sort by Z-Depth"
                    >
                        <span className={sortConfig.key === 'layer' ? 'text-primary' : 'hover:text-main'}>Z</span>
                        <Icon
                            name={sortConfig.key === 'layer' ? (sortConfig.direction === 'desc' ? 'sortDown' : 'sortUp') : 'sortDown'}
                            size={12}
                            className={`inline ml-0.5 ${sortConfig.key === 'layer' ? 'text-primary opacity-100' : 'opacity-20'}`}
                        />
                    </div>
                    <div className="flex-shrink-0 sl-col-spacer-8"></div> {/* Space for thumbnail alignment */}
                    <div
                        className="flex-1 flex items-center cursor-pointer transition-colors sl-col-name"
                        onClick={() => toggleSort('name')}
                        title="Sort by Name"
                    >
                        <span className={sortConfig.key === 'name' ? 'text-primary' : 'hover:text-main'}>Sprite</span>
                        <Icon
                            name={sortConfig.key === 'name' ? (sortConfig.direction === 'desc' ? 'sortDown' : 'sortUp') : 'sortUp'}
                            size={12}
                            className={`inline ml-0.5 ${sortConfig.key === 'name' ? 'text-primary opacity-100' : 'opacity-20'}`}
                        />
                    </div>
                    {/* Telemetry Columns - Only show if enabled */}
                    {isScene && showTelemetry && (
                        <>
                            {renderHeaderParams('x', 'X', 'sl-col-tele')}
                            {renderHeaderParams('y', 'Y', 'sl-col-tele')}
                            {renderHeaderParams('speed', 'Spd', 'sl-col-tele')}
                            {renderHeaderParams('tilt', 'Tilt', 'sl-col-tele')}
                        </>
                    )}

                    <div className="flex items-center justify-end gap-0">
                        {/* Add Behavior moved to left */}
                        {isScene && (
                            <div className="flex items-center justify-center sl-col-actions" title="Delete Sprite">
                            </div>
                        )}
                        <div className="flex items-center justify-center sl-col-actions" title="Expand All">
                        </div>
                    </div>
                </div>

                {sortedLayers.map((layer) => {
                    const isSelected = selectedSprites.includes(layer.sprite_name);
                    return (
                        <SpriteAccordionItem
                            key={layer.sprite_name}
                            layer={layer}
                            isSelected={isSelected}
                            isShiftHeld={isShiftHeld}
                            selectedBehaviorIndex={selectedSprite === layer.sprite_name ? selectedBehaviorIndex : null}
                            isVisible={layerVisibility[layer.sprite_name] !== false}
                            onSelect={(shiftKey) => {
                                if (shiftKey) {
                                    // Toggle/Multi-select Logic
                                    let newSelection;
                                    if (isSelected) {
                                        newSelection = selectedSprites.filter(s => s !== layer.sprite_name);
                                    } else {
                                        newSelection = [...selectedSprites, layer.sprite_name];
                                    }
                                    // Primary is clicked sprite if selected, else last of remaining?
                                    // If we deselect current primary, who becomes primary?
                                    // Logic matching SelectionManager:
                                    // If we select a new one, it becomes primary.
                                    // If we deselect primary, last added becomes primary.
                                    let newPrimary = layer.sprite_name;
                                    if (isSelected) {
                                        // We just deselected it
                                        newPrimary = newSelection.length > 0 ? newSelection[newSelection.length - 1] : null;
                                    }
                                    onSpriteSelected(newPrimary, newSelection);
                                } else {
                                    // Single Select
                                    if (isSelected && selectedSprites.length === 1) {
                                        // Clicked already selected unique item -> deselect? Or keep?
                                        // Standard behavior: keep selected if clicking again.
                                        // Toggle is handled by SelectionManager if clicking canvas. 
                                        // In list, usually clicking keeps it selected.
                                        // But if we want to support toggle-off by clicking again in list:
                                        // onSpriteSelected(null, []);
                                        // Let's stick to "Set as single selection".
                                        onSpriteSelected(layer.sprite_name, [layer.sprite_name]);
                                    } else {
                                        onSpriteSelected(layer.sprite_name, [layer.sprite_name]);
                                    }
                                }
                            }}
                            onToggleVisibility={() => onToggleVisibility(layer.sprite_name)}
                            onDeleteSprite={() => onDeleteSprite(layer.sprite_name)}
                            onBehaviorsChange={(newBehaviors) => onBehaviorsChange(newBehaviors)}
                            onBehaviorSelect={(idx) => onBehaviorSelect && onBehaviorSelect(layer.sprite_name, idx)}
                            behaviorGuidance={selectedSprite === layer.sprite_name ? behaviorGuidance : null}
                            isScene={isScene}
                            displayZ={layer.displayZ}
                            currentTime={currentTime}
                            telemetryData={telemetryMap.get(layer.sprite_name)}
                            showTelemetry={showTelemetry}
                            onLayerUpdate={onLayerUpdate}
                        />
                    );
                })}
            </div>
        </div>
    );

}

const ThumbnailPortal = ({ src, rect }) => {
    if (!rect) return null;

    // Scale 2.5x
    const scale = 2.5;
    const width = 48 * scale;
    const height = 48 * scale;

    // Center over original
    const top = rect.top + (rect.height / 2) - (height / 2);
    const left = rect.left + (rect.width / 2) - (width / 2);

    const style = {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 9999,
        pointerEvents: 'none',
        backgroundColor: 'var(--color-bg-base)',
        border: '1px solid var(--color-primary)',
        borderRadius: '4px',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'linear-gradient(45deg, var(--color-bg-elevated) 25%, transparent 25%), linear-gradient(-45deg, var(--color-bg-elevated) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-bg-elevated) 75%), linear-gradient(-45deg, transparent 75%, var(--color-bg-elevated) 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px 4px, 4px 0',
    };

    return createPortal(
        <div style={style} className="sl-thumbnail-portal-zoom">
            <img
                src={src}
                alt=""
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
            />
        </div>,
        document.body
    );
};

function SpriteAccordionItem({
    layer,
    isSelected,
    isShiftHeld,
    selectedBehaviorIndex, // Index of the specifically selected behavior (for timeline sync)
    isVisible,
    onSelect,
    onToggleVisibility,
    onDeleteSprite,
    onBehaviorsChange,
    onBehaviorSelect, // (behaviorIndex) => void
    behaviorGuidance,
    isScene,
    displayZ,
    currentTime,
    telemetryData,
    showTelemetry,
    onLayerUpdate
}) {
    const [isExpanded, setIsExpanded] = useState(isSelected);
    const [isAdding, setIsAdding] = useState(false);
    const [hoveredRect, setHoveredRect] = useState(null);

    const itemRef = useRef(null);

    // Auto-expand when selected OR when a specific behavior is selected via timeline
    useEffect(() => {
        // Force expand if selected AND shift is held
        if ((isSelected && isShiftHeld) || (selectedBehaviorIndex !== null && selectedBehaviorIndex !== undefined)) {
            setIsExpanded(true);
        }
    }, [isSelected, isShiftHeld, selectedBehaviorIndex]);

    // Auto-scroll if selected OR expanded
    useEffect(() => {
        if ((isSelected || isExpanded) && itemRef.current && itemRef.current.scrollIntoView) {
            // Increased timeout to 100ms to verify layout stability before scrolling
            // This helps with "expanding out of view" issues at the bottom
            const timeoutId = setTimeout(() => {
                itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [isSelected, isExpanded]);

    // Handle Escape key to close the Add Behavior popup
    useEffect(() => {
        if (!isAdding) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsAdding(false);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isAdding]);

    // Verify URL construction - defaulting to standard path
    const assetBase = window.API_BASE ? window.API_BASE.replace('/api', '/assets') : `${window.location.protocol}//${window.location.hostname}:8000/assets`;
    const thumbnailSrc = `${assetBase}/users/default/sprites/${layer.sprite_name}/${layer.sprite_name}.png`;

    const handleAddBehavior = (type) => {
        const newBehavior = createDefaultBehavior(type);
        // Inject current time for non-background behaviors
        if (type !== BehaviorTypes.BACKGROUND) {
            newBehavior.time_offset = parseFloat((currentTime || 0).toFixed(2));
        }
        const currentBehaviors = layer.behaviors || [];
        onBehaviorsChange([...currentBehaviors, newBehavior]);
        setIsAdding(false);
        setIsExpanded(true); // Ensure expanded to see the new behavior
    };
    return (
        <div
            ref={itemRef}
            id={`sprite-list-item-${layer.sprite_name}`}
            className={`card card-interactive sl-row p-0 flex-shrink-0 no-round ${isSelected ? 'selected' : ''}`}
            style={{ zIndex: isAdding ? 100 : (isSelected ? 1 : 'auto'), position: (isAdding || isSelected) ? 'relative' : 'static' }}
        >
            <div
                className="flex items-center gap-1 px-1 py-1 cursor-pointer select-none min-h-7"
                onClick={(e) => {
                    onSelect(e.shiftKey);
                    // Toggle expansion only if NOT shift-clicking (selecting multiple shouldn't auto-collapse/expand unpredictably unless forced)
                    // Logic: If shift held -> Expansion force handled by effect.
                    // If not shift held -> Toggle expansion if clicking?
                    if (!e.shiftKey) setIsExpanded(!isExpanded);
                }}
            >
                {/* Visibility Toggle (Left) */}
                <div className="flex items-center justify-center sl-col-vis">
                    <Button
                        variant="icon"
                        size="xs"
                        style={{ opacity: isVisible ? 1 : 0.5 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisibility();
                        }}
                        title={isVisible ? "Hide Sprite" : "Show Sprite"}
                        icon={isVisible ? "visible" : "hidden"}
                    />
                </div>

                {/* Add Behavior Button (Relocated to Right of Eye) */}
                <div className="flex items-center justify-center relative sl-col-add">
                    <Button
                        variant="icon"
                        size="xs"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsAdding(!isAdding);
                        }}
                        title="Add Behavior"
                        icon="add"
                    />
                    {/* Add Behavior Menu - Left aligned */}
                    {isAdding && (
                        <div className="sl-behavior-popup" onClick={e => e.stopPropagation()}>
                            {Object.values(BehaviorTypes).map(type => (
                                <Button
                                    key={type}
                                    variant="ghost"
                                    size="xs"
                                    isBlock
                                    className="sl-behavior-menu-item"
                                    onClick={() => handleAddBehavior(type)}
                                >
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Left Side: Z-Depth Column */}
                <div
                    className="flex items-center justify-center font-mono text-xxs text-subtle opacity-80 sl-col-z"
                    title="Click to edit Layer (Z-Depth)"
                    onClick={(e) => e.stopPropagation()}
                >
                    {isScene && onLayerUpdate ? (
                        <input
                            key={displayZ} // Force reset when prop changes
                            className="w-full bg-transparent text-center outline-none p-0 border-none hover:text-white focus:text-white focus:bg-surface-active rounded-sm transition-colors cursor-text"
                            defaultValue={displayZ}
                            type="text"
                            style={{ maxWidth: '24px' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => e.target.select()}
                            onBlur={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val !== displayZ) {
                                    onLayerUpdate(layer.sprite_name, { z_depth: val });
                                } else {
                                    e.target.value = displayZ;
                                }
                            }}
                        />
                    ) : (
                        displayZ
                    )}
                </div>

                {/* Thumbnail - Shrink by 20% (40->32) and reduce zoom */}
                <div
                    className="flex items-center justify-start flex-shrink-0 sl-col-thumb"
                    onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredRect(rect);
                    }}
                    onMouseLeave={() => setHoveredRect(null)}
                >
                    <div className="sl-thumbnail-checkerboard rounded-sm flex items-center justify-center overflow-hidden border border-muted shadow-sm">
                        <img
                            src={thumbnailSrc}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => { e.target.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }}
                        />
                    </div>
                </div>

                <div
                    className={`flex-1 text-sm ${isSelected ? 'text-main font-semibold' : 'text-muted font-medium'} flex items-center justify-start text-left ${isVisible ? 'opacity-100' : 'opacity-50'}`}
                    style={{ gap: 0, minWidth: '80px' }}
                    title={layer.sprite_name}
                >
                    {/* Middle Truncation Strategy: Start (flex, truncates) + End (fixed) */}
                    <span className="truncate flex-shrink mr-px">
                        {layer.sprite_name.length > 8 ? layer.sprite_name.slice(0, -4) : layer.sprite_name}
                    </span>
                    {layer.sprite_name.length > 8 && (
                        <span className="flex-shrink-0">
                            {layer.sprite_name.slice(-4)}
                        </span>
                    )}
                </div>

                {/* Telemetry Data */}
                {isScene && showTelemetry && (
                    <>
                        <div className="flex items-center justify-end font-mono text-xxs text-subtle sl-col-tele">
                            {telemetryData ? Math.round(telemetryData.x) : '-'}
                        </div>
                        <div className="flex items-center justify-end font-mono text-xxs text-subtle sl-col-tele">
                            {telemetryData ? telemetryData.y.toFixed(0) : '-'}
                        </div>
                        <div className="flex items-center justify-end font-mono text-xxs text-subtle sl-col-tele">
                            {telemetryData ? telemetryData.speed?.toFixed(1) : '-'}
                        </div>
                        <div className="flex items-center justify-end font-mono text-xxs text-subtle sl-col-tele">
                            {telemetryData ? `${telemetryData.tilt.toFixed(0)}°` : '-'}
                        </div>
                    </>
                )}

                {/* Right Side: Controls - Tight and Right-Justified */}
                {/* Removed extra padding/gaps to make icons 'much closer' */}
                <div className="flex-shrink-0 flex items-center justify-end gap-0 relative">
                    <div className="flex items-center" style={{ gap: 0 }} onClick={e => e.stopPropagation()}>
                        {isScene && (
                            <Button
                                variant="icon"
                                size="xs"
                                className="text-error sl-col-actions"
                                onClick={() => onDeleteSprite()}
                                title="Delete Sprite"
                                icon="delete"
                            />
                        )}
                        <Button
                            variant="icon"
                            size="xs"
                            className="sl-col-actions"
                            title={isExpanded ? "Collapse Behaviors" : "Expand Behaviors"}
                            icon={isExpanded ? "collapse" : "expand"}
                        />
                    </div>
                </div>
            </div >

            {/* Expanded Content: Behaviors */}
            {
                isExpanded && (
                    <div className="sl-expanded-content">
                        <div className="w-full">
                            <BehaviorEditor
                                behaviors={layer.behaviors || []}
                                onChange={onBehaviorsChange}
                                onSelect={onBehaviorSelect}
                                readOnly={false}
                                inline={true}
                                behaviorGuidance={behaviorGuidance}
                                highlightIndex={selectedBehaviorIndex}
                            />
                        </div>
                    </div>
                )
            }
            {hoveredRect && (
                <ThumbnailPortal src={thumbnailSrc} rect={hoveredRect} />
            )}
        </div >
    );
}
