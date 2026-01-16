import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TheatreStage } from '../TheatreStage';

// Mock Theatre class
const mockTheatreInstances = [];
vi.mock('../../engine/Theatre', () => ({
    Theatre: class MockTheatre {
        constructor(canvas) {
            this.canvas = canvas;
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
            this.layersByName = new Map();
            // Mock a layer for 'boat' to prevent undefined errors in tests
            this.layersByName.set('boat', { setRotation: vi.fn(), rotation: 0 });
            this.setCropMode = vi.fn(); // Mock setCropMode
            this.elapsedTime = 0; // Initialize elapsedTime

            this.selectionManager = {
                selectedSprites: new Set(),
                handleClick: vi.fn(),
                select: vi.fn()
            };
            this.getSelectedSprite = vi.fn();

            mockTheatreInstances.push(this);
        }
        setRotation = vi.fn();
    }
}));

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name, ...props }) => <span data-testid={`icon-${name}`} {...props}>{name}</span>
}));

vi.mock('../../hooks/useCameraController', () => ({
    useCameraController: () => ({
        zoom: 1.0,
        panX: 0,
        panY: 0,
        setZoom: vi.fn(),
        setPan: vi.fn(),
        reset: vi.fn(),
        handleWheel: vi.fn(),
        controller: { bindTheatre: vi.fn() }
    })
}));

vi.mock('../../hooks/useDraggable', () => ({
    useDraggable: () => ({
        position: null,
        startDrag: vi.fn()
    })
}));

describe('TheatreStage', () => {
    let mockScene;

    beforeEach(() => {
        mockScene = {
            name: 'test_scene',
            layers: [
                { sprite_name: 'background', z_depth: 1 },
                { sprite_name: 'boat', z_depth: 5 },
                { sprite_name: 'cloud', z_depth: 6 }
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

    // ... existing basic render tests ...
    it('renders a canvas element', () => {
        const { container } = render(
            <TheatreStage scene={mockScene} sceneName="test_scene" />
        );
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });

    // ... keep detailed existing tests ...

    describe('Selection Controls', () => {
        const onSpriteSelected = vi.fn();

        beforeEach(() => {
            onSpriteSelected.mockClear();
        });

        it('handles single click selection', async () => {
            const { container } = render(
                <TheatreStage scene={mockScene} sceneName="test_scene" onSpriteSelected={onSpriteSelected} />
            );
            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            const canvas = container.querySelector('canvas');

            // Setup mocks
            theatre.handleCanvasClick.mockReturnValue(true); // Clicked something
            theatre.getSelectedSprite.mockReturnValue('boat');
            theatre.selectionManager.selectedSprites = new Set(['boat']);

            fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

            // Expect to call with single sprite and array of one
            expect(onSpriteSelected).toHaveBeenCalledWith('boat', ['boat']);
            expect(theatre.handleCanvasClick).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), false);
        });

        it('handles Shift+Click multi-selection', async () => {
            const { container } = render(
                <TheatreStage scene={mockScene} sceneName="test_scene" onSpriteSelected={onSpriteSelected} />
            );
            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            const canvas = container.querySelector('canvas');

            // Setup mocks: 'boat' already selected? No, let's say we click 'cloud' while holding shift.
            // But TheatreStage logic is: handleCanvasClick(..., true) -> checks selected.
            theatre.handleCanvasClick.mockReturnValue(true); // Hit something
            theatre.getSelectedSprite.mockReturnValue('cloud');
            theatre.selectionManager.selectedSprites = new Set(['boat', 'cloud']);

            fireEvent.mouseDown(canvas, { clientX: 120, clientY: 120, shiftKey: true });

            expect(theatre.handleCanvasClick).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), true);
            // Verify call includes full list
            expect(onSpriteSelected).toHaveBeenCalledWith('cloud', ['boat', 'cloud']);
        });

        it('handles Shift+Click toggle (deselect)', async () => {
            // Logic: Shift click an already selected sprite -> should toggle off in manager
            // TheatreStage doesn't implement toggle logic itself, it delegates to Theatre.js -> SelectionManager.
            // It just reads value back.
            const { container } = render(
                <TheatreStage scene={mockScene} sceneName="test_scene" onSpriteSelected={onSpriteSelected} />
            );
            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            const canvas = container.querySelector('canvas');

            // Simulate result after toggle: 'boat' was selected, shift-clicked 'boat' -> now nothing or just others.
            // Assume we had 'boat' and 'cloud', shift-clicked 'cloud' -> 'cloud' removed.
            theatre.handleCanvasClick.mockReturnValue(true); // Hit valid target
            theatre.getSelectedSprite.mockReturnValue('boat'); // 'boat' remains primary/active
            theatre.selectionManager.selectedSprites = new Set(['boat']); // 'cloud' gone

            fireEvent.mouseDown(canvas, { clientX: 120, clientY: 120, shiftKey: true });

            expect(onSpriteSelected).toHaveBeenCalledWith('boat', ['boat']);
        });

        it('clears selection when clicking empty space without Shift', async () => {
            const { container } = render(
                <TheatreStage scene={mockScene} sceneName="test_scene" onSpriteSelected={onSpriteSelected} />
            );
            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            const canvas = container.querySelector('canvas');

            theatre.handleCanvasClick.mockReturnValue(false); // Hit nothing

            fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50, shiftKey: false });

            expect(onSpriteSelected).toHaveBeenCalledWith(null, []);
        });
    });

    describe('Keyboard Controls', () => {
        const onSpritePositionChanged = vi.fn();
        const onSpriteScaleChanged = vi.fn();
        const onPlayPause = vi.fn();

        beforeEach(() => {
            onSpritePositionChanged.mockClear();
            onSpriteScaleChanged.mockClear();
            onPlayPause.mockClear();
        });

        it('moves sprite with arrow keys', async () => {
            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpritePositionChanged={onSpritePositionChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));

            // Mock selected layer state - Theatre mock in tests is simplified
            // We need to ensure theatre.layersByName.get('boat') returns something with x_offset/y_offset
            const theatre = mockTheatreInstances[0];
            theatre.layersByName.set('boat', {
                setRotation: vi.fn(),
                x_offset: 100,
                y_offset: 200,
                scroll_speed: 0,
                getTransform: vi.fn().mockReturnValue({ x: 0, y: 0, scale: 1.0 })
            });

            // Arrow Right -> x + 10
            fireEvent.keyDown(window, { code: 'ArrowRight' });
            expect(onSpritePositionChanged).toHaveBeenCalledWith('boat', 110, 200, expect.any(Number));

            // Arrow Down -> y + 10
            fireEvent.keyDown(window, { code: 'ArrowDown' });
            expect(onSpritePositionChanged).toHaveBeenCalledWith('boat', 100, 210, expect.any(Number));
        });

        it('moves sprite faster with Shift key', async () => {
            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpritePositionChanged={onSpritePositionChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            theatre.layersByName.set('boat', {
                setRotation: vi.fn(),
                x_offset: 100,
                y_offset: 200,
                scroll_speed: 0,
                getTransform: vi.fn().mockReturnValue({ x: 0, y: 0, scale: 1.0 })
            });

            // Shift + Arrow Left -> x - 50
            fireEvent.keyDown(window, { code: 'ArrowLeft', shiftKey: true });
            expect(onSpritePositionChanged).toHaveBeenCalledWith('boat', 50, 200, expect.any(Number));
        });

        it('moves sprite slower with Ctrl key (micro-adjustment)', async () => {
            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpritePositionChanged={onSpritePositionChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            theatre.layersByName.set('boat', {
                setRotation: vi.fn(),
                x_offset: 100,
                y_offset: 200,
                scroll_speed: 0,
                getTransform: vi.fn().mockReturnValue({ x: 0, y: 0, scale: 1.0 })
            });

            // Ctrl + Arrow Right -> x + 1
            fireEvent.keyDown(window, { code: 'ArrowRight', ctrlKey: true });
            expect(onSpritePositionChanged).toHaveBeenCalledWith('boat', 101, 200, expect.any(Number));

            // Ctrl + Arrow Up -> y - 1
            fireEvent.keyDown(window, { code: 'ArrowUp', ctrlKey: true });
            expect(onSpritePositionChanged).toHaveBeenCalledWith('boat', 100, 199, expect.any(Number));
        });

        it('scales sprite with +/- keys', async () => {
            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpriteScaleChanged={onSpriteScaleChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            theatre.layersByName.set('boat', {
                setRotation: vi.fn(),
                _baseScale: 1.0,
                getTransform: vi.fn().mockReturnValue({ scale: 1.0 })
            });

            // + key -> scale + 0.1
            fireEvent.keyDown(window, { key: '+' });
            expect(onSpriteScaleChanged).toHaveBeenCalledWith('boat', 1.1, expect.any(Number));

            // - key -> scale - 0.1
            fireEvent.keyDown(window, { key: '-' });
            expect(onSpriteScaleChanged).toHaveBeenCalledWith('boat', 0.9, expect.any(Number));

            // Shift + + -> scale + 0.5
            fireEvent.keyDown(window, { key: '+', shiftKey: true });
            expect(onSpriteScaleChanged).toHaveBeenCalledWith('boat', 1.5, expect.any(Number));
        });

        it('toggles playback with Space bar when no sprite selected', async () => {
            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite={null}
                    onPlayPause={onPlayPause}
                />
            );

            // Space bar -> toggle play/pause
            fireEvent.keyDown(window, { code: 'Space' });
            expect(onPlayPause).toHaveBeenCalled();
        });

        it('toggles playback with Space bar even when sprite IS selected', async () => {
            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onPlayPause={onPlayPause}
                />
            );

            // Space bar -> Should still toggle play/pause as per new requirements
            fireEvent.keyDown(window, { code: 'Space' });
            expect(onPlayPause).toHaveBeenCalled();
        });
        it('prevents default behavior (scrolling) for arrow keys', async () => {
            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpritePositionChanged={onSpritePositionChanged}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));
            const theatre = mockTheatreInstances[0];
            theatre.layersByName.set('boat', {
                setRotation: vi.fn(),
                x_offset: 0,
                y_offset: 0,
                scroll_speed: 0,
                getTransform: vi.fn().mockReturnValue({ x: 0, y: 0, scale: 1.0 })
            });

            const event = new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true, cancelable: true });
            const spy = vi.spyOn(event, 'preventDefault');
            window.dispatchEvent(event);

            expect(spy).toHaveBeenCalled();
        });

        it('delegates arrow keys to onTimelineArrow when context is timeline', async () => {
            const onTimelineArrow = vi.fn();

            render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpritePositionChanged={onSpritePositionChanged}
                    inputContext="timeline"
                    onTimelineArrow={onTimelineArrow}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));

            // Arrow Right -> Should call onTimelineArrow instead of onSpritePositionChanged
            fireEvent.keyDown(window, { code: 'ArrowRight' });
            expect(onTimelineArrow).toHaveBeenCalledWith('ArrowRight');
            expect(onSpritePositionChanged).not.toHaveBeenCalled();

            // Arrow Up -> Should call onTimelineArrow
            fireEvent.keyDown(window, { code: 'ArrowUp' });
            expect(onTimelineArrow).toHaveBeenCalledWith('ArrowUp');
        });
    });

    describe('UI Controls', () => {
        it('opens keymap help dialog when keyboard icon is clicked', async () => {
            const { getByTitle, getByText } = render(
                <TheatreStage scene={mockScene} sceneName="test_scene" />
            );

            await new Promise(resolve => setTimeout(resolve, 0));

            // Icon should be present
            const keyboardButton = getByTitle('Keyboard Shortcuts');
            fireEvent.click(keyboardButton);

            // Dialog should appear
            expect(getByText('Keyboard Shortcuts')).toBeInTheDocument();
            expect(getByText('Move Selected')).toBeInTheDocument();
        });

        it('toggles layers panel and controls visibility', async () => {
            const onToggleVisibility = vi.fn();
            const { getByTitle, getByText } = render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    onToggleVisibility={onToggleVisibility}
                    layerVisibility={{ 'boat': true, 'cloud': false }}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 0));

            // Toggle Layers Panel
            const layersBtn = getByTitle('Toggle Layers Panel');
            fireEvent.click(layersBtn);

            // Check if panel content appears (Z-levels)
            // mockScene has z_depth 1, 5, 6
            expect(getByText('1')).toBeInTheDocument();
            expect(getByText('5')).toBeInTheDocument();

            // Find checkbox for level 5 (boat)
            // The text is the Z index. The input follows it.
            const level5 = getByText('5').parentElement;
            const checkbox5 = level5.querySelector('input[type="checkbox"]');

            // Click it (it toggles all in that layer)
            fireEvent.click(checkbox5.parentNode);
            // Note: The click handler is on the parent div

            // Should call onToggleVisibility for 'boat'
            // Current state: 'boat' is visible (true in props)
            // If we click, we toggle based on current state of ALL in that z-level.
            // If they are all visible, we toggle to invisible.
            expect(onToggleVisibility).toHaveBeenCalledWith('boat');
        });

        it('handles camera zoom buttons', async () => {
            const { getByTitle } = render(
                <TheatreStage scene={mockScene} sceneName="test_scene" />
            );
            await new Promise(resolve => setTimeout(resolve, 0));

            // Zoom In
            fireEvent.click(getByTitle('Zoom In'));
            // Can't verify internal state easily without exposing it, but we can verify no crash 
            // and maybe log calls if we spied heavily.
            // For now, assume good if rendering updates.

            // A better check: Reset View should be disabled initially (default zoom/pan)
            const resetBtn = getByTitle('Reset View');
            expect(resetBtn).toBeDisabled();
        });

        it('handles unified sprite toolbar (rotation, crop, save)', async () => {
            const onSpriteRotationChanged = vi.fn();
            const onSave = vi.fn();
            const { getByTitle } = render(
                <TheatreStage
                    scene={mockScene}
                    sceneName="test_scene"
                    selectedSprite="boat"
                    onSpriteRotationChanged={onSpriteRotationChanged}
                    onSave={onSave}
                    hasChanges={true}
                />
            );
            await new Promise(resolve => setTimeout(resolve, 0));

            // 1. Rotation Icon (+90)
            const rotateIcon = getByTitle('Click to rotate 90°');
            fireEvent.click(rotateIcon);
            // Expect calls
            expect(onSpriteRotationChanged).toHaveBeenCalledWith('boat', 90, expect.any(Number));

            // 2. Rotation Slider
            const slider = getByTitle('Rotate Sprite');
            fireEvent.change(slider, { target: { value: '45' } });
            // onChange calls setLocalRotation, onMouseUp calls callback
            fireEvent.mouseUp(slider);
            expect(onSpriteRotationChanged).toHaveBeenCalledWith('boat', 45, expect.any(Number));

            // 3. Save Button
            const saveBtn = getByTitle('Save Changes');
            fireEvent.click(saveBtn);
            expect(onSave).toHaveBeenCalled();

            // 4. Crop Mode
            const cropBtn = getByTitle('Crop Sprite');
            fireEvent.click(cropBtn);
            const theatre = mockTheatreInstances[0];
            expect(theatre.setCropMode).toHaveBeenCalledWith(true);
        });

        it('opens export dialog when export button is clicked', async () => {
            const { getByTitle, getByText } = render(
                <TheatreStage scene={mockScene} sceneName="test_scene" />
            );
            await new Promise(resolve => setTimeout(resolve, 0));

            // Dialog should be closed initially
            // "Export Video" is in the <h3> of the dialog
            // But verify it's not visible yet. The Title is on the button too.
            // getByTitle('Export Video') gets the button.
            // queryByText('Export Video', { selector: 'h3' }) would check the header.

            const exportBtn = getByTitle('Export Video');
            expect(exportBtn).toBeInTheDocument();

            // Click it
            fireEvent.click(exportBtn);

            // Dialog should appear
            // Check for dialog specific content
            expect(getByText('Duration (seconds)')).toBeInTheDocument();
            expect(getByText('Start Export')).toBeInTheDocument();
        });
    });
});

