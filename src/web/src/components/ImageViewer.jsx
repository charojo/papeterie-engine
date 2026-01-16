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
    inputContext,
    onTimelineArrow,
    currentTime, // Prop for timeline sync
    onTelemetry,
    debugMode,
    layerVisibility,
    onToggleVisibility,
    onPlayPause,
    onTimeUpdate,
    isPlaying,
    style // Style prop for flex sizing
}) => {
    return (
        <div
            className={`flex flex-col w-full ${isExpanded ? 'h-full' : 'h-auto'}`}
            style={style}
        >
            {/* Unified Scene Stage */}
            <div
                className={`card glass relative p-0 overflow-visible z-250 w-full flex items-center justify-center bg-black select-none ${isExpanded ? 'flex-1 min-h-0' : 'flex-1 min-h-0'}`}
            >
                <TheatreStage
                    onTimeUpdate={onTimeUpdate}
                    onTelemetry={onTelemetry}
                    debugMode={debugMode}
                    isPlaying={isPlaying}
                    onPlayPause={onPlayPause}
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
                    // Pass-through props
                    isSpriteVisible={isSpriteVisible}
                    onToggleSpriteVisibility={onToggleSpriteVisibility}
                    onDeleteSprite={onDeleteSprite}
                    onAddBehavior={onAddBehavior}
                    onSave={onSave}
                    hasChanges={hasChanges}
                    inputContext={inputContext}
                    onTimelineArrow={onTimelineArrow}
                />

                {isOptimizing && (
                    <div className="absolute inset-0 bg-overlay flex items-center justify-center z-20">
                        <Icon name="optimize" className="animate-spin" />
                    </div>
                )}
            </div>

            {/* Controls Bar: Actions Only (Tabs Removed) - Only render if we have actions */}
            {actions && (
                <div className={`flex justify-end items-center flex-wrap gap-2 flex-shrink-0 ${isExpanded ? 'p-4' : 'p-0'}`}>
                    <div className="flex gap-2 items-center">
                        {actions}
                    </div>
                </div>
            )}
        </div>
    );
};
