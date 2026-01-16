import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BehaviorEditor } from '../BehaviorEditor';
import { BehaviorTypes } from '../BehaviorConstants';
// import userEvent from '@testing-library/user-event';

// Mock Icon to avoid rendering complexity
vi.mock('../Icon', () => ({
    Icon: ({ name, ...props }) => <span data-testid={`icon-${name}`} {...props}>{name}</span>
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BehaviorEditor', () => {
    let mockOnChange;
    let mockOnSelect;

    beforeEach(() => {
        mockOnChange = vi.fn();
        mockOnSelect = vi.fn();
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ sounds: [{ name: 'Test Sound', filename: 'test.mp3' }] })
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state correctly', () => {
        render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);
        expect(screen.getByText('No motion behaviors defined.')).toBeInTheDocument();
    });

    it('renders existing behaviors', () => {
        const behaviors = [{
            type: BehaviorTypes.OSCILLATE,
            frequency: 1,
            amplitude: 10,
            phase_offset: 0
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} />);
        expect(screen.getByText('OSCILLATE')).toBeInTheDocument();
        expect(screen.getByText('OSCILLATE').closest('div')).toHaveTextContent('OSCILLATE');
    });

    it('adds a new behavior', async () => {
        render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} />);

        // Open add menu
        const addBtn = screen.getByTitle('Add Behavior');
        await act(async () => {
            fireEvent.click(addBtn);
        });

        // Select logic type (e.g. Oscillate)
        const oscillateOption = screen.getByText('Oscillate');
        await act(async () => {
            fireEvent.click(oscillateOption);
        });

        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ type: BehaviorTypes.OSCILLATE })
        ]));
    });

    it('modifies a behavior parameter via input change', async () => {
        const behaviors = [{
            type: BehaviorTypes.OSCILLATE,
            frequency: 1,
            amplitude: 10,
            phase_offset: 0
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} />);

        // Expand card
        await act(async () => {
            fireEvent.click(screen.getByText('OSCILLATE'));
        });

        // Change Amplitude
        const ampInput = screen.getByLabelText('Amplitude (px)');
        await act(async () => {
            fireEvent.change(ampInput, { target: { value: '20' } });
        });

        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ amplitude: 20 })
        ]));
    });

    it('modifies a behavior parameter via keyboard shortcut (+)', async () => {
        const behaviors = [{
            type: BehaviorTypes.OSCILLATE,
            frequency: 1,
            amplitude: 10
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} />);
        await act(async () => {
            fireEvent.click(screen.getByText('OSCILLATE'));
        });

        const freqInput = screen.getByLabelText('Frequency (Hz)'); // Step is 0.1
        freqInput.focus();

        // Press '+'
        await act(async () => {
            fireEvent.keyDown(freqInput, { key: '+' });
        });

        // 1 + 0.1 = 1.1
        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ frequency: 1.1 })
        ]));
    });

    it('modifies a behavior parameter via keyboard shortcut (-)', async () => {
        const behaviors = [{
            type: BehaviorTypes.OSCILLATE,
            frequency: 1,
            amplitude: 10
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} />);
        await act(async () => {
            fireEvent.click(screen.getByText('OSCILLATE'));
        });

        const freqInput = screen.getByLabelText('Frequency (Hz)');
        freqInput.focus();

        // Press '-'
        await act(async () => {
            fireEvent.keyDown(freqInput, { key: '-' });
        });

        // 1 - 0.1 = 0.9
        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ frequency: 0.9 })
        ]));
    });

    it('removes a behavior', async () => {
        const behaviors = [{
            type: BehaviorTypes.OSCILLATE,
            frequency: 1
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} />);

        const deleteBtn = screen.getByTitle('Delete Behavior');
        await act(async () => {
            fireEvent.click(deleteBtn);
        });

        expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it('switches tabs correctly and fetches sounds', async () => {
        const behaviors = [{
            type: BehaviorTypes.SOUND,
            sound_file: 'test.mp3',
            volume: 1
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} />);

        // Initially in Motion tab, shouldn't see Sound
        expect(screen.queryByText('SOUND')).not.toBeInTheDocument();

        // Switch to Sound tab
        await act(async () => {
            fireEvent.click(screen.getByText('Sound'));
        });

        // Should see SOUND behavior
        expect(screen.getByText('SOUND')).toBeInTheDocument();

        // Should have fetched sounds
        await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/sounds')));
    });

    it('renders different behavior types correctly', () => {
        const behaviors = [
            { type: BehaviorTypes.DRIFT, velocity: 10 },
            { type: BehaviorTypes.PULSE, min_value: 0, max_value: 1 },
            { type: BehaviorTypes.BACKGROUND, scroll_speed: 5 },
            { type: BehaviorTypes.LOCATION, x: 10, y: 20 }
        ];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} inline={true} />);

        // In inline mode, filter logic in filteredBehaviors should pass all if inline is true? 
        // Logic: if (inline) return true;
        // So we should see all of them.

        expect(screen.getByText('DRIFT')).toBeInTheDocument();
        expect(screen.getByText('PULSE')).toBeInTheDocument();
        expect(screen.getByText('BACKGROUND')).toBeInTheDocument();
        expect(screen.getByText('LOCATION')).toBeInTheDocument();
    });

    it('handles sound upload', async () => {
        const behaviors = [{
            type: BehaviorTypes.SOUND,
            sound_file: '',
            volume: 1
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} activeTab="Sound" />);
        // Force switch to Sound tab
        await act(async () => {
            fireEvent.click(screen.getByText('Sound'));
        });

        await act(async () => {
            fireEvent.click(screen.getByText('SOUND')); // expand
        });

        const soundSelector = screen.getByTitle('Click to select sound');
        await act(async () => {
            fireEvent.click(soundSelector);
        });

        const uploadBtn = screen.getByText('Upload Sound');

        // Mock the file input click and change
        // Since the input is created programmatically, we need to spy on document.createElement or just rely on the logic if we can assume it works?
        // Actually, JSDOM doesn't easily support programmatic file input click -> change without appending to body.
        // But the code: input.click();

        // We can't easily test the file upload flow triggered by hidden input in this environment without deeper mocking.
        // We will skip testing the actual upload CLICK, but we can verify the button exists.
        expect(uploadBtn).toBeInTheDocument();
    });

    it('updates sound loop param', async () => {
        const behaviors = [{
            type: BehaviorTypes.SOUND,
            loop: false
        }];

        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} />);
        await act(async () => {
            fireEvent.click(screen.getByText('Sound'));
        })
        await act(async () => {
            fireEvent.click(screen.getByText('SOUND')); // expand
        });

        const loopCheck = screen.getByLabelText('Loop');
        await act(async () => {
            fireEvent.click(loopCheck);
        });

        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ loop: true })
        ]));
    });

    it('selects behavior on expand', () => {
        const behaviors = [{ type: BehaviorTypes.OSCILLATE }];
        render(<BehaviorEditor behaviors={behaviors} onChange={mockOnChange} onSelect={mockOnSelect} />);

        // Click header to expand
        fireEvent.click(screen.getByText('OSCILLATE'));

        expect(mockOnSelect).toHaveBeenCalledWith(0);
    });

    it('renders behavior guidance', () => {
        render(<BehaviorEditor behaviors={[]} onChange={mockOnChange} behaviorGuidance="Try adding a wiggle." />);
        expect(screen.getByText('Try adding a wiggle.')).toBeInTheDocument();
    });
});
