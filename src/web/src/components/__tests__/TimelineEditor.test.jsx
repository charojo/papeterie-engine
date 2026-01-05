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
            expect(screen.getByText('Layer 20')).toBeInTheDocument();
            expect(screen.getByText('Layer 10')).toBeInTheDocument();
            expect(screen.getByText('Layer 5')).toBeInTheDocument();
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
            expect(screen.getByText('Layer 25')).toBeInTheDocument();
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
            expect(screen.getByText('Layer 10')).toBeInTheDocument();
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

            // HEADER (200) + PADDING (40) + OFFSET (100) = 340 => 0s
            // +100px = 440 => 5s (zoom=20)
            act(() => {
                fireEvent.mouseDown(ruler, { clientX: 340 });
                fireEvent.mouseMove(ruler, { clientX: 440 });
            });
            expect(onTimeChange).toHaveBeenCalledWith(5);
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

            // Layer 20 is top (index 0). Layout:
            // 20
            // 10

            // Find keyframe at 5s (in Layer 20) (Thumbnail)
            const keyframe = screen.getByTitle(/at 5.00s/);

            // 5s * 20 = 100px. +40 Padding = 140px. 
            // +200 Header + 100 Offset = 440px.
            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 440, clientY: 24 }); // Click in Top row (Layer 20)
            });

            // Drag down to Layer 10 (approx 48px + 24px = 72px)
            // Keep X same (vertical drag)
            const moveEvent = new MouseEvent('mousemove', { clientX: 440, clientY: 80 });
            act(() => {
                fireEvent(document, moveEvent);
            });

            act(() => {
                fireEvent.mouseUp(document, { clientX: 440, clientY: 80 });
            });

            // Expect update
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

            const keyframe = screen.getByTitle(/at 5.00s/);
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

            const keyframe = screen.getByTitle(/at 5.00s/);
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

            const keyframe = screen.getByTitle(/at 5.00s/);

            // 5s * 20 + 40 + 200 + 0 = 340px (assuming rect left=0)
            fireEvent.mouseDown(keyframe, { clientX: 340 });

            // Move by 3px => 3 / 20 = 0.15s offset. 5 + 0.15 = 5.15s. Snap to 5.2s
            fireEvent(document, new MouseEvent('mousemove', { clientX: 343 }));

            expect(onKeyframeMove).toHaveBeenCalledWith('hopper', 0, 5.2, false);
        });
    });
});
