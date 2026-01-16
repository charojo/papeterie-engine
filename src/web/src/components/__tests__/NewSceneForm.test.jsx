import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NewSceneForm } from '../NewSceneForm';
import { API_BASE } from '../../config';
import { toast } from 'sonner';

// Mock Dependencies
vi.mock('../../config', () => ({
    API_BASE: 'http://test-api'
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        promise: (promise) => {
            // Catch the rejection to prevent "Unhandled Rejection" in tests
            promise.catch(() => { });
            return promise;
        }
    }
}));

describe('NewSceneForm', () => {
    let mockOnSuccess;

    beforeEach(() => {
        mockOnSuccess = vi.fn();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly', () => {
        render(<NewSceneForm onSuccess={mockOnSuccess} />);
        expect(screen.getByPlaceholderText('e.g. spooky_forest')).toBeInTheDocument();
        expect(screen.getByLabelText(/Original Reference Image/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload Scene/i })).toBeInTheDocument();
    });

    it('validates missing inputs', () => {
        render(<NewSceneForm onSuccess={mockOnSuccess} />);
        const submitBtn = screen.getByRole('button', { name: /Upload Scene/i });

        fireEvent.click(submitBtn);

        expect(toast.error).toHaveBeenCalledWith("Missing Information", expect.any(Object));
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('auto-fills name when file is selected', () => {
        render(<NewSceneForm onSuccess={mockOnSuccess} />);
        const fileInput = screen.getByLabelText(/Original Reference Image/i);
        const nameInput = screen.getByPlaceholderText('e.g. spooky_forest');

        const file = new File(['dummy content'], 'my_cool_scene.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(nameInput.value).toBe('my_cool_scene');
    });

    it('submits successfully', async () => {
        global.fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ name: 'my_cool_scene' })
        }));

        // Mock toast.promise to execute the promise immediately or return it
        // But the component uses toast.promise(promise, ...) so the promise executes regardless.

        render(<NewSceneForm onSuccess={mockOnSuccess} />);

        const fileInput = screen.getByLabelText(/Original Reference Image/i);
        const nameInput = screen.getByPlaceholderText('e.g. spooky_forest');
        const submitBtn = screen.getByRole('button', { name: /Upload Scene/i });

        const file = new File(['dummy'], 'scene.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });
        fireEvent.change(nameInput, { target: { value: 'custom_name' } });

        fireEvent.click(submitBtn);

        expect(global.fetch).toHaveBeenCalledWith(
            `${API_BASE}/scenes/upload`,
            expect.objectContaining({
                method: 'POST',
                body: expect.any(FormData)
            })
        );

        // Wait for async operations
        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledWith('my_cool_scene');
        });
    });

    it('handles API errors', async () => {
        global.fetch.mockImplementationOnce(() => Promise.resolve({
            ok: false,
            text: () => Promise.resolve('Upload failed from backend')
        }));

        // let caughtError = false; // Unused

        // Override mock for this specific test or rely on the global one if improved
        // The global mock I added:
        // promise: (promise) => { promise.catch(() => {}); return promise; }
        // This SHOULD work. 

        render(<NewSceneForm onSuccess={mockOnSuccess} />);

        const fileInput = screen.getByLabelText(/Original Reference Image/i);
        const submitBtn = screen.getByRole('button', { name: /Upload Scene/i });

        const file = new File(['dummy'], 'scene.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        fireEvent.click(submitBtn);

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());

        // Wait for any pending promises to settle
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockOnSuccess).not.toHaveBeenCalled();
    });
});
