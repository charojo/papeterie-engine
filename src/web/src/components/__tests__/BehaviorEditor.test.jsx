import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
            expect(screen.getByText('Editing: boat')).toBeInTheDocument();
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

        it('shows frequency label for oscillate behavior', () => {
            render(<BehaviorEditor behaviors={[oscillateBehavior]} onChange={mockOnChange} />);
            expect(screen.getByText(/Frequency/)).toBeInTheDocument();
        });
    });

    describe('add behavior', () => {
        it('shows add menu when Add Behavior is clicked', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getByText(/Add Behavior/));
            expect(screen.getByText('Oscillate')).toBeInTheDocument();
        });

        it('calls onChange when behavior is added', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getByText(/Add Behavior/));
            fireEvent.click(screen.getByText('Oscillate'));

            expect(mockOnChange).toHaveBeenCalledWith([
                expect.objectContaining({ type: 'oscillate' })
            ]);
        });

        it('shows only sound type in Sound tab', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
            fireEvent.click(screen.getAllByText('Sound')[0]); // Click tab
            fireEvent.click(screen.getByText(/Add Behavior/));
            // Menu should show Sound option
            const menuItems = screen.getAllByText('Sound');
            expect(menuItems.length).toBeGreaterThan(0);
            expect(screen.queryByText('Oscillate')).not.toBeInTheDocument();
        });
    });

    describe('remove behavior', () => {
        const behavior = { type: 'oscillate', enabled: true, frequency: 1.0, amplitude: 10, coordinate: 'y' };

        it('calls onChange with removed behavior', async () => {
            render(<BehaviorEditor behaviors={[behavior]} onChange={mockOnChange} />);

            // Click remove button (delete icon)
            const deleteButton = screen.getByTitle('Remove');
            fireEvent.click(deleteButton);

            expect(mockOnChange).toHaveBeenCalledWith([]);
        });
    });

    describe('update behavior', () => {
        const behavior = { type: 'oscillate', enabled: true, frequency: 1.0, amplitude: 10, coordinate: 'y' };

        it('calls onChange when field is updated', () => {
            render(<BehaviorEditor behaviors={[behavior]} onChange={mockOnChange} />);

            // Get inputs by role - these are number inputs (spinbutton)
            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs.length).toBeGreaterThan(0);

            fireEvent.change(inputs[0], { target: { value: '2.5' } });
            expect(mockOnChange).toHaveBeenCalled();
        });
    });

    describe('visibility toggle', () => {
        it('renders visibility button when onToggleVisibility is provided', () => {
            const mockToggle = vi.fn();
            render(
                <BehaviorEditor
                    behaviors={[]}
                    onChange={mockOnChange}
                    spriteName="boat"
                    isVisible={true}
                    onToggleVisibility={mockToggle}
                />
            );

            expect(screen.getByTitle(/Hide Sprite/)).toBeInTheDocument();
        });

        it('calls onToggleVisibility when clicked', () => {
            const mockToggle = vi.fn();
            render(
                <BehaviorEditor
                    behaviors={[]}
                    onChange={mockOnChange}
                    spriteName="boat"
                    isVisible={true}
                    onToggleVisibility={mockToggle}
                />
            );

            fireEvent.click(screen.getByTitle(/Hide Sprite/));
            expect(mockToggle).toHaveBeenCalled();
        });
    });

    describe('remove sprite', () => {
        it('renders remove button when onRemoveSprite is provided', () => {
            const mockRemove = vi.fn();
            render(
                <BehaviorEditor
                    behaviors={[]}
                    onChange={mockOnChange}
                    onRemoveSprite={mockRemove}
                />
            );

            expect(screen.getByTitle(/Remove Sprite/)).toBeInTheDocument();
        });
    });

    describe('read-only mode', () => {
        it('hides add button in read-only mode', () => {
            render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} readOnly={true} />);
            expect(screen.queryByText(/Add Behavior/)).not.toBeInTheDocument();
        });
    });
});
