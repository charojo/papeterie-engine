import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TheatreStage } from '../TheatreStage';

// Mock Theatre class
vi.mock('../../engine/Theatre', () => ({
    Theatre: class MockTheatre {
        constructor() {
            this.initialize = vi.fn().mockResolvedValue(undefined);
            this.start = vi.fn();
            this.stop = vi.fn();
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
});
