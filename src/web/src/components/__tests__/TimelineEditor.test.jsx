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

        it('displays current time and duration', () => {
            render(<TimelineEditor {...defaultProps} currentTime={5.25} duration={60} />);
            expect(screen.getByText('5.25s / 60s')).toBeInTheDocument();
        });

        it('shows Pause when playing', () => {
            render(<TimelineEditor {...defaultProps} isPlaying={true} />);
            expect(screen.getByLabelText(/Pause/)).toBeInTheDocument();
        });

        it('renders sliders', () => {
            render(<TimelineEditor {...defaultProps} />);
            const sliders = screen.getAllByRole('slider');
            expect(sliders.length).toBeGreaterThanOrEqual(2); // Time scrubber and zoom
        });
    });

    describe('levels', () => {
        const layers = [
            { sprite_name: 'boat', z_depth: 2, behaviors: [] },
            { sprite_name: 'wave', z_depth: 1, behaviors: [] }
        ];

        it('renders z-depth levels', () => {
            render(<TimelineEditor {...defaultProps} layers={layers} />);
            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });

    describe('ruler', () => {
        it('renders time markers with smart intervals', () => {
            render(<TimelineEditor {...defaultProps} duration={10} />);
            expect(screen.getByText('0s')).toBeInTheDocument();
            expect(screen.getByText('2s')).toBeInTheDocument();
            expect(screen.getByText('10s')).toBeInTheDocument();
        });
    });

    describe('keyframes', () => {
        const layersWithKeyframes = [
            {
                sprite_name: 'boat',
                z_depth: 1,
                behaviors: [
                    { type: 'location', time_offset: 5, x: 100, y: 100 },
                    { type: 'location', time_offset: 10, x: 200, y: 200 }
                ]
            }
        ];

        it('renders keyframe markers for LocationBehaviors with time_offset', () => {
            render(<TimelineEditor {...defaultProps} layers={layersWithKeyframes} />);
            expect(screen.getByTitle(/boat keyframe at 5.00s/)).toBeInTheDocument();
            expect(screen.getByTitle(/boat keyframe at 10.00s/)).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('calls onPlayPause when play button is clicked', () => {
            const onPlayPause = vi.fn();
            render(<TimelineEditor {...defaultProps} onPlayPause={onPlayPause} />);
            fireEvent.click(screen.getByLabelText(/Play/));
            expect(onPlayPause).toHaveBeenCalled();
        });

        it('updates zoom when zoom slider changes', () => {
            render(<TimelineEditor {...defaultProps} />);
            const sliders = screen.getAllByRole('slider');
            const zoomSlider = sliders[sliders.length - 1];
            fireEvent.change(zoomSlider, { target: { value: '50' } });
            expect(zoomSlider.value).toBe('50');
        });
    });

    describe('scrubbing', () => {
        it('calls onTimeChange during scrubbing', () => {
            const onTimeChange = vi.fn();
            render(<TimelineEditor {...defaultProps} onTimeChange={onTimeChange} />);

            const ruler = screen.getByTestId('timeline-ruler');
            const timelineContainer = screen.getByTestId('timeline-tracks');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                width: 600,
                top: 0,
                bottom: 200
            });

            act(() => {
                fireEvent.mouseDown(ruler, { clientX: 200 });
            });
            // (200 - 100) / 20 = 5
            expect(onTimeChange).toHaveBeenCalledWith(5);

            const moveEvent = new MouseEvent('mousemove', { clientX: 300 });
            act(() => {
                fireEvent(document, moveEvent);
            });
            // (300 - 100) / 20 = 10
            expect(onTimeChange).toHaveBeenCalledWith(10);

            act(() => {
                fireEvent.mouseUp(document);
            });
        });
    });

    describe('keyframe dragging', () => {
        const layersWithKeyframes = [
            {
                sprite_name: 'boat',
                z_depth: 1,
                behaviors: [
                    { type: 'location', time_offset: 5, x: 100, y: 100 }
                ]
            }
        ];

        it('calls onKeyframeMove during and after drag', () => {
            const onKeyframeMove = vi.fn();
            render(<TimelineEditor {...defaultProps} layers={layersWithKeyframes} onKeyframeMove={onKeyframeMove} />);

            const keyframe = screen.getByTitle(/boat keyframe at 5.00s/);
            const timelineContainer = screen.getByTestId('timeline-tracks');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                top: 0
            });

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 40 });
            });

            const moveEvent = new MouseEvent('mousemove', { clientX: 300, clientY: 40 });
            act(() => {
                fireEvent(document, moveEvent);
            });
            // (300 - 100) / 20 = 10
            expect(onKeyframeMove).toHaveBeenCalledWith('boat', 0, 10, false);

            act(() => {
                fireEvent.mouseUp(document, { clientX: 400, clientY: 40 });
            });
            // (400 - 100) / 20 = 15
            expect(onKeyframeMove).toHaveBeenCalledWith('boat', 0, 15, true);
        });

        it('calls onLayerUpdate when dragging to a different level', () => {
            const onLayerUpdate = vi.fn();
            const layers = [
                { sprite_name: 'boat', z_depth: 2, behaviors: [{ type: 'location', time_offset: 5 }] },
                { sprite_name: 'wave', z_depth: 1, behaviors: [] }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onLayerUpdate={onLayerUpdate} />);

            const keyframe = screen.getByTitle(/boat keyframe at 5.00s/);
            const timelineContainer = screen.getByTestId('timeline-tracks');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                top: 0
            });

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 40 }); // Over Z=2 track
            });

            // Drag down to Z=1 track
            // Track height is 40px, ruler is 24px.
            // Z=2 is track index 0: 24 to 64
            // Z=1 is track index 1: 64 to 104
            const moveEvent = new MouseEvent('mousemove', { clientX: 200, clientY: 80 });
            act(() => {
                fireEvent(document, moveEvent);
            });

            act(() => {
                fireEvent.mouseUp(document, { clientX: 200, clientY: 80 });
            });

            expect(onLayerUpdate).toHaveBeenCalledWith('boat', { z_depth: 1, dropMode: 'snap' });
        });

        it('calls onLayerUpdate with midpoint mode when dragging between levels', () => {
            const onLayerUpdate = vi.fn();
            const layers = [
                { sprite_name: 'boat', z_depth: 60, behaviors: [{ type: 'location', time_offset: 5 }] },
                { sprite_name: 'wave', z_depth: 50, behaviors: [] }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onLayerUpdate={onLayerUpdate} />);

            const keyframe = screen.getByTitle(/boat keyframe at 5.00s/);
            const timelineContainer = screen.getByTestId('timeline-tracks');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                top: 0
            });

            // Drag to the line between index 0 (60) and index 1 (50)
            // Ruler is 24px, each track is 40px. Line is at 24+40 = 64px.
            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 40 });
            });

            act(() => {
                fireEvent.mouseUp(document, { clientX: 200, clientY: 64 });
            });

            expect(onLayerUpdate).toHaveBeenCalledWith('boat', { z_depth: 55, dropMode: 'midpoint' });
        });

        it('calls onLayerUpdate with normalize mode when dragging between crowded levels', () => {
            const onLayerUpdate = vi.fn();
            const layers = [
                { sprite_name: 'boat', z_depth: 51, behaviors: [{ type: 'location', time_offset: 5 }] },
                { sprite_name: 'wave', z_depth: 50, behaviors: [] }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onLayerUpdate={onLayerUpdate} />);

            const keyframe = screen.getByTitle(/boat keyframe at 5.00s/);
            const timelineContainer = screen.getByTestId('timeline-tracks');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                top: 0
            });

            // Drag to the line between Z=51 and Z=50 (index 0 and 1)
            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200, clientY: 40 });
            });

            act(() => {
                fireEvent.mouseUp(document, { clientX: 200, clientY: 64 });
            });

            expect(onLayerUpdate).toHaveBeenCalledWith('boat', { z_depth: 51, dropMode: 'normalize' });
        });

        it('calls onSelectLayer when keyframe is clicked', () => {
            const onSelectLayer = vi.fn();
            const layers = [
                { sprite_name: 'boat', z_depth: 1, behaviors: [{ type: 'location', time_offset: 5 }] }
            ];
            render(<TimelineEditor {...defaultProps} layers={layers} onSelectLayer={onSelectLayer} />);

            const keyframe = screen.getByTitle(/boat keyframe at 5.00s/);
            fireEvent.click(keyframe);

            expect(onSelectLayer).toHaveBeenCalledWith('boat');
        });

        it('prevents event propagation when clicking keyframe', () => {
            const onTimeChange = vi.fn();
            render(<TimelineEditor {...defaultProps} layers={layersWithKeyframes} onTimeChange={onTimeChange} />);

            const keyframe = screen.getByTitle(/boat keyframe at 5.00s/);

            const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            const stopPropagationSpy = vi.spyOn(mouseDownEvent, 'stopPropagation');

            act(() => {
                fireEvent(keyframe, mouseDownEvent);
            });

            expect(stopPropagationSpy).toHaveBeenCalled();
            expect(onTimeChange).not.toHaveBeenCalled();
        });
    });

    describe('playhead', () => {
        it('renders playhead at correct position', () => {
            const { container } = render(<TimelineEditor {...defaultProps} currentTime={5} />);
            const playhead = container.querySelector('div[style*="background: var(--color-danger)"]');
            expect(playhead).toBeInTheDocument();
            expect(playhead.style.left).toBe('100px');
        });
    });
});
