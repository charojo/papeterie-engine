import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageViewer } from '../ImageViewer';

// Mock TheatreStage to avoid testing its internal engine logic here
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
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders TheatreStage with correct props', () => {
        render(<ImageViewer {...defaultProps} />);
        expect(screen.getByTestId('theatre-stage')).toBeInTheDocument();
        expect(screen.getByText(/Mock TheatreStage: test-scene/)).toBeInTheDocument();
    });

    it('renders optimizing overlay when isOptimizing is true', () => {
        render(<ImageViewer {...defaultProps} isOptimizing={true} />);
        expect(screen.getByTestId('icon-optimize')).toBeInTheDocument();
    });

    it('renders actions', () => {
        render(<ImageViewer {...defaultProps} />);
        expect(screen.getByText('Action Button')).toBeInTheDocument();
    });

    it('calls toggleExpand when expand button is clicked', () => {
        render(<ImageViewer {...defaultProps} />);
        const expandBtn = screen.getByTitle('Maximize (Zen Mode)');
        fireEvent.click(expandBtn);
        expect(defaultProps.toggleExpand).toHaveBeenCalled();
    });

    it('shows sprite control buttons when activeSprite is present', () => {
        const propsWithSprite = {
            ...defaultProps,
            activeSprite: 'boat',
            onAddBehavior: vi.fn(),
            onToggleSpriteVisibility: vi.fn(),
            onDeleteSprite: vi.fn(),
            isSpriteVisible: true
        };
        render(<ImageViewer {...propsWithSprite} />);

        expect(screen.getByTitle('Add Behavior')).toBeInTheDocument();
        expect(screen.getByTitle('Hide Sprite')).toBeInTheDocument();
        expect(screen.getByTitle('Delete Sprite Permanently')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Add Behavior'));
        expect(propsWithSprite.onAddBehavior).toHaveBeenCalled();

        fireEvent.click(screen.getByTitle('Hide Sprite'));
        expect(propsWithSprite.onToggleSpriteVisibility).toHaveBeenCalled();

        fireEvent.click(screen.getByTitle('Delete Sprite Permanently'));
        expect(propsWithSprite.onDeleteSprite).toHaveBeenCalled();
    });

    it('shows "Show Sprite" icon when isSpriteVisible is false', () => {
        const propsHidden = {
            ...defaultProps,
            activeSprite: 'boat',
            isSpriteVisible: false,
            onToggleSpriteVisibility: vi.fn(),
        };
        render(<ImageViewer {...propsHidden} />);
        expect(screen.getByTitle('Show Sprite')).toBeInTheDocument();
    });

    it('propagates onSpriteSelected from TheatreStage', () => {
        render(<ImageViewer {...defaultProps} />);
        fireEvent.click(screen.getByText('Select Sprite'));
        expect(defaultProps.onSpriteSelected).toHaveBeenCalledWith('test-sprite');
    });
});
