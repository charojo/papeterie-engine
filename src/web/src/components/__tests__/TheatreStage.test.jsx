import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TheatreStage } from '../TheatreStage';

// Mock Theatre class
const mockTheatreInstances = [];
vi.mock('../../engine/Theatre', () => ({
    Theatre: class MockTheatre {
        constructor() {
            this.initialize = vi.fn().mockResolvedValue(undefined);
            this.start = vi.fn();
            this.stop = vi.fn();
            this.pause = vi.fn();
            this.resume = vi.fn();
            this.togglePause = vi.fn();
            this.setLayerVisibility = vi.fn();
            this.selectSprite = vi.fn();
            this.handleDragStart = vi.fn().mockReturnValue(false);
            this.handleDragMove = vi.fn();
            this.handleDragEnd = vi.fn();
            this.handleCanvasClick = vi.fn();
            this.setMousePosition = vi.fn();
            this.debugMode = false;
            this.onTelemetry = null;
            this.onSpriteSelected = null;
            this.onSpritePositionChanged = null;
            this.isPaused = false;

            mockTheatreInstances.push(this);
        }
    }
}));

describe('TheatreStage', () => {
    let mockScene;

    beforeEach(() => {
        mockScene = {
            name: 'test_scene',
            layers: [
                { sprite_name: 'background', z_depth: 1 },
                { sprite_name: 'boat', z_depth: 5 }
            ]
        };

        // Mock ResizeObserver
        global.ResizeObserver = vi.fn().mockImplementation(function () {
            return {
                observe: vi.fn(),
                disconnect: vi.fn(),
                unobserve: vi.fn()
            };
        });

        mockTheatreInstances.length = 0;
    });

    it('renders a canvas element', () => {
        const { container } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });

    it('renders container with correct styles', () => {
        const { container } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        const containerDiv = container.firstChild;
        expect(containerDiv).toHaveStyle({
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden'
        });
    });

    it('applies custom style to container', () => {
        const customStyle = { backgroundColor: 'red' };
        const { container } = render(
            <TheatreStage
                scene={mockScene}
                sceneName="test_scene"
                style={customStyle}
            />
        );

        const containerDiv = container.firstChild;
        expect(containerDiv.style.backgroundColor).toBe('red');
    });

    it('sets up ResizeObserver', () => {
        render(<TheatreStage scene={mockScene} sceneName="test_scene" />);

        expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it('handles mouse events on canvas', () => {
        const { container } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        const canvas = container.querySelector('canvas');

        // Should not throw
        fireEvent.mouseDown(canvas, { clientX: 100, clientY: 50 });
        fireEvent.mouseMove(canvas, { clientX: 150, clientY: 75 });
        fireEvent.mouseUp(canvas);
        fireEvent.mouseLeave(canvas);
    });

    it('renders without scene gracefully', () => {
        const { container } = render(
            <TheatreStage scene={null} sceneName="test_scene" />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });

    it('persists pause state across scene updates', async () => {
        const { getByText, rerender } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        // wait for first effect
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockTheatreInstances.length).toBe(1);
        const firstInstance = mockTheatreInstances[0];

        // Simulate pause click
        // Since we mocked togglePause, we need to mock its behavior of setting isPaused 
        // OR just check if the button calls it.
        // We need to trigger the state change in the component. 
        // The component calls theatre.togglePause() then setIsPaused(theatre.isPaused).
        // So we must make sure togglePause updates isPaused on the mock.
        firstInstance.togglePause.mockImplementation(function () {
            this.isPaused = !this.isPaused;
        });

        const pauseButton = getByText('⏸ Pause');
        fireEvent.click(pauseButton);

        // Component state should update and re-render
        expect(getByText('▶ Resume')).toBeInTheDocument();

        // Update scene (simulate drag end refresh)
        const updatedScene = { ...mockScene, layers: [] };
        rerender(<TheatreStage scene={updatedScene} sceneName="test_scene" />);

        // Wait for effect
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockTheatreInstances.length).toBe(2);
        const secondInstance = mockTheatreInstances[1];

        // Verify start was called
        expect(secondInstance.start).toHaveBeenCalled();

        // Verify pause was called (due to persistence)
        expect(secondInstance.pause).toHaveBeenCalled();
    });
});
