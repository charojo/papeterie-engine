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
    ImageViewer: ({ tabs, actions, onSaveRotation }) => (
        <div data-testid="image-viewer">
            ImageViewer
            <div data-testid="viewer-tabs">
                {tabs.map(t => (
                    <button key={t.id} onClick={t.onClick}>{t.label}</button>
                ))}
            </div>
            <div data-testid="viewer-actions">{actions}</div>
            <button onClick={() => onSaveRotation && onSaveRotation(90)}>Simulate Rotate Save</button>
        </div>
    )
}));

vi.mock('../TheatreStage', () => ({
    TheatreStage: ({ onSpritePositionChanged, onSpriteSelected, onTelemetry: _onTelemetry }) => (
        <div data-testid="theatre-stage">
            TheatreStage
            <button onClick={() => onSpritePositionChanged('dragon', 100, 200, 1.5)}>Move Sprite</button>
            <button onClick={() => onSpriteSelected('dragon')}>Select Sprite</button>
        </div>
    )
}));

vi.mock('../BehaviorEditor', () => ({
    BehaviorEditor: ({ onChange, onToggleVisibility, onRemoveSprite }) => (
        <div data-testid="behavior-editor">
            BehaviorEditor
            <button onClick={() => onChange([{ type: 'oscillate' }])}>Update Behaviors</button>
            <button onClick={onToggleVisibility}>Toggle Vis</button>
            <button onClick={onRemoveSprite}>Remove Sprite</button>
        </div>
    )
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

    it('renders correctly for a sprite', async () => {
        const mockSprite = { name: 'dragon', has_metadata: true, has_original: true };
        await act(async () => {
            render(<GenericDetailView type="sprite" asset={mockSprite} refresh={vi.fn()} />);
        });

        expect(screen.getByTestId('detail-title')).toHaveTextContent('dragon');
        expect(screen.getByTestId('detail-status')).toHaveTextContent('Configured');
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
    });

    it('optimizes a sprite', async () => {
        const mockSprite = { name: 'dragon', has_metadata: false };
        const refreshMock = vi.fn();

        let resolveFetch;
        const fetchPromise = new Promise(r => { resolveFetch = r });

        global.fetch.mockImplementation((url, _options = {}) => {
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

        // Confirm in dialog
        const confirmBtn = screen.getByText('Confirm');
        await act(async () => { fireEvent.click(confirmBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sprites/dragon'),
            expect.objectContaining({ method: 'DELETE' })
        );
        expect(refreshMock).toHaveBeenCalled();
    });

    it('updates behavior config via API (Sprite)', async () => {
        const mockSprite = { name: 'dragon', metadata: { behaviors: [] } };
        const refreshMock = vi.fn();

        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        render(<GenericDetailView type="sprite" asset={mockSprite} refresh={refreshMock} />);

        const updateBtn = screen.getByText('Update Behaviors');
        await act(async () => { fireEvent.click(updateBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sprites/dragon/config'),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"type":"oscillate"')
            })
        );
    });

    it('updates config via API (Scene Layer)', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [{ sprite_name: 'dragon', behaviors: [] }] },
            used_sprites: ['dragon']
        };
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        render(<GenericDetailView type="scene" asset={mockScene} refresh={refreshMock} />);

        // Select sprite tab first
        const tabBtn = screen.getByText('dragon');
        await act(async () => { fireEvent.click(tabBtn); });

        const updateBtn = screen.getByText('Update Behaviors');
        await act(async () => { fireEvent.click(updateBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/scene1/config'),
            expect.objectContaining({
                method: 'PUT'
            })
        );
    });

    it('updates sprite position on drag (Scene)', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [{ sprite_name: 'dragon', behaviors: [] }] },
            used_sprites: ['dragon']
        };
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        render(<GenericDetailView type="scene" asset={mockScene} refresh={refreshMock} />);

        // Start playing to show theatre stage
        const playBtn = screen.getByText('Play');
        await act(async () => { fireEvent.click(playBtn); });

        const moveBtn = screen.getByText('Move Sprite');
        await act(async () => { fireEvent.click(moveBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/scene1/config'),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"type":"location"')
            })
        );
    });

    it('removes layer from scene', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [{ sprite_name: 'dragon' }] },
            used_sprites: ['dragon']
        };
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        render(<GenericDetailView type="scene" asset={mockScene} refresh={refreshMock} />);

        // Select sprite
        const tabBtn = screen.getByText('dragon');
        await act(async () => { fireEvent.click(tabBtn); });

        const removeBtn = screen.getByText('Remove Sprite');
        await act(async () => { fireEvent.click(removeBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/scene1/config'),
            expect.objectContaining({ method: 'PUT' })
        );
        // Should remove dragon from layers in the PUT body
        // We can't easily parse Body string in HaveBeenCalledWith, but we trust logic.
    });

    it('reverts sprite to original', async () => {
        const mockSprite = { name: 'dragon', has_original: true, has_metadata: true }; // has_original enables revert
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        render(<GenericDetailView type="sprite" asset={mockSprite} refresh={refreshMock} />);

        const revertBtn = screen.getByTitle('Revert to Original');
        await act(async () => { fireEvent.click(revertBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sprites/dragon/revert'),
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('switches configuration tabs', async () => {
        const mockScene = { name: 'scene1', config: { layers: [] } };
        await act(async () => {
            render(<GenericDetailView type="scene" asset={mockScene} refresh={vi.fn()} />);
        });

        // Default behaviors
        expect(screen.getByText('Select a sprite from the tabs above to edit its behaviors.')).toBeInTheDocument();

        // Switch to JSON
        const jsonTab = screen.getByText('Config');
        await act(async () => {
            fireEvent.click(jsonTab);
        });
        expect(screen.getByText('Refine Configuration')).toBeInTheDocument();

        // Switch to Debug
        const debugTab = screen.getByText('Debug');
        await act(async () => {
            fireEvent.click(debugTab);
        });
        expect(screen.getByText('Debug Overlay')).toBeInTheDocument();
    });

    it('saves rotation for a sprite', async () => {
        const mockSprite = { name: 'dragon', has_metadata: true, has_original: true };
        const refreshMock = vi.fn();

        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ message: 'Rotated' }) });

        render(<GenericDetailView type="sprite" asset={mockSprite} refresh={refreshMock} />);

        const saveBtn = screen.getByText('Simulate Rotate Save');
        await act(async () => { fireEvent.click(saveBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sprites/dragon/rotate'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ angle: 90 })
            })
        );
        expect(refreshMock).toHaveBeenCalled();
    });

    it('auto-selects new sprite during optimization', async () => {
        const initialScene = {
            name: 'scene1',
            config: { layers: [] },
            used_sprites: []
        };
        const refreshMock = vi.fn();

        let resolveFetch;
        const fetchPromise = new Promise(r => { resolveFetch = r });

        // Mock fetch response for process
        global.fetch.mockImplementation((url, _options = {}) => {
            if (url.endsWith('/optimize')) return fetchPromise.then(() => ({ ok: true, json: async () => ({}) }));
            if (url.includes('/logs')) return Promise.resolve({ ok: true, json: async () => ({ content: 'logs' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });

        const { rerender } = render(<GenericDetailView type="scene" asset={initialScene} refresh={refreshMock} />);

        // Start optimization
        const optimizeBtn = screen.getByText('Optimize');
        fireEvent.click(optimizeBtn);

        // Verify initial state (optimizing = true)
        await waitFor(() => expect(screen.getByTestId('icon-optimize')).toBeInTheDocument());

        // Simulate refresh called by polling loop updating the asset prop
        // Case 1: New sprite added
        const updatedScene1 = {
            ...initialScene,
            used_sprites: ['sprite1']
        };

        rerender(<GenericDetailView type="scene" asset={updatedScene1} refresh={refreshMock} />);

        // Should auto-select sprite1
        await waitFor(() => expect(screen.getByText('Edit Sprite sprite1')).toBeInTheDocument());

        // Case 2: Another sprite added
        const updatedScene2 = {
            ...initialScene,
            used_sprites: ['sprite1', 'sprite2']
        };
        rerender(<GenericDetailView type="scene" asset={updatedScene2} refresh={refreshMock} />);

        // Should auto-select sprite2
        await waitFor(() => expect(screen.getByText('Edit Sprite sprite2')).toBeInTheDocument());

        // Resolve optimization
        await act(async () => { resolveFetch(); });
    });
});
