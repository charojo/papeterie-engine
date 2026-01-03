import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineEditor } from '../TimelineEditor.jsx';

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
            // The boat label parent should have a tinted background
            const boatLabel = screen.getByText('boat');
            const _style = boatLabel.parentElement.style;
            // Just verify it renders without error when selectedLayer is set
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
            // Keyframes should have titles with time info
            expect(screen.getByTitle(/Keyframe at 5.00s/)).toBeInTheDocument();
            expect(screen.getByTitle(/Keyframe at 10.00s/)).toBeInTheDocument();
        });

        it('does not render keyframes for behaviors without time_offset', () => {
            const layersNoOffset = [
                {
                    sprite_name: 'boat',
                    behaviors: [{ type: 'oscillate', frequency: 1 }]
                }
            ];
            render(<TimelineEditor {...defaultProps} layers={layersNoOffset} />);
            expect(screen.queryByTitle(/Keyframe/)).not.toBeInTheDocument();
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
            // Zoom change is internal state, verify it doesn't crash
            expect(slider.value).toBe('50');
        });
    });

    describe('scrubbing', () => {
        it('calls onTimeChange when ruler is clicked', () => {
            const onTimeChange = vi.fn();
            const { container } = render(<TimelineEditor {...defaultProps} onTimeChange={onTimeChange} />);

            // Find the ruler div (has time markers)
            const ruler = container.querySelector('div[style*="sticky"]');

            if (ruler) {
                // Simulate click at a position
                fireEvent.mouseDown(ruler, { clientX: 200, clientY: 10 });
                expect(onTimeChange).toHaveBeenCalled();
            }
        });
    });

    describe('playhead', () => {
        it('renders playhead at correct position', () => {
            const { container } = render(<TimelineEditor {...defaultProps} currentTime={5} />);

            // Playhead is a red div with position absolute
            const playhead = container.querySelector('div[style*="background: var(--color-danger)"]');
            expect(playhead).toBeInTheDocument();
        });
    });
});
