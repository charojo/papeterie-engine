import React from 'react';
import { Icon } from './Icon';
import { TheatreStage } from './TheatreStage';

// Define stable empty array for default prop to avoid infinite effect loops
const EMPTY_BEHAVIORS = [];

export const ImageViewer = ({
    scene,
    sceneName,
    isOptimizing,
    actions,
    isExpanded,
    toggleExpand,
    onSaveRotation,
    onSaveScale,
    onSavePosition,
    onAddSpriteRequested,
    // Pass-through props for TheatreStage
    onDeleteSprite,
    onAddBehavior,
    onToggleSpriteVisibility,
    isSpriteVisible,
    onSave,
    hasChanges,
    // Restored props
    activeSprite,
    onSpriteSelected,
    assetBaseUrl, // New prop passed down
    currentTime, // Prop for timeline sync
    layerVisibility,
    onToggleVisibility,
    isCommunity = false // New prop
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: isExpanded ? '100%' : 'auto' }}>
            {/* Unified Scene Stage */}
            <div
                className="card glass"
                style={{
                    position: 'relative',
                    padding: 0,
                    overflow: 'visible',
                    zIndex: 100, // Ensure toolbars render above adjacent panels
                    width: '100%',
                    flex: isExpanded ? 1 : undefined,
                    minHeight: isExpanded ? 0 : '400px',
                    aspectRatio: isExpanded ? undefined : '16/9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1a1a1a',
                    userSelect: 'none'
                }}
            >
                <TheatreStage
                    scene={scene}
                    sceneName={sceneName}
                    currentTime={currentTime}
                    layerVisibility={layerVisibility}
                    onToggleVisibility={onToggleVisibility}
                    selectedSprite={activeSprite}
                    onSpriteSelected={onSpriteSelected}
                    onSpritePositionChanged={onSavePosition}
                    onSpriteScaleChanged={onSaveScale}
                    onSpriteRotationChanged={onSaveRotation}
                    onAddSpriteRequested={onAddSpriteRequested}
                    isExpanded={isExpanded}
                    toggleExpand={toggleExpand}
                    assetBaseUrl={assetBaseUrl} // Pass through
                    isCommunity={isCommunity} // Pass through
                    debugMode={false}
                    // Pass-through props
                    isSpriteVisible={isSpriteVisible}
                    onToggleSpriteVisibility={onToggleSpriteVisibility}
                    onDeleteSprite={onDeleteSprite}
                    onAddBehavior={onAddBehavior}
                    onSave={onSave}
                    hasChanges={hasChanges}
                />

                {isOptimizing && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                        <Icon name="optimize" className="animate-spin" />
                    </div>
                )}
            </div>

            {/* Controls Bar: Actions Only (Tabs Removed) */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                flexShrink: 0,
                padding: isExpanded ? '16px' : '0'
            }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {actions}
                </div>
            </div>
        </div>
    );
};
