import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock child components to isolate App logic
vi.mock('./components/GenericDetailView', () => ({
    GenericDetailView: ({ type, asset }) => (
        <div data-testid={`detail-view-${type}`}>{asset.name}</div>
    )
}));

vi.mock('./components/Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

// Mock sonner for toasts
vi.mock('sonner', () => ({
    Toaster: () => <div data-testid="toaster" />,
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        promise: vi.fn((promise) => promise)
    }
}));

// Mock data
const mockSprites = [
    { name: 'dragon', has_metadata: true },
    { name: 'knight', has_metadata: false }
];

const mockScenes = [
    { name: 'castle' },
    { name: 'dungeon' }
];

describe('App Component', () => {
    beforeEach(() => {
        localStorage.clear();
        // Default: start with no user to avoid unwanted side effects
        // Individual tests will set the user if they need to be in the "App" view.

        // Reset fetch mock before each test
        global.fetch = vi.fn();

        // Default successful fetch response
        global.fetch.mockImplementation((url) => {
            if (url.endsWith('/config')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ storage_mode: 'LOCAL' })
                });
            }
            if (url.endsWith('/sprites')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockSprites)
                });
            }
            if (url.endsWith('/scenes')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockScenes)
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const loginAsGuest = () => {
        localStorage.setItem('papeterie-user', JSON.stringify({
            user: { username: 'TestUser' },
            access_token: 'mock-token',
            type: 'local'
        }));
    };

    it('renders sidebar and fetches data on mount', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        // Check header
        expect(screen.getByText('Papeterie')).toBeInTheDocument();

        // Check if sprites and scenes are rendered in sidebar
        await waitFor(() => {
            expect(screen.getByText('dragon')).toBeInTheDocument();
            expect(screen.getByText('knight')).toBeInTheDocument();
            expect(screen.getByText('castle')).toBeInTheDocument();
            expect(screen.getByText('dungeon')).toBeInTheDocument();
        });
    });

    it('navigates to create view when add button is clicked', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        const addButton = screen.getByTitle('Add');
        fireEvent.click(addButton);

        expect(screen.getByText('New Sprite')).toBeInTheDocument();
        expect(screen.getByText('Upload Scene')).toBeInTheDocument();
        expect(screen.getByText('Generate Scene')).toBeInTheDocument();
    });

    it('selects a sprite and shows detail view', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        await waitFor(() => screen.getByText('dragon'));

        const spriteButton = screen.getByText('dragon').closest('div');
        // The text 'dragon' is inside a span inside the div which has the onClick.
        // However, the div has class 'btn'. Let's find by text and verify parent.

        fireEvent.click(screen.getByText('dragon'));

        await waitFor(() => {
            expect(screen.getByTestId('detail-view-sprite')).toBeInTheDocument();
            expect(screen.getByTestId('detail-view-sprite')).toHaveTextContent('dragon');
        });
    });

    it('selects a scene and shows detail view', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        await waitFor(() => screen.getByText('castle'));

        fireEvent.click(screen.getByText('castle'));

        await waitFor(() => {
            expect(screen.getByTestId('detail-view-scene')).toBeInTheDocument();
            expect(screen.getByTestId('detail-view-scene')).toHaveTextContent('castle');
        });
    });

    it('handles fetch errors gracefully', async () => {
        loginAsGuest();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Success for config, then failure for sprites
        global.fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ storage_mode: 'LOCAL' })
        })).mockRejectedValueOnce(new Error('Network error'));

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            // Should have been called at least for config and then sprites/scenes
            expect(global.fetch).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch data", expect.any(Error));
        });

        consoleSpy.mockRestore();
    });

    it('Create Sprite form submission', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        // Go to create view
        fireEvent.click(screen.getByTitle('Add'));

        // Select "New Sprite" (default)
        const newSpriteTile = screen.getByText('New Sprite');
        fireEvent.click(newSpriteTile);

        // Fill form
        const nameInput = screen.getByLabelText(/sprite name/i);
        fireEvent.change(nameInput, { target: { value: 'new_sprite' } });

        const fileInput = screen.getByLabelText(/source image/i);
        const file = new File(['(⌐□_□)'], 'cool.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Mock upload response
        global.fetch
            .mockResolvedValueOnce({ // /upload
                ok: true,
                json: () => Promise.resolve({ name: 'new_sprite' })
            })
            .mockResolvedValueOnce({ // /sprites (refresh)
                ok: true,
                json: () => Promise.resolve([...mockSprites, { name: 'new_sprite' }])
            })
            .mockResolvedValueOnce({ // /scenes (refresh)
                ok: true,
                json: () => Promise.resolve(mockScenes)
            })
            .mockResolvedValueOnce({ // /sprites (create view logic to find new item)
                ok: true,
                json: () => Promise.resolve([...mockSprites, { name: 'new_sprite' }])
            });


        const submitButton = screen.getByRole('button', { name: /create sprite/i });
        await act(async () => {
            fireEvent.click(submitButton);
        });

        // Expect navigation to sprite detail
        await waitFor(() => {
            expect(screen.getByTestId('detail-view-sprite')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('Create Scene Upload form submission', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        // Go to create
        const addButton = screen.getByTitle('Add');
        fireEvent.click(addButton);

        // Click tile
        fireEvent.click(screen.getByText('Upload Scene'));

        // Fill form
        const nameInput = screen.getByLabelText(/scene name/i);
        fireEvent.change(nameInput, { target: { value: 'new_scene' } });

        const fileInput = screen.getByLabelText(/original reference/i);
        const file = new File(['(scene)'], 'scene.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Mock sequence
        global.fetch
            .mockResolvedValueOnce({ // /scenes/upload
                ok: true,
                json: () => Promise.resolve({ name: 'new_scene' })
            })
            .mockResolvedValueOnce({ // /sprites (refresh)
                ok: true,
                json: () => Promise.resolve(mockSprites)
            })
            .mockResolvedValueOnce({ // /scenes (refresh)
                ok: true,
                json: () => Promise.resolve([...mockScenes, { name: 'new_scene' }])
            })
            .mockResolvedValueOnce({ // /scenes (create view logic)
                ok: true,
                json: () => Promise.resolve([...mockScenes, { name: 'new_scene' }])
            });

        const submitButton = screen.getByRole('button', { name: /create scene/i });
        await act(async () => {
            fireEvent.click(submitButton);
        });

        await waitFor(() => {
            expect(screen.getByTestId('detail-view-scene')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('Generate Scene form submission', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        // Go to create
        const addButton = screen.getByTitle('Add');
        fireEvent.click(addButton);

        // Click tile
        fireEvent.click(screen.getByText('Generate Scene'));

        // Fill form
        const nameInput = screen.getByLabelText(/scene name/i);
        fireEvent.change(nameInput, { target: { value: 'gen_scene' } });

        const promptInput = screen.getByLabelText(/description prompt/i);
        fireEvent.change(promptInput, { target: { value: 'A beautiful forest' } });

        // Mock sequence
        global.fetch
            .mockResolvedValueOnce({ // /scenes/generate
                ok: true,
                json: () => Promise.resolve({ name: 'gen_scene' })
            })
            .mockResolvedValueOnce({ // /sprites (refresh)
                ok: true,
                json: () => Promise.resolve(mockSprites)
            })
            .mockResolvedValueOnce({ // /scenes (refresh)
                ok: true,
                json: () => Promise.resolve([...mockScenes, { name: 'gen_scene' }])
            })
            .mockResolvedValueOnce({ // /scenes (create view logic)
                ok: true,
                json: () => Promise.resolve([...mockScenes, { name: 'gen_scene' }])
            });

        // Use getByRole to avoid ambiguity with the SelectionTile text
        const submitButton = screen.getByRole('button', { name: /generate scene/i });
        await act(async () => {
            fireEvent.click(submitButton);
        });

        await waitFor(() => {
            expect(screen.getByTestId('detail-view-scene')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders LoginView when STORAGE_MODE is CLOUD and not authenticated', async () => {
        // Mock config to be CLOUD
        global.fetch.mockImplementation((url) => {
            if (url.endsWith('/config')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ storage_mode: 'CLOUD' })
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            expect(screen.getByText('Cloud Theater')).toBeInTheDocument();
        });
    });

    it('can logout', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        const logoutButton = screen.getByTitle('Logout');
        fireEvent.click(logoutButton);

        expect(screen.getByText('Cloud Theater')).toBeInTheDocument();
        expect(localStorage.getItem('papeterie-user')).toBe(null);
    });

});
