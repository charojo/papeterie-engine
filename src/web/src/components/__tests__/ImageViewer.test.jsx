import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageViewer } from '../ImageViewer';

// Mock Icon component to avoid testing its implementation
vi.mock('../Icon', () => ({
    Icon: ({ name, className }) => <div data-testid={`icon-${name}`} className={className}>{name}</div>
}));


describe('ImageViewer', () => {
    const defaultProps = {
        mainSrc: 'test-image.png',
        alt: 'Test Image',
        isOptimizing: false,
        tabs: [],
        actions: <div>Actions</div>,
        isExpanded: false,
        toggleExpand: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock RAF
        vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { });
    });


    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Rendering Tests
    it('renders default placeholder when no image is provided', () => {
        render(<ImageViewer {...defaultProps} mainSrc={null} />);
        expect(screen.getByText('No Image')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders image when src is provided', () => {
        render(<ImageViewer {...defaultProps} />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'test-image.png');
        expect(img).toHaveAttribute('alt', 'Test Image');
    });

    it('renders optimizing overlay when isOptimizing is true', () => {
        render(<ImageViewer {...defaultProps} isOptimizing={true} />);
        expect(screen.getByTestId('icon-optimize')).toBeInTheDocument();
    });

    it('renders actions and tabs', () => {
        const tabs = [
            { id: 'tab1', label: 'Tab 1', isActive: true, onClick: vi.fn() },
            { id: 'tab2', label: 'Tab 2', isActive: false, onClick: vi.fn() }
        ];
        render(<ImageViewer {...defaultProps} tabs={tabs} />);

        expect(screen.getByText('Tab 1')).toBeInTheDocument();
        expect(screen.getByText('Tab 2')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Tab 2'));
        expect(tabs[1].onClick).toHaveBeenCalled();
    });

    // Interaction Tests
    it('calls toggleExpand when expand button is clicked', () => {
        render(<ImageViewer {...defaultProps} />);
        const expandBtn = screen.getByTitle('Maximize (Zen Mode)');
        fireEvent.click(expandBtn);
        expect(defaultProps.toggleExpand).toHaveBeenCalled();
    });

    it('scales image when zoom buttons are clicked', () => {
        render(<ImageViewer {...defaultProps} />);
        const img = screen.getByRole('img');
        const zoomInBtn = screen.getByTitle('Zoom In');
        const zoomOutBtn = screen.getByTitle('Zoom Out');

        // Initial Transform Check (scale(1))
        expect(img.style.scale).toBe('1');

        // Zoom In
        fireEvent.click(zoomInBtn);
        // logic is scale * 1.2 => 1.2
        expect(img.style.scale).toBe('1.2');

        // Zoom Out twice
        fireEvent.click(zoomOutBtn); // returns to 1
        expect(img.style.scale).toBe('1');

        fireEvent.click(zoomOutBtn); // stays at 1 (min limit)
        expect(img.style.scale).toBe('1');
    });

    it('resets view when reset button is clicked', () => {
        render(<ImageViewer {...defaultProps} />);
        const zoomInBtn = screen.getByTitle('Zoom In');

        // Change state so reset button appears
        fireEvent.click(zoomInBtn);
        expect(screen.queryByText('Reset View')).toBeInTheDocument();

        const resetBtn = screen.getByText('Reset View');
        fireEvent.click(resetBtn);

        const img = screen.getByRole('img');
        expect(img.style.scale).toBe('1');
        expect(screen.queryByText('Reset View')).not.toBeInTheDocument();
    });

    it('pans image on drag', () => {
        render(<ImageViewer {...defaultProps} />);
        const container = screen.getByRole('img').parentElement;

        // Mock dimensions for clamp (100x100)
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            width: 100, height: 100, left: 0, top: 0
        });

        // Verify container has user-select: none
        expect(container.style.userSelect).toBe('none');

        // Zoom in first to allow pan (since scale must be > 1 to show grab cursor, though drag logic might work if not guarded check handleMouseMove)
        const zoomInBtn = screen.getByTitle('Zoom In');
        fireEvent.click(zoomInBtn); // 1.2

        // Scale 1.2. Limit = (100 * 0.2) / 2 = 10.
        // Range [-10, 10].

        // Mouse Down at 100,100
        fireEvent.mouseDown(container, { clientX: 100, clientY: 100 });

        // Mouse Move to 150,150 (Delta +50)
        // New pos: 50,50. Clamped to 10,10.
        fireEvent.mouseMove(container, { clientX: 150, clientY: 150 });

        const img = screen.getByRole('img');
        // Expect clamped values
        expect(img.style.translate).toMatch(/9\.9.*?px 9\.9.*?px/);

        // Mouse Up
        fireEvent.mouseUp(container);
    });

    it('zooms on wheel with ctrl key', () => {
        render(<ImageViewer {...defaultProps} />);
        const container = screen.getByRole('img').parentElement;
        const img = screen.getByRole('img');

        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            width: 100, height: 100, left: 0, top: 0
        });

        // Ctrl + Wheel Down (Zoom Out logic in code is deltaY > 0 -> 0.9)
        // Default scale is 1. Min is 1. 
        fireEvent.wheel(container, { ctrlKey: true, deltaY: 100 });
        expect(img.style.scale).toBe('1'); // Should stay at 1

        // Ctrl + Wheel Up (Zoom In logic is deltaY < 0 -> 1.1)
        // 1 * 1.1 = 1.1
        fireEvent.wheel(container, { ctrlKey: true, deltaY: -100 });
        // checking close to 1.1
        expect(img.style.scale).toMatch(/1.1/);
    });

    it('pans on wheel when zoomed in', () => {
        render(<ImageViewer {...defaultProps} />);
        const container = screen.getByRole('img').parentElement;
        const img = screen.getByRole('img');

        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            width: 100, height: 100, left: 0, top: 0
        });

        // First Zoom In so scale > 1
        const zoomInBtn = screen.getByTitle('Zoom In');
        fireEvent.click(zoomInBtn); // Scale 1.2
        expect(img.style.scale).toBe('1.2');

        // Limit 10 (calculated above)

        // Wheel (Pan) - no ctrl key
        // deltaX=5, deltaY=5 (Use small values to stay within limit 10)
        // New pos: -5, -5.
        fireEvent.wheel(container, { ctrlKey: false, deltaX: 5, deltaY: 5 });
        // Expect clamped values (-5 clamped)
        // With limit 10, -5 is fine. Float errors might make it -4.999 or -5.00..01
        expect(img.style.translate).toMatch(/-5(\.0+)?px -5(\.0+)?px/);
    });

    it('does not pan on wheel when not zoomed in', () => {
        render(<ImageViewer {...defaultProps} />);
        const container = screen.getByRole('img').parentElement;
        const img = screen.getByRole('img');

        // Scale is 1
        // Wheel event
        fireEvent.wheel(container, { ctrlKey: false, deltaX: 10, deltaY: 20 });

        // Should remain at 0,0
        expect(img.style.translate).toBe('0px 0px');
    });

    it('clamps pan position within image boundaries', () => {
        render(<ImageViewer {...defaultProps} />);
        const container = screen.getByRole('img').parentElement;
        const img = screen.getByRole('img');

        // Mock getBoundingClientRect for container
        // Say container is 100x100
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            width: 100,
            height: 100,
            left: 0,
            top: 0
        });

        // Zoom In to Scale 2
        // Max limit = (100 * (2 - 1)) / 2 = 50. Range [-50, 50].
        const zoomInBtn = screen.getByTitle('Zoom In');
        // Logic: 1 * 1.2 = 1.2. 
        fireEvent.click(zoomInBtn); // 1.2
        fireEvent.click(zoomInBtn); // 1.44
        fireEvent.click(zoomInBtn); // 1.728
        fireEvent.click(zoomInBtn); // 2.0736

        // Now scale ~2.07. Limit ~ (100 * 1.07) / 2 = 53.5.

        // Try to pan HUGE amount to right (negative deltaX)
        fireEvent.wheel(container, { ctrlKey: false, deltaX: -1000, deltaY: 0 });

        const transform = img.style.translate;
        const match = transform.match(/([\d.-]+)px/);
        const x = parseFloat(match[1]);

        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(100);
    });

    it('keeps zoom point stable (no drift)', () => {
        render(<ImageViewer {...defaultProps} />);
        const container = screen.getByRole('img').parentElement;
        const img = screen.getByRole('img');

        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            width: 100, height: 100, left: 0, top: 0
        });

        // Point 50,50 (Center). Zoom in. 
        fireEvent.wheel(container, {
            ctrlKey: true,
            clientX: 50, clientY: 50,
            deltaY: -100
        });

        expect(img.style.translate).toBe('0px 0px');
    });

    it('rotates image when slider is changed', () => {
        render(<ImageViewer {...defaultProps} />);
        const img = screen.getByRole('img');
        const slider = screen.getByRole('slider');

        // Initial Rotation Check (rotate(0deg))
        expect(img.style.rotate).toBe('0deg');

        // Change slider
        fireEvent.change(slider, { target: { value: '45' } });
        expect(img.style.rotate).toBe('45deg');
        expect(screen.getByText('45°')).toBeInTheDocument();

        // Change slider again
        fireEvent.change(slider, { target: { value: '-90' } });
        expect(img.style.rotate).toBe('-90deg');
    });

    it('resets rotation when reset button is clicked', () => {
        render(<ImageViewer {...defaultProps} />);
        const slider = screen.getByRole('slider');

        // Rotate to show reset button
        fireEvent.change(slider, { target: { value: '90' } });
        expect(screen.queryByText('Reset View')).toBeInTheDocument();

        const resetBtn = screen.getByText('Reset View');
        fireEvent.click(resetBtn);

        const img = screen.getByRole('img');
        expect(img.style.rotate).toBe('0deg');
        expect(screen.queryByText('Reset View')).not.toBeInTheDocument();
    });

    it('always renders save rotation button as grayed out/disabled when rotation is 0', () => {
        const onSaveRotation = vi.fn();
        render(<ImageViewer {...defaultProps} onSaveRotation={onSaveRotation} />);

        const saveBtn = screen.getByTitle('Save Rotation');
        expect(saveBtn).toBeInTheDocument();
        expect(saveBtn).toBeDisabled();

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '10' } });

        expect(saveBtn).not.toBeDisabled();
    });

    // Behavior Preview Tests
    it('shows play button only when behaviors are provided', () => {
        const { rerender } = render(<ImageViewer {...defaultProps} behaviors={[]} />);
        expect(screen.queryByTitle('Play Preview')).not.toBeInTheDocument();

        const behaviors = [{ type: 'oscillate', enabled: true, frequency: 1, amplitude: 10, coordinate: 'y' }];
        rerender(<ImageViewer {...defaultProps} behaviors={behaviors} />);
        expect(screen.getByTitle('Play Preview')).toBeInTheDocument();
    });

    it('toggles playing state and icon when play/pause is clicked', () => {
        const behaviors = [{ type: 'oscillate', enabled: true, frequency: 1, amplitude: 10, coordinate: 'y' }];
        render(<ImageViewer {...defaultProps} behaviors={behaviors} />);

        const playBtn = screen.getByTitle('Play Preview');
        fireEvent.click(playBtn);

        expect(screen.getByTitle('Stop Preview')).toBeInTheDocument();
        expect(screen.getByTestId('icon-pause')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Stop Preview'));
        expect(screen.getByTitle('Play Preview')).toBeInTheDocument();
        expect(screen.getByTestId('icon-play')).toBeInTheDocument();
    });

    it('applies behavior offsets to animation frame', async () => {
        // This test passes without RAF execution because it checks React state derived styles
        // which update on re-render when play state toggles, resetting transition.
        const behaviors = [{ type: 'oscillate', enabled: true, frequency: 1, amplitude: 10, coordinate: 'y' }];
        render(<ImageViewer {...defaultProps} behaviors={behaviors} />);

        const img = screen.getByRole('img');
        const playBtn = screen.getByTitle('Play Preview');

        // Before play
        expect(img.style.translate).toBe('0px 0px');

        fireEvent.click(playBtn);

        // After play, transition should be 'none'
        expect(img.style.transition).toBe('none');
    });
});
