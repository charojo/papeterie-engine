import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TimelineEditor } from '../TimelineEditor.jsx';

// Silence console.error for expected test failures
vi.spyOn(console, 'error').mockImplementation(() => { });
// Silence console.warn for expected test warnings
vi.spyOn(console, 'warn').mockImplementation(() => { });
// Silence console.debug for cleaner output
vi.spyOn(console, 'debug').mockImplementation(() => { });

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

describe('TimelineEditor', () => {
    const defaultProps = {
        duration: 30,
        currentTime: 0,
        layers: [],
        selectedLayer: null,
        onTimeChange: vi.fn(),
        onKeyframeMove: vi.fn(),
        onPlayPause: vi.fn(),
        onLayerUpdate: vi.fn(),
        onSelectLayer: vi.fn(),
        isPlaying: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        });
    });

    describe('rendering', () => {
        it('renders timeline component', () => {
            render(<TimelineEditor {...defaultProps} />);
            expect(screen.getByLabelText(/Play/)).toBeInTheDocument();
        });
    });

    describe('deep z-parsing and lanes', () => {
        it('renders lanes for base Z and behavior Z even if different', () => {
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [
                        { type: 'location', time_offset: 5, z_depth: 20 },
                        { type: 'location', time_offset: 10, z_depth: 5 }
                    ]
                }
            ];

            render(<TimelineEditor {...defaultProps} layers={layers} />);

            // Should see unique lanes for all 3 Z-depths (10, 20, 5)
            expect(screen.getByText('20')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('respects static location behavior z_depth', () => {
            const layers = [
                {
                    sprite_name: 'ghost',
                    behaviors: [
                        { type: 'location', z_depth: 25 } // static (undefined time_offset)
                    ]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} />);
            expect(screen.getByText('25')).toBeInTheDocument();
        });

        it('renders thumbnail markers instead of dots', () => {
            const layers = [
                { sprite_name: 'boat', z_depth: 10, behaviors: [] }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} />);

            const thumb = screen.getByAltText('boat');
            expect(thumb).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('renders time offset triangles in ruler for behavior keyframes', () => {
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [
                        { type: 'location', time_offset: 5, z_depth: 10 },
                        { type: 'location', time_offset: 10, z_depth: 10 }
                    ]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} />);

            const markers = screen.getAllByTestId('time-offset-marker');
            expect(markers.length).toBe(2);
            expect(screen.getByTitle('Keyframe at 5.0s')).toBeInTheDocument();
            expect(screen.getByTitle('Keyframe at 10.0s')).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('calls onTimeChange during scrubbing', () => {
            const onTimeChange = vi.fn();
            render(<TimelineEditor {...defaultProps} onTimeChange={onTimeChange} />);

            const ruler = screen.getByTestId('timeline-ruler');
            const timelineContainer = screen.getByTestId('timeline-tracks');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100, width: 600, top: 0, bottom: 200
            });
            vi.spyOn(ruler, 'getBoundingClientRect').mockReturnValue({
                left: 100, width: 600, top: 0, bottom: 24
            });

            // HEADER (30) + PADDING (40) + OFFSET (100) = 170 => 0s
            // +100px = 270 => 5s (zoom=20)
            act(() => {
                fireEvent.mouseDown(ruler, { clientX: 170 });
                fireEvent.mouseMove(ruler, { clientX: 270 });
            });
            expect(onTimeChange).toHaveBeenCalledWith(5);
        });

        it('calls onPlayPause when starting a scrub while playing', () => {
            const onPlayPause = vi.fn();
            render(<TimelineEditor {...defaultProps} isPlaying={true} onPlayPause={onPlayPause} />);

            const ruler = screen.getByTestId('timeline-ruler');
            act(() => {
                fireEvent.mouseDown(ruler, { clientX: 170 });
            });

            expect(onPlayPause).toHaveBeenCalled();
        });

        it('calls onLayerUpdate with behaviorIndex when dragging keyframe to new Z', () => {
            const onLayerUpdate = vi.fn();
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [
                        { type: 'location', time_offset: 5, z_depth: 20 }
                    ]
                }
            ];

            render(<TimelineEditor {...defaultProps} layers={layers} onLayerUpdate={onLayerUpdate} />);
            const timelineContainer = screen.getByTestId('timeline-tracks');
            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 0 });

            // Layer 20 is top (index 0). Layout (after ruler 24px):
            // Lane 20: 24-58px 
            // Lane 10: 58-92px 
            // Find keyframe at 5s (in Layer 20)
            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 300, clientY: 30 }); // In Lane 20 area
            });

            // Drag down to center of Lane 10 (Y = 58 + 17 = 75px)
            const moveEvent = new MouseEvent('mousemove', { clientX: 300, clientY: 75 });
            act(() => {
                fireEvent(document, moveEvent);
            });

            act(() => {
                fireEvent.mouseUp(document, { clientX: 300, clientY: 75 });
            });

            expect(onLayerUpdate).toHaveBeenCalledWith('hopper', {
                z_depth: 10,
                behaviorIndex: 0
            });
        });

        it('drags base item to change Z-depth (no behavior index)', () => {
            const onLayerUpdate = vi.fn();
            const layers = [
                {
                    sprite_name: 'baseSprite',
                    z_depth: 10,
                    behaviors: []
                },
                {
                    sprite_name: 'otherSprite',
                    z_depth: 20,
                    behaviors: []
                }
            ];

            render(<TimelineEditor {...defaultProps} layers={layers} onLayerUpdate={onLayerUpdate} />);
            const timelineContainer = screen.getByTestId('timeline-tracks');
            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 0 });

            // Lane 20: Top (24-58)
            // Lane 10: Bottom (58-92)

            // Find base sprite thumb in Lane 10
            const thumb = screen.getByTitle(/Base: baseSprite \(Z:10\)/);

            act(() => {
                // Click thumb in Lane 10 (Y=75)
                fireEvent.mouseDown(thumb, { clientX: 140, clientY: 75 });
                // Drag UP to Lane 20 (Y=40)
                fireEvent(document, new MouseEvent('mousemove', { clientX: 140, clientY: 40 }));
                fireEvent.mouseUp(document, { clientX: 140, clientY: 40 });
            });

            expect(onLayerUpdate).toHaveBeenCalledWith('baseSprite', { z_depth: 20 });
        });

        it('shows context menu on right click', () => {
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} />);

            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);
            fireEvent.contextMenu(keyframe, { clientX: 100, clientY: 100 });

            expect(screen.getByText('Delete Keyframe')).toBeInTheDocument();
        });

        it('calls onKeyframeDelete when delete is clicked in context menu', () => {
            const onKeyframeDelete = vi.fn();
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onKeyframeDelete={onKeyframeDelete} />);

            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);
            fireEvent.contextMenu(keyframe, { clientX: 100, clientY: 100 });

            const deleteBtn = screen.getByText('Delete Keyframe');
            fireEvent.click(deleteBtn);

            expect(onKeyframeDelete).toHaveBeenCalledWith('hopper', 0);
        });

        it('snaps keyframe to 0.1s during drag', () => {
            const onKeyframeMove = vi.fn();
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onKeyframeMove={onKeyframeMove} />);

            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);

            // 5s * 20 + 40 + 30 + 100 = 270? 
            // Header=30, Padding=40. Start of time=0 is X=170 (if left=100).
            // Actually, internal layout: HEADER_WIDTH (30) + PADDING (40) = 70.
            // + Container Left offset? Test setup needs to be consistent.

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200 });
                // Move 6px to exceed threshold (200 -> 206)
                fireEvent(document, new MouseEvent('mousemove', { clientX: 206 }));
                // Move 3px more (Total 9px). Zoom 20. 9/20 = 0.45s.
                // 5 + 0.45 = 5.45 => Snap 0.1 => 5.5? 5.45 rounds to 5.5.
                fireEvent(document, new MouseEvent('mousemove', { clientX: 209 }));
            });

            expect(onKeyframeMove).toHaveBeenCalledWith('hopper', 0, 5.5, false);
        });

        it('drags keyframe after exceeding drag threshold', () => {
            const onKeyframeMove = vi.fn();
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onKeyframeMove={onKeyframeMove} />);

            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 50 });
                fireEvent(document, new MouseEvent('mousemove', { clientX: 206, clientY: 50 }));
            });

            expect(onKeyframeMove).toHaveBeenCalled();
        });

        it('creates new lane when dropping between existing lanes (gap logic)', () => {
            const onLayerUpdate = vi.fn();
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 20,
                    behaviors: [{ type: 'location', time_offset: 5, z_depth: 20 }]
                },
                {
                    sprite_name: 'boat',
                    z_depth: 10,
                    behaviors: []
                }
            ];

            render(<TimelineEditor {...defaultProps} layers={layers} onLayerUpdate={onLayerUpdate} />);
            const timelineContainer = screen.getByTestId('timeline-tracks');
            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 0 });
            vi.spyOn(timelineContainer, 'scrollTop', 'get').mockReturnValue(0);

            // Find keyframe at 5s in Layer 20 (top lane)
            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);

            // TRACK_HEIGHT = 34px. RULER = 24px.
            // Lane 20 Top: 24. Bottom: 58.
            // Lane 10 Top: 58. Bottom: 92.
            // Bottom gap of Lane 20: > 24 + 34*0.75 = 24 + 25.5 = 49.5.
            // Let's drop at Y=54 (Inside gap).

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 300, clientY: 30 });
                fireEvent(document, new MouseEvent('mousemove', { clientX: 310, clientY: 54 }));
                fireEvent.mouseUp(document, { clientX: 310, clientY: 54 });
            });

            // Midpoint of 20 and 10 is 15.
            expect(onLayerUpdate).toHaveBeenCalledWith('hopper', {
                z_depth: 15,
                behaviorIndex: 0
            });
        });

        describe('hover interactions', () => {
            it('shows and hides popup on hover logic', () => {
                const onSelectLayer = vi.fn();
                const overlappingLayers = [
                    {
                        sprite_name: 'spriteA',
                        z_depth: 10,
                        behaviors: [{ type: 'location', time_offset: 5, z_depth: 10, duration: 2 }]
                    },
                    {
                        sprite_name: 'spriteB',
                        z_depth: 10,
                        behaviors: [{ type: 'location', time_offset: 5, z_depth: 10, duration: 2 }]
                    }
                ];

                render(<TimelineEditor {...defaultProps} layers={overlappingLayers} onSelectLayer={onSelectLayer} />);
                const timelineContainer = screen.getByTestId('timeline-tracks');
                vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                    left: 100, top: 0, width: 800, height: 600, bottom: 600, right: 900, x: 100, y: 0, toJSON: () => { }
                });
                vi.spyOn(timelineContainer, 'scrollTop', 'get').mockReturnValue(0);

                // HEADER_WIDTH (30) + PADDING_LEFT (40) = 70. Zoom 20.
                // Time 5s -> 100px. X = 100 + 70 + 100 = 270px.

                // Find a keyframe card to hover
                const cardA = screen.getByTitle(/Behavior: spriteA/);

                // Hover over location
                act(() => {
                    fireEvent.mouseEnter(cardA);
                });

                expect(screen.getByText('Select Sprite')).toBeInTheDocument();

                // Move away
                act(() => {
                    fireEvent.mouseLeave(cardA);
                    vi.advanceTimersByTime(350); // Wait for grace period
                });

                // Popup should be gone.
                expect(screen.queryByText('Select Sprite')).not.toBeInTheDocument();
            });
        });
    });

    describe('scrolling and zoom', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('zooms in/out with Ctrl+Wheel', () => {
            render(<TimelineEditor {...defaultProps} />);
            const container = screen.getByTestId('timeline-tracks').parentElement;
            fireEvent.wheel(container, { deltaY: -100, ctrlKey: true });
            const slider = screen.getByTitle(/Zoom:/);
            expect(slider.value).toBe("22");
        });

        it('auto-scrolls vertically when dragging keyframe near top/bottom', () => {
            const onKeyframeMove = vi.fn();
            const layers = [{
                sprite_name: 'hopper',
                z_depth: 10,
                behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
            }];

            render(<TimelineEditor {...defaultProps} layers={layers} onKeyframeMove={onKeyframeMove} />);
            const container = screen.getByTestId('timeline-tracks');

            // Set container state
            Object.defineProperty(container, 'scrollTop', {
                value: 100,
                writable: true,
                configurable: true
            });
            // Large height
            vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
                top: 0, bottom: 500, height: 500, left: 0, right: 500
            });

            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 200 });
                // Move to top edge (Y=30), ruler is 24.
                fireEvent(document, new MouseEvent('mousemove', { clientX: 200, clientY: 30 }));
            });

            act(() => {
                vi.advanceTimersByTime(200);
            });

            expect(container.scrollTop).toBeLessThan(100);

            act(() => {
                fireEvent.mouseUp(document, { clientX: 200, clientY: 30 });
            });
        });

        it('auto-scrolls vertically when selection changes', () => {
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
                }
            ];

            const { rerender } = render(<TimelineEditor {...defaultProps} layers={layers} />);
            const container = screen.getByTestId('timeline-tracks');

            // Mock layout for scrolling logic
            // Need to mock getBoundingClientRect for container and specific lanes
            vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
                top: 0, bottom: 200, height: 200, left: 0, right: 500, width: 500
            });
            Object.defineProperty(container, 'clientHeight', { value: 200 });
            Object.defineProperty(container, 'scrollHeight', { value: 1000 });
            Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
            Object.defineProperty(container, 'scrollLeft', { value: 0, writable: true });

            // We need to access the Ref for the lane. 
            // Since we can't easily access the internal ref map from test, 
            // we rely on the implementation finding the element in the ref map.
            // The implementation uses `laneRefs.current[z]`. 
            // We can trick it by mocking the ref passed to the div? 
            // Actually, the component creates the ref callbacks.
            // But we can mock `getBoundingClientRect` on the lane element in the DOM.

            // Find lane element by text (Z index)
            const laneHeader = screen.getByText('10');
            const laneHeight = 34;
            const laneTop = 500; // Way below visible area (200)
            const laneRow = laneHeader.closest('.h-track');

            vi.spyOn(laneRow, 'getBoundingClientRect').mockReturnValue({
                top: laneTop,
                bottom: laneTop + laneHeight,
                height: laneHeight,
                left: 0,
                right: 500,
                width: 500
            });

            // Select layer
            rerender(
                <TimelineEditor
                    {...defaultProps}
                    layers={layers}
                    selectedLayer="hopper"
                    forceScrollToSelection={1}
                />
            );

            // Container should have scrolled
            // Logic: elTopRel (500) > visibleMaxY (200). 
            // Scrolled to reveal? 
            // It should set scrollTop.
            expect(container.scrollTop).toBeGreaterThan(0);
        });

        it('auto-scrolls horizontally when keyframe selected', () => {
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [{ type: 'location', time_offset: 20, z_depth: 10 }] // 20s is far right
                }
            ];

            const { rerender } = render(<TimelineEditor {...defaultProps} layers={layers} />);
            const container = screen.getByTestId('timeline-tracks');

            vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
                top: 0, bottom: 200, height: 200, left: 0, right: 500, width: 500
            });
            Object.defineProperty(container, 'clientWidth', { value: 500 });
            Object.defineProperty(container, 'scrollLeft', { value: 0, writable: true });
            Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

            const laneHeader = screen.getByText('10');
            const laneRow = laneHeader.closest('.h-track');
            vi.spyOn(laneRow, 'getBoundingClientRect').mockReturnValue({
                top: 50, bottom: 84, height: 34, left: 0, right: 500, width: 500
            });

            // Select keyframe at 20s
            rerender(
                <TimelineEditor
                    {...defaultProps}
                    layers={layers}
                    selectedLayer="hopper"
                    selectedKeyframe={{ spriteName: 'hopper', behaviorIndex: 0, time: 20 }}
                    forceScrollToSelection={1}
                />
            );

            // 20s * 20px/s = 400px. + Header(30) + Padding(40) = 470px.
            // Container width 500. VisibleX: 0..500.
            // TargetX 470 is visible. Should NOT scroll?
            // Wait, buffer is 50. VisibleMax = 500-50 = 450.
            // 470 > 450. Should scroll!

            expect(container.scrollLeft).toBeGreaterThan(0);
        });
    });
});
