import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TimelineEditor } from '../TimelineEditor.jsx';

// Silence console.error for expected test failures
vi.spyOn(console, 'error').mockImplementation(() => { });

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
    });

    afterEach(() => {
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
                    // no root z_depth
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

            // Should find an image with alt text 'boat'
            const thumb = screen.getByAltText('boat');
            expect(thumb).toBeInTheDocument();
            // Should be in Layer 10
            // We verify by ensuring the lane exists
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

            // Should find offset markers in the ruler
            const markers = screen.getAllByTestId('time-offset-marker');
            expect(markers.length).toBe(2);

            // Verify titles
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

            // Layer 20 is top (index 0). Layout (after ruler):
            // Ruler: 0-24px
            // Lane 20: 24-58px (effective Y: 0-34 after ruler offset)
            // Lane 10: 58-92px (effective Y: 34-68 after ruler offset)

            // Find keyframe at 5s (in Layer 20) (Thumbnail)
            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);

            // Start in Lane 20
            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 300, clientY: 30 }); // In Lane 20 area
            });

            // Drag down to center of Lane 10 (Y = 24 + 34 + 17 = 75px)
            // After ruler offset: 75 - 24 = 51, which is in lane index 1 (Lane 10)
            const moveEvent = new MouseEvent('mousemove', { clientX: 300, clientY: 75 });
            act(() => {
                fireEvent(document, moveEvent);
            });

            act(() => {
                fireEvent.mouseUp(document, { clientX: 300, clientY: 75 });
            });

            // Expect update to Lane 10
            expect(onLayerUpdate).toHaveBeenCalledWith('hopper', {
                z_depth: 10,
                behaviorIndex: 0
            });
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

            // Check if "Delete Keyframe" is visible
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

            // 5s * 20 + 40 + 60 + 0 = 200px (assuming rect left=0)
            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200 });

                // First move 6px to exceed threshold
                fireEvent(document, new MouseEvent('mousemove', { clientX: 206 }));

                // Then move by 3px more => total 9px => 9 / 20 = 0.45s offset. 5 + 0.45 = 5.45s. Snap to 5.5s
                fireEvent(document, new MouseEvent('mousemove', { clientX: 209 }));
            });

            expect(onKeyframeMove).toHaveBeenCalledWith('hopper', 0, 5.5, false);
        });

        it('does not drag keyframe on short click (< 5px movement)', () => {
            const onKeyframeMove = vi.fn();
            const onSelectLayer = vi.fn();
            const layers = [
                {
                    sprite_name: 'hopper',
                    z_depth: 10,
                    behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onKeyframeMove={onKeyframeMove} onSelectLayer={onSelectLayer} />);

            const keyframe = screen.getByTitle(/Behavior: hopper.*Index:0.*Time:5s/);

            // Click and move only 3px (below threshold)
            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 50 });
                fireEvent(document, new MouseEvent('mousemove', { clientX: 202, clientY: 51 }));
                fireEvent.mouseUp(document, { clientX: 202, clientY: 51 });
            });

            // Should NOT trigger drag
            expect(onKeyframeMove).not.toHaveBeenCalled();
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

            // Click and move 6px (exceeds threshold)
            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 50 });
                fireEvent(document, new MouseEvent('mousemove', { clientX: 206, clientY: 50 }));
            });

            // Should trigger drag
            expect(onKeyframeMove).toHaveBeenCalled();
        });

        it('creates new lane when dropping between existing lanes', () => {
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

            // Layout with ruler offset (RULER_HEIGHT = 24):
            // TRACK_HEIGHT = 34px
            // Lane 20: effective Y 0-34 (actual Y: 24-58)
            // Lane 10: effective Y 34-68 (actual Y: 58-92)
            // Drop in bottom 25% of Lane 20 (effective Y ~= 27-34)
            // Actual Y = effective Y + 24 = 51-58
            // Let's drop at Y=54 (effective 30, which is 88% through track 0)

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 300, clientY: 30 });
                // Move 10px to exceed threshold
                fireEvent(document, new MouseEvent('mousemove', { clientX: 310, clientY: 30 }));
                // Drop in bottom gap of Lane 20 (Y = 54 = 30 effective, which is 88% through track)
                fireEvent.mouseUp(document, { clientX: 310, clientY: 54 });
            });

            // Should create new lane with Z = (20 + 10) / 2 = 15
            expect(onLayerUpdate).toHaveBeenCalledWith('hopper', {
                z_depth: 15,
                behaviorIndex: 0
            });
        });
    });
});
