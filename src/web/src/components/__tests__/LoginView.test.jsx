import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginView } from '../LoginView';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

// Mock Icon
vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

describe('LoginView', () => {
    const mockOnLogin = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('renders login form by default', () => {
        render(<LoginView onLogin={mockOnLogin} />);

        expect(screen.getByText('Cloud Theater')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('curtain@call.com')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
        expect(screen.getByText('Local Theater')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Enter Local Theater/i })).toBeInTheDocument();
    });

    it('switches to registration form', () => {
        render(<LoginView onLogin={mockOnLogin} />);

        const toggleButton = screen.getByText('Sign Up');
        fireEvent.click(toggleButton);

        expect(screen.getByText('New Playwright')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('The Playwright')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    });

    it('handles login success', async () => {
        const mockUser = { access_token: 'fake-token', user: { username: 'testuser' } };
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockUser)
        });

        render(<LoginView onLogin={mockOnLogin} />);

        fireEvent.change(screen.getByPlaceholderText('curtain@call.com'), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        await waitFor(() => {
            expect(mockOnLogin).toHaveBeenCalledWith(mockUser);
        });
    });

    it('handles login failure', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ detail: 'Invalid credentials' })
        });

        const { toast } = await import('sonner');

        render(<LoginView onLogin={mockOnLogin} />);

        fireEvent.change(screen.getByPlaceholderText('curtain@call.com'), { target: { value: 'wrong@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });

        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
        });
    });

    it('handles registration success', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: '123', username: 'newuser' })
        });

        const { toast } = await import('sonner');

        render(<LoginView onLogin={mockOnLogin} />);

        // Switch to register
        fireEvent.click(screen.getByText('Sign Up'));

        fireEvent.change(screen.getByPlaceholderText('The Playwright'), { target: { value: 'newuser' } });
        fireEvent.change(screen.getByPlaceholderText('curtain@call.com'), { target: { value: 'new@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Registration successful! Please login.');
            expect(screen.getByText('Cloud Theater')).toBeInTheDocument();
        });
    });

    it('handles enter local theater bypass', () => {
        render(<LoginView onLogin={mockOnLogin} />);

        const localButton = screen.getByRole('button', { name: /Enter Local Theater/i });
        fireEvent.click(localButton);

        expect(mockOnLogin).toHaveBeenCalledWith({
            user: { username: 'Guest' },
            access_token: 'default',
            type: 'local'
        });
    });
});
