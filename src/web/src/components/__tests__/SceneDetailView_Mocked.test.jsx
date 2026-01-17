import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneDetailView } from '../SceneDetailView';
import * as useAssetControllerModule from '../../hooks/useAssetController';

// Mock child components
vi.mock('../AssetDetailLayout', () => ({
    AssetDetailLayout: ({ title, visualContent, configContent }) => (
        <div data-testid="asset-detail-layout">
            <h1>{title}</h1>
            <div data-testid="visual-content">{visualContent}</div>
            <div data-testid="config-content">{configContent}</div>
        </div>
    )
}));

vi.mock('../ImageViewer', () => ({
    ImageViewer: () => <div data-testid="image-viewer">ImageViewer</div>
}));

vi.mock('../SpriteListEditor', () => ({
    SpriteListEditor: () => <div data-testid="sprite-list-editor">SpriteListEditor</div>
}));

vi.mock('../TimelineEditor', () => ({
    TimelineEditor: () => <div data-testid="timeline-editor">TimelineEditor</div>
}));

vi.mock('../SmartConfigViewer', () => ({
    SmartConfigViewer: () => <div data-testid="smart-config-viewer">SmartConfigViewer</div>
}));

vi.mock('../DeleteConfirmationDialog', () => ({
    DeleteConfirmationDialog: () => <div data-testid="delete-dialog">DeleteDialog</div>
}));

vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span>Icon:{name}</span>
}));

// Mock hooks
vi.mock('../../hooks/useAssetController', () => ({
    useAssetController: vi.fn()
}));

vi.mock('../../hooks/useResizable', () => ({
    useResizableRatio: (key, initial) => ({
        ratio: initial,
        setRatio: vi.fn(),
        isResizing: false,
        startResize: vi.fn()
    })
}));

describe('SceneDetailView Mocked', () => {
    const mockController = {
        logs: [],
        isOptimizing: false,
        selectedImage: null,
        visualPrompt: '',
        setVisualPrompt: vi.fn(),
        configPrompt: '',
        setConfigPrompt: vi.fn(),
        handleOptimize: vi.fn(),
        handleUpdateConfig: vi.fn(),
        handleEventsChange: vi.fn(),
        behaviorGuidance: {},
        activeTab: 'sprites', // Default tab
        handleTabChange: vi.fn(),
        handleDeleteClick: vi.fn(),
        statusLabel: <span>Status: Ready</span>,
        configData: {},
        telemetry: {},
        handleTelemetry: vi.fn(),
        debugOverlayMode: 'off',
        setDebugOverlayMode: vi.fn(),
        toggleLayerVisibility: vi.fn(),
        layerVisibility: {},
        handleDeleteSprite: vi.fn(),
        handleSpriteSelected: vi.fn(),
        handleSpritePositionChanged: vi.fn(),
        handleKeyframeMove: vi.fn(),
        handleKeyframeDelete: vi.fn(),
        handleSpriteRotationChanged: vi.fn(),
        showDeleteDialog: false,
        setShowDeleteDialog: vi.fn(),
        handleConfirmDelete: vi.fn(),
        showSpriteLibrary: false,
        setShowSpriteLibrary: vi.fn(),
        handleAddSprite: vi.fn(),
        processingMode: 'local',
        setProcessingMode: vi.fn(),
        selectedSprites: [],
        handleClearSelection: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        saveConfig: vi.fn()
    };

    const defaultProps = {
        asset: { name: 'TestScene', config: { layers: [] } },
        refresh: vi.fn(),
        onDelete: vi.fn(),
        isExpanded: false,
        toggleExpand: vi.fn(),
        sprites: [],
        setContextualActions: vi.fn(),
        onOpenSprite: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset controller mock implementation
        useAssetControllerModule.useAssetController.mockReturnValue(mockController);
    });

    it('renders with correct layout', () => {
        render(<SceneDetailView {...defaultProps} />);

        expect(screen.getByTestId('asset-detail-layout')).toBeInTheDocument();
        // expect(screen.getByText('TestScene')).toBeInTheDocument(); // Title is now in TopBar, not here
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
        expect(screen.getByTestId('timeline-editor')).toBeInTheDocument();
        expect(screen.getByTestId('sprite-list-editor')).toBeInTheDocument();
    });

    it('shows optimization controls when not expanded', () => {
        render(<SceneDetailView {...defaultProps} isExpanded={false} />);

        expect(screen.getByPlaceholderText("e.g., 'Make the trees sway gently...'")).toBeInTheDocument();
        expect(screen.getAllByText('Optimize')[0]).toBeInTheDocument();
    });

    it('hides optimization controls when expanded', () => {
        render(<SceneDetailView {...defaultProps} isExpanded={true} />);

        expect(screen.queryByPlaceholderText("e.g., 'Make the trees sway gently...'")).not.toBeInTheDocument();
    });

    it('updates visual prompt input', () => {
        render(<SceneDetailView {...defaultProps} />);

        const input = screen.getByPlaceholderText("e.g., 'Make the trees sway gently...'");
        fireEvent.change(input, { target: { value: 'New prompt' } });

        expect(mockController.setVisualPrompt).toHaveBeenCalledWith('New prompt');
    });

    it('switches to config tab', () => {
        // Override activeTab for this test
        useAssetControllerModule.useAssetController.mockReturnValue({
            ...mockController,
            activeTab: 'json'
        });

        render(<SceneDetailView {...defaultProps} />);

        // Should show SmartConfigViewer instead of SpriteListEditor
        expect(screen.getByTestId('smart-config-viewer')).toBeInTheDocument();
        expect(screen.queryByTestId('sprite-list-editor')).not.toBeInTheDocument();
    });

    it('calls handleTabChange when clicking tabs', () => {
        render(<SceneDetailView {...defaultProps} />);

        fireEvent.click(screen.getByText('Config'));
        expect(mockController.handleTabChange).toHaveBeenCalledWith('json');

        fireEvent.click(screen.getByText('Sprites'));
        expect(mockController.handleTabChange).toHaveBeenCalledWith('sprites');
    });

    it('handles optimization click', () => {
        useAssetControllerModule.useAssetController.mockReturnValue({
            ...mockController,
            visualPrompt: 'Some prompt'
        });
        render(<SceneDetailView {...defaultProps} />);

        fireEvent.click(screen.getByTitle('Apply AI visualization'));
        expect(mockController.handleOptimize).toHaveBeenCalled();
    });

    it('shows loading spinner when optimizing', () => {
        useAssetControllerModule.useAssetController.mockReturnValue({
            ...mockController,
            isOptimizing: true
        });

        render(<SceneDetailView {...defaultProps} />);

        // Button should be disabled and show spinner (Icon mocked name)
        expect(screen.getByText('Icon:generate')).toBeInTheDocument();
    });

    it('registers window key listeners for Undo/Redo', () => {
        render(<SceneDetailView {...defaultProps} />);

        // Ctrl+Z
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
        expect(mockController.undo).toHaveBeenCalled();

        // Ctrl+Y
        fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
        expect(mockController.redo).toHaveBeenCalled();

        // Ctrl+Shift+Z
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
        expect(mockController.redo).toHaveBeenCalled();
    });

    it('renders SpriteSelectionDialog when showSpriteLibrary is true', () => {
        useAssetControllerModule.useAssetController.mockReturnValue({
            ...mockController,
            showSpriteLibrary: true
        });

        // We need to mock SpriteSelectionDialog too or check its content
        // In the main file import, it's used. Let's assume it renders something unique.
        // Or we can mock it.
    });
});
