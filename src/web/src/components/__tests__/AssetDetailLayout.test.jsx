import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AssetDetailLayout } from '../AssetDetailLayout';

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

// Mock StatusStepper
vi.mock('../StatusStepper', () => ({
    StatusStepper: ({ currentStatus }) => <span>{currentStatus}</span>
}));

describe('AssetDetailLayout', () => {
    const defaultProps = {
        title: 'Test Asset',
        statusLabel: 'Raw',
        actions: <button>Click Me</button>,
        visualContent: <div>Visual Content Content</div>,
        configContent: <div>Configuration Content Content</div>,
        logs: 'Initial log'
    };

    it('renders header and main content in normal mode', () => {
        render(<AssetDetailLayout {...defaultProps} />);
        expect(screen.getByText('Test Asset')).toBeInTheDocument();
        expect(screen.getByText('Raw')).toBeInTheDocument();
        expect(screen.getByText('Click Me')).toBeInTheDocument();
        expect(screen.getByText('Visual Content Content')).toBeInTheDocument();
        expect(screen.getByText('Configuration Content Content')).toBeInTheDocument();
        expect(screen.getByText('Initial log')).toBeInTheDocument();
    });

    it('hides header and config in expanded mode', () => {
        render(<AssetDetailLayout {...defaultProps} isExpanded={true} />);
        expect(screen.queryByText('Test Asset')).not.toBeInTheDocument();
        expect(screen.queryByText('Configuration Content Content')).not.toBeInTheDocument();
        expect(screen.getByText('Visual Content Content')).toBeInTheDocument();
    });

    it('handles log copy', async () => {
        // Mock clipboard
        const mockWriteText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: { writeText: mockWriteText }
        });

        vi.useFakeTimers();
        render(<AssetDetailLayout {...defaultProps} />);

        const copyButton = screen.getByText('Copy Log');
        fireEvent.click(copyButton);

        expect(mockWriteText).toHaveBeenCalledWith('Initial log');
        expect(screen.getByText('Copied!')).toBeInTheDocument();

        // Wait for feedback to reset
        act(() => {
            vi.advanceTimersByTime(2000);
        });
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
        expect(screen.getByText('Copy Log')).toBeInTheDocument();

        vi.useRealTimers();
    });

    it('scolls logs when updated', () => {
        const { rerender } = render(<AssetDetailLayout {...defaultProps} />);
        const logPre = screen.getByText('Initial log');

        // Mock scroll properties
        Object.defineProperty(logPre, 'scrollHeight', { value: 500 });
        const scrollTopSpy = vi.spyOn(logPre, 'scrollTop', 'set');

        rerender(<AssetDetailLayout {...defaultProps} logs="Updated log" />);
        expect(scrollTopSpy).toHaveBeenCalledWith(500);
    });
});
