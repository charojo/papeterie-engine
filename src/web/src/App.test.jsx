import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock child components
vi.mock('./components/GenericDetailView', () => ({
    GenericDetailView: ({ type, asset }) => (
        <div data-testid={`detail-view-${type}`}>{asset.name}</div>
    )
}));

vi.mock('./components/Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

vi.mock('./components/SceneSelectionDialog', () => ({
    SceneSelectionDialog: ({ onSelect, onCreate }) => (
        <div data-testid="scene-selection-dialog">
            <button onClick={() => onSelect({ name: 'castle' })}>Select castle</button>
            <button onClick={onCreate}>Create New</button>
        </div>
    )
}));

// Mock sonner
vi.mock('sonner', () => ({
    Toaster: () => <div data-testid="toaster" />,
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn()
    }
}));

const mockScenes = [{ name: 'castle' }];

describe('App Component', () => {
    beforeEach(() => {
        localStorage.clear();
        global.fetch = vi.fn((url) => {
            if (url.endsWith('/config')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ storage_mode: 'LOCAL' })
                });
            }
            if (url.endsWith('/scenes')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockScenes)
                });
            }
            if (url.endsWith('/sprites')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([])
                });
            }
            return Promise.reject(new Error('Unknown URL ' + url));
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const loginAsGuest = () => {
        localStorage.setItem('papeterie-user', JSON.stringify({
            user: { username: 'TestUser' },
            type: 'local'
        }));
    };

    it('renders TopBar and Welcome state by default', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        expect(screen.getByText('Papeterie')).toBeInTheDocument(); // Title in TopBar
        expect(screen.getByText('Welcome to Papeterie')).toBeInTheDocument(); // Welcome state
        expect(screen.getByTitle('Create/Open a Scene')).toBeInTheDocument(); // Open button icon
    });

    it('opens SceneSelectionDialog when Open is clicked', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        const openBtn = screen.getByTitle('Create/Open a Scene');
        fireEvent.click(openBtn);

        expect(screen.getByTestId('scene-selection-dialog')).toBeInTheDocument();
    });

    it('navigates to scene detail when scene is selected', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        // Open dialog
        fireEvent.click(screen.getByTitle('Create/Open a Scene'));

        // Select scene (mocked dialog button)
        fireEvent.click(screen.getByText('Select castle'));

        expect(screen.getByTestId('detail-view-scene')).toBeInTheDocument();
        expect(screen.getByTestId('detail-view-scene')).toHaveTextContent('castle');
    });

    it('navigates to create view when New Scene is clicked in dialog', async () => {
        loginAsGuest();
        await act(async () => {
            render(<App />);
        });

        // Open dialog
        fireEvent.click(screen.getByTitle('Create/Open a Scene'));

        // Click create new in dialog mock
        fireEvent.click(screen.getByText('Create New'));

        expect(screen.getAllByText('Upload Scene')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Generate Scene')[0]).toBeInTheDocument();
    });
});
