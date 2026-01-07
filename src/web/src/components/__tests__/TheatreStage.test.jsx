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
            this.updateScene = vi.fn();
            this.selectSprite = vi.fn();
            this.handleDragStart = vi.fn().mockReturnValue(false);
            this.handleDragMove = vi.fn();
            this.handleDragEnd = vi.fn();
            this.getHandleAtPoint = vi.fn().mockReturnValue(null);
            this.handleCanvasClick = vi.fn();
            this.setMousePosition = vi.fn();
            this.screenToWorld = vi.fn().mockImplementation((x, y) => ({
                x: (x - 500) / (this.cameraZoom || 1) - (this.cameraPanX || 0) + 500,
                y: (y - 500) / (this.cameraZoom || 1) - (this.cameraPanY || 0) + 500
            }));
            this.worldToScreen = vi.fn().mockImplementation((x, y) => ({
                x: (x - 500 + (this.cameraPanX || 0)) * (this.cameraZoom || 1) + 500,
                y: (y - 500 + (this.cameraPanY || 0)) * (this.cameraZoom || 1) + 500
            }));
            this.debugMode = false;
            this.onTelemetry = null;
            this.onSpriteSelected = null;
            this.onSpritePositionChanged = null;
            this.isPaused = true;
            this.cameraZoom = 1.0;
            this.cameraPanX = 0;
            this.cameraPanY = 0;
            mockTheatreInstances.push(this);
        }
        setRotation = vi.fn();
    }
}));

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name, ...props }) => <span data-testid={`icon-${name}`} {...props}>{name}</span>
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
            overflow: 'visible'
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
        const { getByTitle, getByTestId, rerender } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        // wait for first effect
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockTheatreInstances.length).toBe(1);
        const firstInstance = mockTheatreInstances[0];

        // Simulate togglePause
        firstInstance.togglePause.mockImplementation(function () {
            this.isPaused = !this.isPaused;
        });

        const playAllButton = getByTitle('Play All Sprites');
        // Initial state is paused (icon: play)
        expect(getByTestId('icon-play')).toBeInTheDocument();

        fireEvent.click(playAllButton);

        // Component state should update and re-render showing pause icon (playing)
        expect(getByTestId('icon-pause')).toBeInTheDocument();

        // Update scene (simulate drag end refresh)
        const updatedScene = { ...mockScene, layers: [] };
        rerender(<TheatreStage scene={updatedScene} sceneName="test_scene" />);

        // Wait for effect
        await new Promise(resolve => setTimeout(resolve, 0));

        // Should reuse the same instance (efficient update)
        expect(mockTheatreInstances.length).toBe(1);

        // Verify updateScene was called
        expect(firstInstance.updateScene).toHaveBeenCalledWith(updatedScene);

        // Verify it remains playing (persisted false state)
        expect(firstInstance.isPaused).toBe(false);
    });

    it('handles solo playback', async () => {
        const { getByTestId, getByTitle } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" selectedSprite="boat" />
        );

        await new Promise(resolve => setTimeout(resolve, 0));
        const theatre = mockTheatreInstances[0];
        theatre.resume = vi.fn();

        const playSpriteButton = getByTitle('Play Sprite');
        fireEvent.click(playSpriteButton);

        expect(theatre.soloSprite).toBe('boat');
        expect(theatre.resume).toHaveBeenCalled();
        expect(getByTitle('Pause Sprite')).toBeInTheDocument();
        expect(getByTestId('icon-pause')).toBeInTheDocument();
    });

    it('handles zoom in and out', async () => {
        const { getByTitle } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        await new Promise(resolve => setTimeout(resolve, 0));
        const theatre = mockTheatreInstances[0];

        const zoomInButton = getByTitle('Zoom In');
        const zoomOutButton = getByTitle('Zoom Out');

        // Initial zoom should be 1.0
        expect(theatre.cameraZoom).toBe(1.0);

        fireEvent.click(zoomInButton);
        expect(theatre.cameraZoom).toBeGreaterThan(1.0);

        const zoomedInValue = theatre.cameraZoom;
        fireEvent.click(zoomOutButton);
        expect(theatre.cameraZoom).toBeLessThan(zoomedInValue);
    });

    it('handles viewpoint reset', async () => {
        const { getByTitle } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        await new Promise(resolve => setTimeout(resolve, 0));
        const theatre = mockTheatreInstances[0];

        const zoomInButton = getByTitle('Zoom In');
        const resetButton = getByTitle('Reset View');

        fireEvent.click(zoomInButton);
        expect(theatre.cameraZoom).not.toBe(1.0);

        fireEvent.click(resetButton);
        expect(theatre.cameraZoom).toBe(1.0);
        expect(theatre.cameraPanX).toBe(0);
        expect(theatre.cameraPanY).toBe(0);
    });

    it('handles mouse wheel zoom', async () => {
        const { container } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );

        await new Promise(resolve => setTimeout(resolve, 0));
        const theatre = mockTheatreInstances[0];
        const canvas = container.querySelector('canvas');

        // Mock getBoundingClientRect for pan calculation
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            top: 0,
            width: 1000,
            height: 1000
        });

        // Initial zoom 1.0
        expect(theatre.cameraZoom).toBe(1.0);

        // Simulate wheel zoom in (ctrl + deltaY negative)
        fireEvent.wheel(canvas, {
            deltaY: -100,
            ctrlKey: true,
            clientX: 500,
            clientY: 500
        });

        // Wait for state update and effect
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(theatre.cameraZoom).toBeGreaterThan(1.0);

        const currentZoom = theatre.cameraZoom;

        // Simulate wheel zoom out (ctrl + deltaY positive)
        fireEvent.wheel(canvas, {
            deltaY: 100,
            ctrlKey: true,
            clientX: 500,
            clientY: 500
        });

        await new Promise(resolve => setTimeout(resolve, 10));
        expect(theatre.cameraZoom).toBeLessThan(currentZoom);
    });

    describe('Rotation Controls', () => {
        const onSpriteRotationChanged = vi.fn();

        beforeEach(() => {
            onSpriteRotationChanged.mockClear();
        });

        it('updates local state but not backend on slider change', async () => {
            const { getByTitle } = render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpriteRotationChanged={onSpriteRotationChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));
            const slider = getByTitle('Rotate Sprite');

            // Change slider value
            fireEvent.change(slider, { target: { value: '45' } });

            // Backend callback should NOT be called yet
            expect(onSpriteRotationChanged).not.toHaveBeenCalled();
            // Local value should be updated
            expect(slider.value).toBe('45');
        });

        it('calls backend only on slider interaction end', async () => {
            const { getByTitle } = render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpriteRotationChanged={onSpriteRotationChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));
            const slider = getByTitle('Rotate Sprite');

            fireEvent.change(slider, { target: { value: '90' } });
            fireEvent.mouseUp(slider);

            expect(onSpriteRotationChanged).toHaveBeenCalledWith('boat', 90, 0);
        });

        it('rotates by 90 degrees when clicking rotation icon', async () => {
            const { getByTitle } = render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpriteRotationChanged={onSpriteRotationChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));
            const rotateIcon = getByTitle('Click to rotate 90°');

            fireEvent.click(rotateIcon);

            expect(onSpriteRotationChanged).toHaveBeenCalledWith('boat', 90, 0);

            // Second click
            fireEvent.click(rotateIcon);
            expect(onSpriteRotationChanged).toHaveBeenCalledWith('boat', 180, expect.any(Number));

            // Third click (wrap around logic: 180 + 90 = 270, which becomes -90 in -180 to 180 range)
            fireEvent.click(rotateIcon);
            expect(onSpriteRotationChanged).toHaveBeenCalledWith('boat', -90, expect.any(Number));
        });
    });
});
