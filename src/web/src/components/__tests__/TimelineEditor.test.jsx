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
        isPlaying: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Force cleanup of document listeners and wrap in act to avoid warnings
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

        it('renders zoom slider', () => {
            render(<TimelineEditor {...defaultProps} />);
            expect(screen.getByRole('slider')).toBeInTheDocument();
        });
    });

    describe('layers', () => {
        const layers = [
            { sprite_name: 'boat', behaviors: [] },
            { sprite_name: 'wave', behaviors: [] }
        ];

        it('renders layer labels', () => {
            render(<TimelineEditor {...defaultProps} layers={layers} />);
            expect(screen.getByText('boat')).toBeInTheDocument();
            expect(screen.getByText('wave')).toBeInTheDocument();
        });

        it('highlights selected layer', () => {
            render(<TimelineEditor {...defaultProps} layers={layers} selectedLayer="boat" />);
            const boatLabel = screen.getByText('boat');
            expect(boatLabel).toBeInTheDocument();
        });
    });

    describe('ruler', () => {
        it('renders time markers', () => {
            render(<TimelineEditor {...defaultProps} duration={10} />);
            expect(screen.getByText('0s')).toBeInTheDocument();
            expect(screen.getByText('5s')).toBeInTheDocument();
            expect(screen.getByText('10s')).toBeInTheDocument();
        });
    });

    describe('keyframes', () => {
        const layersWithKeyframes = [
            {
                sprite_name: 'boat',
                behaviors: [
                    { type: 'location', time_offset: 5, x: 100, y: 100 },
                    { type: 'location', time_offset: 10, x: 200, y: 200 }
                ]
            }
        ];

        it('renders keyframe markers for LocationBehaviors with time_offset', () => {
            render(<TimelineEditor {...defaultProps} layers={layersWithKeyframes} />);
            expect(screen.getByTitle(/Keyframe at 5.00s/)).toBeInTheDocument();
            expect(screen.getByTitle(/Keyframe at 10.00s/)).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('calls onPlayPause when play button is clicked', () => {
            const onPlayPause = vi.fn();
            render(<TimelineEditor {...defaultProps} onPlayPause={onPlayPause} />);
            fireEvent.click(screen.getByLabelText(/Play/));
            expect(onPlayPause).toHaveBeenCalled();
        });

        it('updates zoom when slider changes', () => {
            render(<TimelineEditor {...defaultProps} />);
            const slider = screen.getByRole('slider');
            fireEvent.change(slider, { target: { value: '50' } });
            expect(slider.value).toBe('50');
        });
    });

    describe('scrubbing', () => {
        it('calls onTimeChange during scrubbing', () => {
            const onTimeChange = vi.fn();
            const { container } = render(<TimelineEditor {...defaultProps} onTimeChange={onTimeChange} />);

            const ruler = container.querySelector('div[style*="sticky"]');
            const timelineContainer = ruler.closest('div[style*="flex: 1"]');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                width: 600,
                top: 0,
                bottom: 200
            });

            act(() => {
                fireEvent.mouseDown(ruler, { clientX: 200 });
            });
            expect(onTimeChange).toHaveBeenCalledWith(0);

            const moveEvent = new MouseEvent('mousemove', { clientX: 300 });
            act(() => {
                fireEvent(document, moveEvent);
            });
            expect(onTimeChange).toHaveBeenCalledWith(5);

            act(() => {
                fireEvent.mouseUp(document);
            });
        });
    });

    describe('keyframe dragging', () => {
        const layersWithKeyframes = [
            {
                sprite_name: 'boat',
                behaviors: [
                    { type: 'location', time_offset: 5, x: 100, y: 100 }
                ]
            }
        ];

        it('calls onKeyframeMove during and after drag', () => {
            const onKeyframeMove = vi.fn();
            render(<TimelineEditor {...defaultProps} layers={layersWithKeyframes} onKeyframeMove={onKeyframeMove} />);

            const keyframe = screen.getByTitle(/Keyframe at 5.00s/);
            const timelineContainer = keyframe.closest('div[style*="flex: 1"]');

            vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                top: 0
            });

            act(() => {
                fireEvent.mouseDown(keyframe, { clientX: 200 });
            });

            const moveEvent = new MouseEvent('mousemove', { clientX: 300 });
            act(() => {
                fireEvent(document, moveEvent);
            });
            expect(onKeyframeMove).toHaveBeenCalledWith('boat', 0, 10, false);

            act(() => {
                fireEvent.mouseUp(document, { clientX: 400 });
            });
            expect(onKeyframeMove).toHaveBeenCalledWith('boat', 0, 15, true);
        });

        it('prevents event propagation when clicking keyframe', () => {
            const onTimeChange = vi.fn();
            render(<TimelineEditor {...defaultProps} layers={layersWithKeyframes} onTimeChange={onTimeChange} />);

            const keyframe = screen.getByTitle(/Keyframe at 5.00s/);

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
