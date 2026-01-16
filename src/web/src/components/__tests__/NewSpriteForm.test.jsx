import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NewSpriteForm } from '../NewSpriteForm';
import { API_BASE } from '../../config';
import { toast } from 'sonner';

// Mock Dependencies
vi.mock('../../config', () => ({
    API_BASE: 'http://test-api'
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        promise: vi.fn()
    }
}));

describe('NewSpriteForm', () => {
    let mockOnSuccess;
    let mockOnCancel;

    beforeEach(() => {
        mockOnSuccess = vi.fn();
        mockOnCancel = vi.fn();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
        expect(screen.getByPlaceholderText('e.g. mythical_dragon')).toBeInTheDocument();
        expect(screen.getByLabelText(/Source Image/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create Sprite/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('validates missing inputs', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} />);
        const submitBtn = screen.getByRole('button', { name: /Create Sprite/i });

        fireEvent.click(submitBtn);

        expect(toast.error).toHaveBeenCalledWith("Missing Information", expect.any(Object));
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('auto-fills name when file is selected', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} />);
        const fileInput = screen.getByLabelText(/Source Image/i);
        const nameInput = screen.getByPlaceholderText('e.g. mythical_dragon');

        const file = new File(['dummy content'], 'dragon.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(nameInput.value).toBe('dragon');
    });

    it('submits successfully', async () => {
        global.fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ name: 'dragon' })
        }));

        render(<NewSpriteForm onSuccess={mockOnSuccess} />);

        const fileInput = screen.getByLabelText(/Source Image/i);
        const submitBtn = screen.getByRole('button', { name: /Create Sprite/i });

        const file = new File(['dummy'], 'dragon.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        fireEvent.click(submitBtn);

        expect(global.fetch).toHaveBeenCalledWith(
            `${API_BASE}/sprites/upload`,
            expect.objectContaining({
                method: 'POST',
                body: expect.any(FormData)
            })
        );

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledWith('dragon');
        });
    });

    it('calls onCancel when cancel button clicked', () => {
        render(<NewSpriteForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
        const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
        fireEvent.click(cancelBtn);
        expect(mockOnCancel).toHaveBeenCalled();
    });
});
