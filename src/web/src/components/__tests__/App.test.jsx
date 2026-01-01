import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../../App';

// Mock dependencies
vi.mock('../../components/AssetDetailLayout', () => ({
    AssetDetailLayout: ({ title, statusLabel, actions, visualContent, configContent }) => (
        <div data-testid="detail-layout">
            <h1 data-testid="detail-title">{title}</h1>
            <span data-testid="detail-status">{statusLabel}</span>
            <div data-testid="detail-actions">{actions}</div>
            <div data-testid="detail-visual">{visualContent}</div>
            <div data-testid="detail-config">{configContent}</div>
        </div>
    )
}));

vi.mock('../../components/Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

// Mock ImageViewer to act as a simple placeholder since we test it separately
vi.mock('../../components/ImageViewer', () => ({
    ImageViewer: () => <div data-testid="image-viewer">ImageViewer</div>
}));

// Mock toast
vi.mock('sonner', () => ({
    Toaster: () => null,
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        promise: vi.fn((promise) => promise)
    }
}));

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('renders sidebar and initial empty state', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => []
        });

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            expect(screen.getByText('Papeterie')).toBeInTheDocument();
        });

        expect(screen.getByText('Scenes')).toBeInTheDocument();
        expect(screen.getByText('Sprites')).toBeInTheDocument();
        expect(screen.getByText('Select a Scene or Sprite')).toBeInTheDocument();
    });

    it('fetches and displays sprites and scenes', async () => {
        const mockSprites = [{ name: 'sprite1', has_metadata: true }, { name: 'sprite2', has_metadata: false }];
        const mockScenes = [{ name: 'scene1' }];

        global.fetch.mockImplementation((url, options = {}) => {
            if (url.includes('/sprites')) return Promise.resolve({ ok: true, json: async () => mockSprites });
            if (url.includes('/scenes')) return Promise.resolve({ ok: true, json: async () => mockScenes });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            expect(screen.getByText('sprite1')).toBeInTheDocument();
            expect(screen.getByText('sprite2')).toBeInTheDocument();
            expect(screen.getByText('scene1')).toBeInTheDocument();
        });
    });

    it('navigates to create view when add button clicked', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => [] });

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => screen.getByText('Papeterie'));

        const addBtn = screen.getByTestId('icon-add').closest('button');
        fireEvent.click(addBtn);

        expect(screen.getByText('New Sprite')).toBeInTheDocument();
        expect(screen.getByText('Upload Scene')).toBeInTheDocument();
        expect(screen.getByText('Generate Scene')).toBeInTheDocument();
    });

    it('selects a sprite and shows detail view', async () => {
        const mockSprites = [{ name: 'dragon', has_metadata: true }];
        global.fetch.mockImplementation((url, options = {}) => {
            if (url.endsWith('/sprites')) return Promise.resolve({ ok: true, json: async () => mockSprites });
            if (url.endsWith('/scenes')) return Promise.resolve({ ok: true, json: async () => [] });
            if (url.includes('/logs')) return Promise.resolve({ ok: true, json: async () => ({ content: 'logs' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => screen.getByText('dragon'));

        fireEvent.click(screen.getByText('dragon'));

        await waitFor(() => {
            expect(screen.getByTestId('detail-layout')).toBeInTheDocument();
            expect(screen.getByTestId('detail-title')).toHaveTextContent('dragon');
            expect(screen.getByTestId('detail-status')).toHaveTextContent('Configured');
        });
    });

    it('selects a scene and shows detail view', async () => {
        const mockScenes = [{ name: 'forest', used_sprites: ['tree'] }];
        global.fetch.mockImplementation((url, options = {}) => {
            if (url.endsWith('/sprites')) return Promise.resolve({ ok: true, json: async () => [] });
            if (url.endsWith('/scenes')) return Promise.resolve({ ok: true, json: async () => mockScenes });
            if (url.includes('/logs')) return Promise.resolve({ ok: true, json: async () => ({ content: 'logs' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => screen.getByText('forest'));

        fireEvent.click(screen.getByText('forest'));

        await waitFor(() => {
            expect(screen.getByTestId('detail-layout')).toBeInTheDocument();
            expect(screen.getByTestId('detail-title')).toHaveTextContent('forest');
            expect(screen.getByTestId('detail-status')).toHaveTextContent('Configured');
            expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
        });
    });

    it('creates a new sprite', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => [] });
        const { container } = render(<App />);

        await act(async () => { });

        // Navigate to create
        const addBtn = screen.getByTestId('icon-add').closest('button');
        fireEvent.click(addBtn);

        // Fill form
        const nameInput = screen.getByPlaceholderText('e.g. mythical_dragon');
        fireEvent.change(nameInput, { target: { value: 'new_sprite' } });

        // Fix: Input not associated with label, find by type
        const fileInput = container.querySelector('input[type="file"]');
        const file = new File(['(⌐□_□)'], 'new_sprite.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Mock create API
        global.fetch.mockImplementation((url, options = {}) => {
            if (url.includes('/upload') && options.method === 'POST') {
                return Promise.resolve({ ok: true, json: async () => ({ name: 'new_sprite' }) });
            }
            if (url.includes('/sprites')) {
                return Promise.resolve({ ok: true, json: async () => [{ name: 'new_sprite' }] });
            }
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        // Submit
        const createBtn = screen.getByText('Create Sprite');
        await act(async () => { fireEvent.click(createBtn); });

        // Wait for success and redirection
        await waitFor(() => {
            expect(screen.getByTestId('detail-title')).toHaveTextContent('new_sprite');
        });
    });

    it('optimizes a sprite', async () => {
        const mockSprite = { name: 'dragon', has_metadata: false };

        let resolveFetch;
        const fetchPromise = new Promise(r => { resolveFetch = r });

        global.fetch.mockImplementation((url, options = {}) => {
            if (url.endsWith('/sprites')) return Promise.resolve({ ok: true, json: async () => [mockSprite] });
            if (url.endsWith('/process')) return fetchPromise.then(() => ({ ok: true, json: async () => ({}) }));
            if (url.includes('/logs')) return Promise.resolve({ ok: true, json: async () => ({ content: 'logs' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        await act(async () => { render(<App />); });
        await waitFor(() => screen.getByText('dragon'));
        fireEvent.click(screen.getByText('dragon'));

        const optimizeBtn = screen.getByText('Optimize');
        fireEvent.click(optimizeBtn);

        // Now we should see the loading icon (mocked as text 'optimize')
        await waitFor(() => expect(screen.getByTestId('icon-optimize')).toBeInTheDocument());

        // Resolve fetch
        await act(async () => { resolveFetch(); });

        // Should revert to Optimize
        await waitFor(() => expect(screen.getByText('Optimize')).toBeInTheDocument());
    });

    it('deletes a sprite', async () => {
        const mockSprite = { name: 'dragon', has_metadata: true };
        // Mock confirm
        window.confirm = vi.fn(() => true);

        global.fetch.mockImplementation((url, options = {}) => {
            if (url.endsWith('/sprites')) return Promise.resolve({ ok: true, json: async () => [mockSprite] });
            if (url.endsWith('/scenes')) return Promise.resolve({ ok: true, json: async () => [] });
            if (url.includes('/sprites/dragon') && options?.method === 'DELETE') {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (url.includes('/logs')) return Promise.resolve({ ok: true, json: async () => ({ content: 'logs' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        await act(async () => { render(<App />); });
        await waitFor(() => screen.getByText('dragon'));
        fireEvent.click(screen.getByText('dragon'));

        const deleteBtn = screen.getByTestId('icon-delete').closest('button');
        await act(async () => { fireEvent.click(deleteBtn); });

        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/sprites/dragon'), expect.objectContaining({ method: 'DELETE' }));
    });
});
