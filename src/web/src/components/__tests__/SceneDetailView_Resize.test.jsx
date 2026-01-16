import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneDetailView } from '../SceneDetailView';
import * as useResizableHooks from '../../hooks/useResizable';

// Mock dependencies
vi.mock('../AssetDetailLayout', () => ({
    AssetDetailLayout: ({ visualContent, onResizeHandleDoubleClick }) => (
        <div data-testid="detail-layout">
            <div data-testid="detail-visual">{visualContent}</div>
            <button data-testid="main-handle-mock" onClick={onResizeHandleDoubleClick}>Main Handle</button>
        </div>
    )
}));

vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

vi.mock('../ImageViewer', () => ({
    ImageViewer: () => <div data-testid="image-viewer">ImageViewer</div>
}));

vi.mock('../TimelineEditor', () => ({
    TimelineEditor: () => <div data-testid="timeline-editor">TimelineEditor</div>
}));

vi.mock('../SpriteListEditor', () => ({
    SpriteListEditor: () => <div data-testid="sprite-list-editor">SpriteListEditor</div>
}));

vi.mock('../../hooks/useAssetController', () => ({
    useAssetController: () => ({
        logs: '',
        isOptimizing: false,
        selectedImage: 'original',
        layerVisibility: {},
        selectedSprites: [],
        visualPrompt: '',
        setVisualPrompt: vi.fn()
    })
}));

describe('SceneDetailView Resize Interactions', () => {
    const mockMainResizable = {
        ratio: 0.67,
        setRatio: vi.fn(),
        isResizing: false,
        startResize: vi.fn()
    };

    const mockTheatreResizable = {
        ratio: 0.65,
        setRatio: vi.fn(),
        isResizing: false,
        startResize: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset ratios to defaults
        mockMainResizable.ratio = 0.67;
        mockTheatreResizable.ratio = 0.65;

        // Mock useResizableRatio with implementation that matches by key
        vi.spyOn(useResizableHooks, 'useResizableRatio').mockImplementation((key) => {
            if (key.includes('theatre-timeline-split')) {
                return mockTheatreResizable;
            }
            if (key === 'papeterie-panel-split') {
                return mockMainResizable;
            }
            return { ratio: 0, setRatio: vi.fn(), isResizing: false, startResize: vi.fn() };
        });
    });

    it('toggles main split ratio on double click', async () => {
        const mockAsset = { name: 'test-scene', config: { layers: [] } };
        const { rerender } = render(<SceneDetailView asset={mockAsset} refresh={vi.fn()} onDelete={vi.fn()} />);

        const mainHandle = screen.getByTestId('main-handle-mock');

        // 1. Initial double click -> Maximize Left (0.85)
        await act(async () => {
            fireEvent.click(mainHandle);
        });
        expect(mockMainResizable.setRatio).toHaveBeenCalledWith(0.85);

        // 2. Update mock state and RERENDER
        mockMainResizable.ratio = 0.85;
        rerender(<SceneDetailView asset={mockAsset} refresh={vi.fn()} onDelete={vi.fn()} />);

        // 3. Second double click -> Restore (0.67)
        await act(async () => {
            fireEvent.click(mainHandle);
        });
        expect(mockMainResizable.setRatio).toHaveBeenCalledWith(0.67);
    });

    it('toggles theatre/timeline ratio on double click', async () => {
        const mockAsset = {
            name: 'test-scene',
            config: { layers: [{}, {}, {}] } // 3 layers
        };

        const containerHeight = 1000;
        vi.spyOn(window.HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(containerHeight);

        const { rerender } = render(<SceneDetailView asset={mockAsset} refresh={vi.fn()} onDelete={vi.fn()} />);

        const theatreHandle = screen.getByTitle(/Drag to resize theatre vs timeline/i);

        // targetTheatreRatio = 1 - (168 / 1000) = 0.832

        // 1. Initial double click -> Minimize Timeline
        await act(async () => {
            fireEvent.doubleClick(theatreHandle);
        });
        expect(mockTheatreResizable.setRatio).toHaveBeenCalledWith(0.832);

        // 2. Update mock state and RERENDER
        mockTheatreResizable.ratio = 0.832;
        rerender(<SceneDetailView asset={mockAsset} refresh={vi.fn()} onDelete={vi.fn()} />);

        // 3. Second double click -> Restore (0.65)
        await act(async () => {
            fireEvent.doubleClick(theatreHandle);
        });
        expect(mockTheatreResizable.setRatio).toHaveBeenCalledWith(0.65);
    });
});
