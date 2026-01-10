import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewSpriteForm } from '../NewSpriteForm';

// Mock fetch
global.fetch = vi.fn();

// Mock toast
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        promise: vi.fn()
    }
}));

describe('NewSpriteForm', () => {
    const mockOnSuccess = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch.mockReset();
    });

    it('renders form fields correctly', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);

        expect(screen.getByLabelText(/Sprite Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Source Image/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create Sprite/i })).toBeInTheDocument();
    });

    it('renders Cancel button when onCancel is provided', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('does not render Cancel button when onCancel is not provided', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} />);
        expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it('calls onCancel when Cancel button is clicked', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('allows typing in the name input', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);

        const nameInput = screen.getByLabelText(/Sprite Name/i);
        fireEvent.change(nameInput, { target: { value: 'test_sprite' } });

        expect(nameInput.value).toBe('test_sprite');
    });

    it('auto-fills name from file when name is empty', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);

        const fileInput = screen.getByLabelText(/Source Image/i);
        const file = new File(['test'], 'my_dragon.png', { type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        const nameInput = screen.getByLabelText(/Sprite Name/i);
        expect(nameInput.value).toBe('my_dragon');
    });

    it('shows error toast when submitting without name or file', async () => {
        const { toast } = await import('sonner');
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);

        fireEvent.click(screen.getByRole('button', { name: /Create Sprite/i }));

        expect(toast.error).toHaveBeenCalledWith(
            "Missing Information",
            expect.objectContaining({ description: expect.any(String) })
        );
    });

    it('disables buttons while loading', async () => {
        // Mock a slow response
        global.fetch.mockImplementation(() => new Promise(() => { })); // Never resolves

        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);

        const nameInput = screen.getByLabelText(/Sprite Name/i);
        const fileInput = screen.getByLabelText(/Source Image/i);
        const file = new File(['test'], 'test.png', { type: 'image/png' });

        fireEvent.change(nameInput, { target: { value: 'test' } });
        fireEvent.change(fileInput, { target: { files: [file] } });

        fireEvent.click(screen.getByRole('button', { name: /Create Sprite/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
        });
    });
});
