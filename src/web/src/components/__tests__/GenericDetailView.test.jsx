import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenericDetailView } from '../GenericDetailView';

// Mock dependencies
vi.mock('../AssetDetailLayout', () => ({
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

vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

vi.mock('../ImageViewer', () => ({
    ImageViewer: () => <div data-testid="image-viewer">ImageViewer</div>
}));

vi.mock('../TheatreStage', () => ({
    TheatreStage: () => <div data-testid="theatre-stage">TheatreStage</div>
}));

vi.mock('../BehaviorEditor', () => ({
    BehaviorEditor: () => <div data-testid="behavior-editor">BehaviorEditor</div>
}));

vi.mock('../DeleteConfirmationDialog', () => ({
    DeleteConfirmationDialog: ({ isOpen, onConfirm }) => (
        isOpen ? (
            <div data-testid="delete-dialog">
                <button onClick={() => onConfirm('delete')}>Confirm</button>
            </div>
        ) : null
    )
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

// Mock window.confirm
window.confirm = vi.fn(() => true);

describe('GenericDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockImplementation(() => Promise.resolve({
            ok: true,
            json: async () => []
        }));
    });

    it('renders correctly for a sprite', () => {
        const mockSprite = { name: 'dragon', has_metadata: true, has_original: true };
        render(<GenericDetailView type="sprite" asset={mockSprite} refresh={vi.fn()} />);

        expect(screen.getByTestId('detail-title')).toHaveTextContent('dragon');
        expect(screen.getByTestId('detail-status')).toHaveTextContent('Configured');
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
    });

    it('optimizes a sprite', async () => {
        const mockSprite = { name: 'dragon', has_metadata: false };
        const refreshMock = vi.fn();

        let resolveFetch;
        const fetchPromise = new Promise(r => { resolveFetch = r });

        global.fetch.mockImplementation((url, options = {}) => {
            if (url.endsWith('/process')) return fetchPromise.then(() => ({ ok: true, json: async () => ({}) }));
            if (url.includes('/logs')) return Promise.resolve({ ok: true, json: async () => ({ content: 'logs' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        render(<GenericDetailView type="sprite" asset={mockSprite} refresh={refreshMock} />);

        // Find optimize button in the visual content prompts area
        const optimizeBtn = screen.getByText('Optimize');
        fireEvent.click(optimizeBtn);

        // Loading state
        await waitFor(() => expect(screen.getByTestId('icon-optimize')).toBeInTheDocument());

        // Resolve
        await act(async () => { resolveFetch(); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/process'),
            expect.objectContaining({ method: 'POST', body: expect.stringContaining('"optimize":true') })
        );
        expect(refreshMock).toHaveBeenCalled();
    });

    it('deletes a sprite', async () => {
        const mockSprite = { name: 'dragon', has_metadata: true };
        const refreshMock = vi.fn();

        global.fetch.mockImplementation((url, options = {}) => {
            if (url.includes('/sprites/dragon') && options?.method === 'DELETE') {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (url.includes('/logs')) return Promise.resolve({ ok: true, json: async () => ({ content: 'logs' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        render(<GenericDetailView type="sprite" asset={mockSprite} refresh={refreshMock} />);

        const deleteBtn = screen.getByTitle('Delete');

        await act(async () => { fireEvent.click(deleteBtn); });

        // Confirm dialog should appear
        await waitFor(() => expect(screen.getByTestId('delete-dialog')).toBeInTheDocument());

        const confirmBtn = screen.getByText('Confirm');
        await act(async () => { fireEvent.click(confirmBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sprites/dragon'),
            expect.objectContaining({ method: 'DELETE' })
        );
        expect(refreshMock).toHaveBeenCalled();
    });
});
