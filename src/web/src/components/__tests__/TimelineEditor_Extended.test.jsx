import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TimelineEditor } from '../TimelineEditor.jsx';

// Silence logs
vi.spyOn(console, 'error').mockImplementation(() => { });
vi.spyOn(console, 'warn').mockImplementation(() => { });
vi.spyOn(console, 'log').mockImplementation(() => { });

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

describe('TimelineEditor Extended Interactions', () => {
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
        // Clean up global listeners
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        });
    });

    it('zooms in/out with Ctrl+Wheel', () => {
        render(<TimelineEditor {...defaultProps} />);
        const container = screen.getByTestId('timeline-tracks').parentElement;

        // Wheel up (negative delta) => Zoom In
        // Initial zoom 20. 20 * 1.1 = 22
        fireEvent.wheel(container, { deltaY: -100, ctrlKey: true });

        const slider = screen.getByTitle(/Zoom:/);
        expect(slider.value).toBe("22");
    });

    it('ignores Wheel without Ctrl key', () => {
        render(<TimelineEditor {...defaultProps} />);
        const container = screen.getByTestId('timeline-tracks').parentElement;

        fireEvent.wheel(container, { deltaY: -100, ctrlKey: false });

        const slider = screen.getByTitle(/Zoom:/);
        expect(slider.value).toBe("20"); // Default
    });

    it('detects overlapping sprites on hover', () => {
        const overlappingLayers = [
            {
                sprite_name: 'A',
                z_depth: 10,
                behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
            },
            {
                sprite_name: 'B',
                z_depth: 10, // Same Z-depth (collision in lane logic if processed sequentially)
                // Note: Real timeline separates unique Zs, but if they share Z, they share lane.
                // The hover logic iterates items in the lane.
                behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
            }
        ];

        render(<TimelineEditor {...defaultProps} layers={overlappingLayers} />);
        const timelineContainer = screen.getByTestId('timeline-tracks');

        // Mock getBoundingClientRect
        vi.spyOn(timelineContainer, 'getBoundingClientRect').mockReturnValue({
            left: 0, top: 0, width: 800, height: 600, bottom: 600, right: 800
        });

        // Items at 5s * 20px = 100px. Header=30, Padding=40. Total X = 170.
        // Find a keyframe card to hover
        const cardA = screen.getByTitle(/Behavior: A/);

        // Hover over the card
        act(() => {
            fireEvent.mouseEnter(cardA);
        });

        // Should check for multiple items match
        // Because checking hit box size 14px.
        expect(screen.getByText('Select Sprite')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('auto-scrolls up when dragging above ruler', () => {
        const layers = [{
            sprite_name: 'A',
            z_depth: 10,
            behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
        }];

        render(<TimelineEditor {...defaultProps} layers={layers} />);
        const container = screen.getByTestId('timeline-tracks');
        const keyframe = screen.getByTitle(/Behavior: A.*Time:5s/);

        // Mock scrollable container
        Object.defineProperty(container, 'scrollTop', { value: 100, writable: true });
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            top: 100, bottom: 600, height: 500, left: 0, right: 800 // offset relative to viewport
        });

        act(() => {
            fireEvent.mouseDown(keyframe, { clientX: 170, clientY: 200 });
            // Move near top (Container Top 100).
            // Ruler height 24.
            // Trigger zone: RULER_HEIGHT < relativeY < RULER_HEIGHT + 40
            // relativeY = clientY - top. 
            // We want relativeY = 30 (just below ruler).
            // clientY = 130
            fireEvent(document, new MouseEvent('mousemove', { clientX: 170, clientY: 130 }));
        });

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(container.scrollTop).toBeLessThan(100);
    });

    it('auto-scrolls down when dragging near bottom', () => {
        const layers = [{
            sprite_name: 'A',
            z_depth: 10,
            behaviors: [{ type: 'location', time_offset: 5, z_depth: 10 }]
        }];

        render(<TimelineEditor {...defaultProps} layers={layers} />);
        const container = screen.getByTestId('timeline-tracks');
        const keyframe = screen.getByTitle(/Behavior: A.*Time:5s/);

        Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            top: 0, bottom: 500, height: 500, left: 0, right: 800
        });

        act(() => {
            fireEvent.mouseDown(keyframe, { clientX: 170, clientY: 100 });
            // Move near bottom (height 500). Trigger: relativeY > 500 - 40 = 460.
            // clientY = 480
            fireEvent(document, new MouseEvent('mousemove', { clientX: 170, clientY: 480 }));
        });

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(container.scrollTop).toBeGreaterThan(0);
    });
});
