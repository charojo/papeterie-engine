import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BehaviorEditor } from '../BehaviorEditor.jsx';

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

// Mock fetch for sounds API
global.fetch = vi.fn();

describe('BehaviorEditor', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch.mockResolvedValue({
            json: () => Promise.resolve({
                sounds: [
                    { name: 'splash', filename: 'splash.mp3' },
                    { name: 'wave', filename: 'wave.wav' }
                ]
            })
        });
    });

    describe('rendering', () => {
        it('renders with empty behaviors', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            expect(screen.getByText('Active Behaviors')).toBeInTheDocument();
        });

        it('renders sprite name when provided', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} spriteName="boat" />);
            expect(screen.getByText('boat')).toBeInTheDocument();
        });

        it('renders tabs for Motion and Sound', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            expect(screen.getByText('Motion')).toBeInTheDocument();
            expect(screen.getByText('Sound')).toBeInTheDocument();
        });

        it('shows empty state message when no behaviors', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            expect(screen.getByText('No motion behaviors defined.')).toBeInTheDocument();
        });
    });

    describe('tab switching', () => {
        it('switches to Sound tab when clicked', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getByText('Sound'));
            expect(screen.getByText('No sound behaviors defined.')).toBeInTheDocument();
        });
    });

    describe('behavior cards', () => {
        const oscillateBehavior = {
            type: 'oscillate',
            enabled: true,
            frequency: 1.0,
            amplitude: 10,
            coordinate: 'y',
            phase_offset: 0
        };

        it('renders behavior card for oscillate behavior', () => {
            render(<BehaviorEditor behaviors={[oscillateBehavior]} onChange={mockOnChange} />);
            expect(screen.getByText(/OSCILLATE/)).toBeInTheDocument();
        });

        it('shows frequency label for oscillate behavior when expanded', () => {
            render(<BehaviorEditor behaviors={[oscillateBehavior]} onChange={mockOnChange} />);
            // Cards are collapsed by default, click to expand
            fireEvent.click(screen.getByText(/OSCILLATE/));
            expect(screen.getByText(/Frequency/)).toBeInTheDocument();
        });
    });

    describe('add behavior', () => {
        it('shows add menu when Add Behavior is clicked', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getByTitle("Add Behavior"));
            expect(screen.getByText('Oscillate')).toBeInTheDocument();
        });

        it('calls onChange when behavior is added', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getByTitle("Add Behavior"));
            fireEvent.click(screen.getByText('Oscillate'));

            expect(mockOnChange).toHaveBeenCalledWith([
                expect.objectContaining({ type: 'oscillate' })
            ]);
        });

        it('shows only sound type in Sound tab', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getAllByText('Sound')[0]); // Click tab
            fireEvent.click(screen.getByTitle("Add Behavior"));
            // Menu should show Sound option
            const menuItems = screen.getAllByText('Sound');
            expect(menuItems.length).toBeGreaterThan(0);
            expect(screen.queryByText('Oscillate')).not.toBeInTheDocument();
        });

        it('adds all behavior types', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            const types = ['Drift', 'Pulse', 'Background', 'Location'];
            types.forEach(type => {
                fireEvent.click(screen.getByTitle("Add Behavior"));
                fireEvent.click(screen.getByText(type));
                expect(mockOnChange).toHaveBeenCalled();
            });
        });
    });

    describe('remove behavior', () => {
        const behavior = { type: 'oscillate', enabled: true, frequency: 1.0, amplitude: 10, coordinate: 'y' };

        it('calls onChange with removed behavior', async () => {
            render(<BehaviorEditor behaviors={[behavior]} onChange={mockOnChange} />);

            // Click remove button (delete icon)
            const deleteButton = screen.getByTitle('Delete Behavior');
            fireEvent.click(deleteButton);

            expect(mockOnChange).toHaveBeenCalledWith([]);
        });
    });

    describe('update behavior', () => {
        const behavior = { type: 'oscillate', enabled: true, frequency: 1.0, amplitude: 10, coordinate: 'y' };

        it('calls onChange when field is updated', () => {
            render(<BehaviorEditor behaviors={[behavior]} onChange={mockOnChange} />);

            // Cards are collapsed by default, click to expand
            fireEvent.click(screen.getByText(/OSCILLATE/));

            // Get inputs by role - these are number inputs (spinbutton)
            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs.length).toBeGreaterThan(0);

            fireEvent.change(inputs[0], { target: { value: '2.5' } });
            expect(mockOnChange).toHaveBeenCalled();

            // Coordinate select
            const selects = screen.getAllByRole('combobox');
            fireEvent.change(selects[0], { target: { value: 'scale' } });
            expect(mockOnChange).toHaveBeenCalled();
        });

        it('handles pulse waveform update', () => {
            const pulse = { type: 'pulse', coordinate: 'opacity', frequency: 1, min_value: 0.5, max_value: 1.0, waveform: 'sine' };
            render(<BehaviorEditor behaviors={[pulse]} onChange={mockOnChange} />);
            // Expand the card first
            fireEvent.click(screen.getByText(/PULSE/));
            const selects = screen.getAllByRole('combobox');
            fireEvent.change(selects[1], { target: { value: 'spike' } });
            expect(mockOnChange).toHaveBeenCalled();
        });

        it('renders and updates drift behavior with cap', () => {
            const drift = { type: 'drift', coordinate: 'y', velocity: 10, drift_cap: 100 };
            render(<BehaviorEditor behaviors={[drift]} onChange={mockOnChange} />);
            // Expand the card first
            fireEvent.click(screen.getByText(/DRIFT/));
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[2], { target: { value: '200' } });
            expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ drift_cap: 200 })
            ]));
        });

        it('renders sound behavior fields', async () => {
            const sound = { type: 'sound', sound_file: 'splash.mp3', volume: 0.8, loop: true };
            render(<BehaviorEditor behaviors={[sound]} onChange={mockOnChange} />);

            // Switch to Sound tab
            act(() => {
                fireEvent.click(screen.getAllByText('Sound')[0]);
            });

            // Expand the sound behavior card (cards are collapsed by default)
            act(() => {
                fireEvent.click(screen.getByText(/SOUND/));
            });

            // Await the sound options to load to avoid act warning
            const soundSelect = await screen.findByRole('combobox');
            expect(soundSelect).toBeInTheDocument();

            // Check volume input
            const volumeInput = screen.getByLabelText(/Volume/);
            act(() => {
                fireEvent.change(volumeInput, { target: { value: '0.5' } });
            });
            expect(mockOnChange).toHaveBeenCalled();

            // Check loop checkbox
            const loopCheckbox = screen.getByRole('checkbox');
            act(() => {
                fireEvent.click(loopCheckbox);
            });
            expect(mockOnChange).toHaveBeenCalled();

            // Check fade-in input
            const fadeInInput = screen.getByLabelText(/Fade In/);
            act(() => {
                fireEvent.change(fadeInInput, { target: { value: '1.0' } });
            });
            expect(mockOnChange).toHaveBeenCalled();
        });

        it('renders and updates background behavior', () => {
            const bg = { type: 'background', scroll_speed: 0.5, coordinate: 'x' };
            render(<BehaviorEditor behaviors={[bg]} onChange={mockOnChange} />);
            // Expand the card first
            fireEvent.click(screen.getByText(/BACKGROUND/));
            const scrollInput = screen.getByLabelText(/Scroll Speed/);
            fireEvent.change(scrollInput, { target: { value: '1.0' } });
            expect(mockOnChange).toHaveBeenCalled();
        });

        it('handles unknown behavior type in createDefaultBehavior', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getByTitle("Add Behavior"));
            // We can't easily trigger the "unknown" branch via UI if we filter types, 
            // but we can test the migration/fallback logic if any.
        });
    });

    describe('read-only mode', () => {
        it('hides add button in read-only mode', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} readOnly={true} />);
            expect(screen.queryByTitle("Add Behavior")).not.toBeInTheDocument();
        });
    });

    // Note: visibility toggle and remove sprite buttons have been moved to ImageViewer floating controls
});

