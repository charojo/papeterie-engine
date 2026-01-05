import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AssetDetailLayout } from '../AssetDetailLayout';

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

describe('AssetDetailLayout', () => {
    const defaultProps = {
        visualContent: <div>Visual Content Content</div>,
        configContent: <div>Configuration Content Content</div>,
        logs: 'Initial log'
    };

    it('renders main content in normal mode', () => {
        render(<AssetDetailLayout {...defaultProps} />);
        expect(screen.getByText('Visual Content Content')).toBeInTheDocument();
        expect(screen.getByText('Configuration Content Content')).toBeInTheDocument();
        // Log starts minimized, last line shown in summary
        expect(screen.getByText('Initial log')).toBeInTheDocument();
    });

    it('hides config in expanded mode', () => {
        render(<AssetDetailLayout {...defaultProps} isExpanded={true} />);
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

        // Find copy button by icon testid (now uses icon instead of text)
        const copyIcon = screen.getByTestId('icon-copy');
        fireEvent.click(copyIcon.closest('button'));

        expect(mockWriteText).toHaveBeenCalledWith('Initial log');
        // Check icon changes to check mark
        expect(screen.getByTestId('icon-check')).toBeInTheDocument();

        // Wait for feedback to reset
        act(() => {
            vi.advanceTimersByTime(2000);
        });
        expect(screen.queryByTestId('icon-check')).not.toBeInTheDocument();
        expect(screen.getByTestId('icon-copy')).toBeInTheDocument();

        vi.useRealTimers();
    });

    it('scolls logs when expanded and updated', () => {
        const { rerender } = render(<AssetDetailLayout {...defaultProps} />);

        // First expand the log panel (it starts minimized, shows collapse/up arrow icon)
        const collapseIcon = screen.getByTestId('icon-collapse');
        fireEvent.click(collapseIcon.closest('button'));

        // Now logs should be visible in pre element
        const logPre = screen.getByText('Initial log');

        // Mock scroll properties
        Object.defineProperty(logPre, 'scrollHeight', { value: 500 });
        const scrollTopSpy = vi.spyOn(logPre, 'scrollTop', 'set');

        rerender(<AssetDetailLayout {...defaultProps} logs="Updated log" />);
        expect(scrollTopSpy).toHaveBeenCalledWith(500);
    });

    it('toggles log panel between minimized and expanded', () => {
        render(<AssetDetailLayout {...defaultProps} logs={"Line 1\nLine 2\nLine 3"} />);

        // Initially minimized - only last line visible, shows collapse/up arrow icon
        expect(screen.getByText('Line 3')).toBeInTheDocument();
        expect(screen.queryByText('SYSTEM LOGS')).not.toBeInTheDocument();

        // Expand (click up arrow to expand)
        const collapseIcon = screen.getByTestId('icon-collapse');
        fireEvent.click(collapseIcon.closest('button'));

        // Now should see full logs and header, shows expand/down arrow icon
        expect(screen.getByText('SYSTEM LOGS')).toBeInTheDocument();
        expect(screen.getByTestId('icon-expand')).toBeInTheDocument();

        // Collapse (click down arrow to close)
        const expandIcon = screen.getByTestId('icon-expand');
        fireEvent.click(expandIcon.closest('button'));

        // Back to minimized
        expect(screen.queryByText('SYSTEM LOGS')).not.toBeInTheDocument();
        expect(screen.getByTestId('icon-collapse')).toBeInTheDocument();
    });
});

