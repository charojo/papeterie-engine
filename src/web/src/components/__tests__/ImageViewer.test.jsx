import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageViewer } from '../ImageViewer';
import { TheatreStage } from '../TheatreStage';

// Mock TheatreStage
vi.mock('../TheatreStage', () => ({
    TheatreStage: vi.fn(({ scene, selectedSprite, onSpriteSelected, isExpanded, toggleExpand, onToggleSpriteVisibility, onDeleteSprite, onAddBehavior, isSpriteVisible }) => (
        <div data-testid="theatre-stage">
            Mock TheatreStage: {scene?.name || 'No Scene'}
            Selected: {selectedSprite || 'None'}
            <button onClick={() => onSpriteSelected('test-sprite')}>Select Sprite</button>
            <button onClick={toggleExpand} title={isExpanded ? "Collapse" : "Maximize (Zen Mode)"}>
                Zen
            </button>
            {onToggleSpriteVisibility && <button title={isSpriteVisible ? "Hide Sprite" : "Show Sprite"} onClick={onToggleSpriteVisibility}>Vis</button>}
            {onDeleteSprite && <button title="Delete Sprite Permanently" onClick={onDeleteSprite}>Del</button>}
            {onAddBehavior && <button title="Add Behavior" onClick={onAddBehavior}>Add</button>}
        </div>
    ))
}));

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name, className }) => <div data-testid={`icon-${name}`} className={className}>{name}</div>
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('ImageViewer', () => {
    const defaultProps = {
        scene: { name: 'test-scene', layers: [] },
        sceneName: 'test-scene',
        isOptimizing: false,
        actions: <button>Action Button</button>,
        isExpanded: false,
        toggleExpand: vi.fn(),
        onSavePosition: vi.fn(),
        onSaveScale: vi.fn(),
        onSaveRotation: vi.fn(),
        onSpriteSelected: vi.fn(),
        onAddSpriteRequested: vi.fn(),
        onDeleteSprite: vi.fn(),
        onAddBehavior: vi.fn(),
        onToggleSpriteVisibility: vi.fn(),
        isSpriteVisible: true,
        onSave: vi.fn(),
        hasChanges: false,
        activeSprite: 'sprite1',
        assetBaseUrl: 'http://test/assets',
        inputContext: 'vis',
        onTimelineArrow: vi.fn(),
        currentTime: 10,
        onTelemetry: vi.fn(),
        debugMode: 'off',
        layerVisibility: {},
        onToggleVisibility: vi.fn(),
        onPlayPause: vi.fn(),
        onTimeUpdate: vi.fn(),
        isPlaying: false,
        style: { height: '100px' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders TheatreStage with correct props', () => {
        render(<ImageViewer {...defaultProps} />);
        expect(screen.getByTestId('theatre-stage')).toBeInTheDocument();

        // Check if TheatreStage mock was called with all props
        expect(TheatreStage).toHaveBeenCalledWith(expect.objectContaining({
            scene: defaultProps.scene,
            sceneName: defaultProps.sceneName,
            currentTime: defaultProps.currentTime,
            onTelemetry: defaultProps.onTelemetry,
            debugMode: defaultProps.debugMode,
            isPlaying: defaultProps.isPlaying,
            onPlayPause: defaultProps.onPlayPause,
            layerVisibility: defaultProps.layerVisibility,
            onToggleVisibility: defaultProps.onToggleVisibility,
            selectedSprite: defaultProps.activeSprite,
            onSpriteSelected: defaultProps.onSpriteSelected,
            onSpritePositionChanged: defaultProps.onSavePosition,
            onSpriteScaleChanged: defaultProps.onSaveScale,
            onSpriteRotationChanged: defaultProps.onSaveRotation,
            onAddSpriteRequested: defaultProps.onAddSpriteRequested,
            isExpanded: defaultProps.isExpanded,
            toggleExpand: defaultProps.toggleExpand,
            assetBaseUrl: defaultProps.assetBaseUrl,
            isSpriteVisible: defaultProps.isSpriteVisible,
            onToggleSpriteVisibility: defaultProps.onToggleSpriteVisibility,
            onDeleteSprite: defaultProps.onDeleteSprite,
            onAddBehavior: defaultProps.onAddBehavior,
            onSave: defaultProps.onSave,
            hasChanges: defaultProps.hasChanges,
            inputContext: defaultProps.inputContext,
            onTimeUpdate: defaultProps.onTimeUpdate,
            onTimelineArrow: defaultProps.onTimelineArrow,
        }), undefined);
    });

    it('renders optimizing overlay when isOptimizing is true', () => {
        render(<ImageViewer {...defaultProps} isOptimizing={true} />);
        expect(screen.getByTestId('icon-optimize')).toBeInTheDocument();
    });

    it('renders actions correctly', () => {
        render(<ImageViewer {...defaultProps} />);
        expect(screen.getByText('Action Button')).toBeInTheDocument();
    });

    it('handles expand toggle', () => {
        render(<ImageViewer {...defaultProps} />);
        const expandBtn = screen.getByTitle('Maximize (Zen Mode)');
        fireEvent.click(expandBtn);
        expect(defaultProps.toggleExpand).toHaveBeenCalled();
    });

    it('renders controls when sprite active', () => {
        render(<ImageViewer {...defaultProps} />);
        expect(screen.getByTitle('Add Behavior')).toBeInTheDocument();
        expect(screen.getByTitle('Hide Sprite')).toBeInTheDocument();
        expect(screen.getByTitle('Delete Sprite Permanently')).toBeInTheDocument();
    });
});
