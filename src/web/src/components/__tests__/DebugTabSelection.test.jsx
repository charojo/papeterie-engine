import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneDetailView } from '../SceneDetailView';
import { useAssetController } from '../../hooks/useAssetController';

// Mock dependencies
vi.mock('../AssetDetailLayout', () => ({
    AssetDetailLayout: ({ title, statusLabel: _statusLabel, actions: _actions, visualContent, configContent }) => (
        <div data-testid="detail-layout">
            <h1 data-testid="detail-title">{title}</h1>
            <div data-testid="detail-visual">{visualContent}</div>
            <div data-testid="detail-config">{configContent}</div>
        </div>
    )
}));

vi.mock('../../hooks/useAssetController', () => ({
    useAssetController: vi.fn()
}));

// Mock other sub-components to keep test focused
vi.mock('../ImageViewer', () => ({ ImageViewer: () => <div data-testid="image-viewer">ImageViewer</div> }));
vi.mock('../SpriteListEditor', () => ({
    SpriteListEditor: ({ showTelemetry, onSpriteSelected }) => (
        <div data-testid="sprite-list-editor">
            SpriteListEditor
            {showTelemetry && (
                <table>
                    <tbody>
                        <tr onClick={() => onSpriteSelected('sprite1')}><td>sprite1</td></tr>
                        <tr onClick={() => onSpriteSelected('sprite2')}><td>sprite2</td></tr>
                    </tbody>
                </table>
            )}
            {showTelemetry && <div>Live Telemetry</div>}
        </div>
    )
}));
vi.mock('../TimelineEditor', () => ({ TimelineEditor: () => <div data-testid="timeline-editor">TimelineEditor</div> }));
vi.mock('../SmartConfigViewer', () => ({ SmartConfigViewer: () => <div data-testid="smart-config-viewer">SmartConfigViewer</div> }));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('SceneDetailView Debug Tab Selection', () => {
    const mockHandleSpriteSelectedWithTimelineSync = vi.fn();
    const mockHandleTabChange = vi.fn();

    const baseAsset = { name: 'test-scene', config: { layers: [] } };

    const mockControllerData = {
        logs: [],
        activeTab: 'sprites',
        handleTabChange: mockHandleTabChange,
        selectedImage: 'original',
        telemetry: [
            { name: 'sprite1', x: 100, y: 200, tilt: 5 },
            { name: 'sprite2', x: 300, y: 400, tilt: -10 }
        ],
        layerVisibility: { sprite1: true, sprite2: true },
        debugOverlayMode: 'auto',
        setDebugOverlayMode: vi.fn(),
        toggleLayerVisibility: vi.fn(),
        handleUpdateConfig: vi.fn(),
        handleTelemetry: vi.fn(),
        handleSpriteSelected: mockHandleSpriteSelectedWithTimelineSync,
        statusLabel: 'Configured',
        selectedSprites: [],
        visualPrompt: '',
        setVisualPrompt: vi.fn(),
        undo: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        useAssetController.mockReturnValue(mockControllerData);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders telemetry table when detailsMode is on', () => {
        // Need to simulate detailsMode = 'on' which is internal state of SceneDetailView
        // Since we can't easily set internal state from outside with standard render, 
        // and we are mocking everything else, let's see how we can trigger it.
        // Actually, we can click the "on" button in the overlay control.
        render(<SceneDetailView asset={baseAsset} refresh={vi.fn()} />);

        const detailsOnBtn = screen.getByTitle('Toggle details columns on');
        fireEvent.click(detailsOnBtn);

        expect(screen.getByText('Live Telemetry')).toBeInTheDocument();
        expect(screen.getByText('sprite1')).toBeInTheDocument();
        expect(screen.getByText('sprite2')).toBeInTheDocument();
    });

    it('calls handleSpriteSelected when a telemetry row is clicked', () => {
        render(<SceneDetailView asset={baseAsset} refresh={vi.fn()} />);

        const detailsOnBtn = screen.getByTitle('Toggle details columns on');
        fireEvent.click(detailsOnBtn);

        const row1 = screen.getByText('sprite1').closest('tr');
        fireEvent.click(row1);

        expect(mockHandleSpriteSelectedWithTimelineSync).toHaveBeenCalledWith('sprite1', undefined);
    });

    it('scrolls selected row into view via useEffect after timeout', () => {
        // Mock getElementById to return a dummy element
        const mockEl = { scrollIntoView: vi.fn() };
        const getElementSpy = vi.spyOn(document, 'getElementById').mockReturnValue(mockEl);

        // Change mock to simulate a specific sprite being selected
        useAssetController.mockReturnValue({
            ...mockControllerData,
            selectedImage: 'sprite2'
        });

        render(<SceneDetailView asset={baseAsset} refresh={vi.fn()} />);

        const detailsOnBtn = screen.getByTitle('Toggle details columns on');
        fireEvent.click(detailsOnBtn);

        // Fast-forward timers
        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(mockEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
        getElementSpy.mockRestore();
    });
});
