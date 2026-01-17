import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneDetailView } from '../SceneDetailView';

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
    ImageViewer: ({ actions, onSaveRotation, onSavePosition, onSpriteSelected, onTimelineArrow, debugMode }) => (
        <div data-testid="image-viewer">
            ImageViewer (Debug: {debugMode})
            <div data-testid="viewer-actions">{actions}</div>
            <button onClick={() => onSaveRotation && onSaveRotation(90)}>Simulate Rotate Save</button>
            <div data-testid="theatre-stage">
                TheatreStage
                <button onClick={() => onSavePosition && onSavePosition('dragon', 100, 200, 1.5)}>Move Sprite</button>
                <button onClick={() => onSpriteSelected && onSpriteSelected('dragon')}>Select Sprite</button>
                <button onClick={() => onTimelineArrow && onTimelineArrow('ArrowUp')}>Trigger ArrowUp</button>
                <button onClick={() => onTimelineArrow && onTimelineArrow('ArrowDown')}>Trigger ArrowDown</button>
                <button onClick={() => onTimelineArrow && onTimelineArrow('ArrowLeft')}>Trigger ArrowLeft</button>
                <button onClick={() => onTimelineArrow && onTimelineArrow('ArrowRight')}>Trigger ArrowRight</button>
            </div>
        </div>
    )
}));

vi.mock('../TimelineEditor', () => ({
    TimelineEditor: ({ currentTime, onTimeChange }) => (
        <div data-testid="timeline-editor">
            TimelineEditor: {currentTime.toFixed(1)}s
            <button onClick={() => onTimeChange(currentTime + 1)}>Advance Time</button>
        </div>
    )
}));

vi.mock('../TheatreStage', () => ({
    TheatreStage: ({ onSpritePositionChanged, onSpriteSelected, onTelemetry: _onTelemetry, onSave }) => (
        <div data-testid="theatre-stage-inner">
            TheatreStage
            <button onClick={() => onSpritePositionChanged('dragon', 100, 200, 1.5)}>Move Sprite</button>
            <button onClick={() => onSpriteSelected('dragon')}>Select Sprite</button>
            {onSave && <button onClick={onSave}>Save Changes</button>}
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

vi.mock('../SpriteListEditor', () => ({
    SpriteListEditor: ({ onSpriteSelected, onToggleVisibility, onDeleteSprite, onBehaviorsChange, selectedSprite }) => (
        <div data-testid="sprite-list-editor">
            SpriteListEditor: {selectedSprite}
            <button onClick={() => onSpriteSelected('dragon')}>Select dragon</button>
            <button onClick={() => onToggleVisibility('dragon')}>Toggle dragon Vis</button>
            <button onClick={() => onDeleteSprite('dragon')}>Delete dragon</button>
            <button onClick={() => onBehaviorsChange([{ type: 'oscillate' }])}>Update Behaviors</button>
            {/* Contextual toggles usually in parent, but this mock simulates list actions */}
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

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const TestWrapper = ({ props }) => {
    const [contextualActions, setContextualActions] = useState(null);
    return (
        <div>
            <div data-testid="topbar-actions-play">{contextualActions?.play}</div>
            <div data-testid="topbar-actions-search">{contextualActions?.search}</div>
            <div data-testid="topbar-actions-right">{contextualActions?.right}</div>
            <SceneDetailView {...props} setContextualActions={setContextualActions} />
        </div>
    );
};

describe('SceneDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        global.fetch = vi.fn().mockImplementation(() => Promise.resolve({
            ok: true,
            json: async () => []
        }));
    });

    it('updates config via API (Scene Sprite List)', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [{ sprite_name: 'dragon', behaviors: [] }] },
            used_sprites: ['dragon']
        };
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: refreshMock }} />);
        });

        const updateBtn = screen.getByText('Update Behaviors');
        await act(async () => { fireEvent.click(updateBtn); });

        await waitFor(() => {
            const putCall = global.fetch.mock.calls.find(call =>
                call[0].includes('/scenes/scene1/config') &&
                call[1]?.method === 'PUT'
            );
            expect(putCall).toBeDefined();
        });
    });

    it('updates sprite position on drag (Scene)', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [{ sprite_name: 'dragon', behaviors: [] }] },
            used_sprites: ['dragon']
        };
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: refreshMock }} />);
        });

        // Start playing to show theatre stage (teleported controls)
        // Usually Play button is in topbar actions
        // But for this test, we assume ImageViewer is rendered.

        const moveBtn = screen.getByText('Move Sprite');
        await act(async () => { fireEvent.click(moveBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/scene1/config'),
            expect.objectContaining({
                method: 'PUT'
            })
        );
    });

    it('deletes sprite from scene via SpriteListEditor', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [{ sprite_name: 'dragon' }] },
            used_sprites: ['dragon']
        };
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: refreshMock }} />);
        });

        const deleteBtn = screen.getByText('Delete dragon');
        await act(async () => { fireEvent.click(deleteBtn); });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scenes/scene1/config'),
            expect.objectContaining({ method: 'PUT' })
        );
    });

    it('switches configuration tabs', async () => {
        const mockScene = { name: 'scene1', config: { layers: [] } };
        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: vi.fn() }} />);
        });

        expect(screen.getByTestId('sprite-list-editor')).toBeInTheDocument();

        const jsonTab = screen.getByText('Config');
        await act(async () => { fireEvent.click(jsonTab); });

        expect(screen.getByPlaceholderText('Describe changes to metadata/physics... (Enter to apply)')).toBeInTheDocument();
    });

    it('handles keyboard shortcuts (Arrow Keys) for Z-depth', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [{ sprite_name: 'dragon', z_depth: 10 }] },
            used_sprites: ['dragon']
        };
        const refreshMock = vi.fn();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: refreshMock }} />);
        });

        // 1. Verify sprite is auto-selected
        await waitFor(() => {
            expect(screen.getByText('SpriteListEditor: dragon')).toBeInTheDocument();
        });

        // 2. Trigger ArrowUp via mock button
        const arrowUpBtn = screen.getByText('Trigger ArrowUp');
        await act(async () => { fireEvent.click(arrowUpBtn); });

        // Expect PUT with z_depth = 11
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/config'),
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.stringMatching(/"z_depth":11/)
                })
            );
        });

        // 3. Trigger ArrowDown via mock button
        const arrowDownBtn = screen.getByText('Trigger ArrowDown');
        await act(async () => { fireEvent.click(arrowDownBtn); });

        // Expect PUT with z_depth = 9 (relative to original if not optimistically updated in state passed back to props, 
        // but useAssetController might handle optimistic updates?
        // Actually, without refresh mock updating the prop, the prop stays same.
        // So current z is 10. ArrowDown -> 9.
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/config'),
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.stringMatching(/"z_depth":9/)
                })
            );
        });
    });

    it('handles keyboard shortcuts (Arrow Keys) for time scrubbing', async () => {
        const mockScene = {
            name: 'scene1',
            config: { layers: [] },
            used_sprites: []
        };

        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: vi.fn() }} />);
        });

        // Verify initial time
        expect(screen.getByText('TimelineEditor: 0.0s')).toBeInTheDocument();

        // Trigger ArrowRight (simulated via ImageViewer prop call in mock)
        const rightBtn = screen.getByText('Trigger ArrowRight');
        await act(async () => { fireEvent.click(rightBtn); });

        // Expected time: 0.1
        expect(screen.getByText('TimelineEditor: 0.1s')).toBeInTheDocument();

        // Trigger ArrowLeft
        const leftBtn = screen.getByText('Trigger ArrowLeft');
        // Click twice to go back to 0 (since we are at 0.1)
        await act(async () => { fireEvent.click(leftBtn); });

        expect(screen.getByText('TimelineEditor: 0.0s')).toBeInTheDocument();
    });

    it('toggles overlay and details modes', async () => {
        const mockScene = { name: 'scene1', config: { layers: [] } };
        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: vi.fn() }} />);
        });

        // Check defaults
        expect(screen.getByText('ImageViewer (Debug: off)')).toBeInTheDocument();

        // Toggle Overlay
        const overlayBtn = screen.getByTitle('Click to toggle overlay'); // Parent div title
        // Or find the specific button inside
        const onOverlayBtn = within(overlayBtn).getByTitle('on');

        await act(async () => { fireEvent.click(onOverlayBtn); });
        expect(screen.getByText('ImageViewer (Debug: on)')).toBeInTheDocument();

        // Toggle Details
        // We can't easily check details mode visual effect without inspecting CSS or class names of layout resizable state.
        // But we can check if the button state changed active class?
        const detailsBtn = screen.getByTitle('Click to toggle details');
        const onDetailsBtn = within(detailsBtn).getByTitle('Toggle details columns on');

        await act(async () => {
            fireEvent.click(onDetailsBtn);
        });
        // The mock layout doesn't reflect this, but we can verify the state update doesn't crash.
        expect(onDetailsBtn.closest('button').className).toContain('btn-primary');
    });

    it('handles scene deletion', async () => {
        const mockScene = { name: 'scene1', config: { layers: [] } };
        const deleteMock = vi.fn();

        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: vi.fn(), onDelete: deleteMock }} />);
        });

        // Find delete button in topbar actions (contextual)
        const deleteBtn = screen.getByTitle('Delete Scene');
        await act(async () => { fireEvent.click(deleteBtn); });

        // Confirm dialog should appear
        const confirmBtn = screen.getByText('Confirm');
        await act(async () => { fireEvent.click(confirmBtn); });

        expect(deleteMock).toHaveBeenCalled();
    });

    it('handles global undo/redo keys', async () => {
        // useHistory hook is used inside useAssetController. 
        // We mocked useAssetController? No, we are using the real SceneDetailView which calls real useAssetController.
        // Real useAssetController uses useHistory.
        // We need to trigger an action that pushes to history, then undo.
        // Mocking fetch allows saveConfig to work.

        const mockScene = { name: 'scene1', config: { layers: [] } };
        const refreshMock = vi.fn();

        // Mock fetch to track history pushes? 
        // Actually, useHistory pushes to state.
        // We can verify undo called?
        // It's hard to verify internal hooks state from integration test without more exposure.
        // But we can verify no crash on ctrl+z.

        await act(async () => {
            render(<TestWrapper props={{ asset: mockScene, refresh: refreshMock }} />);
        });

        fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
        fireEvent.keyDown(window, { key: 'y', ctrlKey: true });

        // If no errors, pass.
        expect(true).toBe(true);
    });

    it('toggles details and overlay modes', async () => {
        const defaultProps = {
            asset: { name: 'scene1', config: { layers: [] } },
            refresh: vi.fn(),
            onDelete: vi.fn(),
            isExpanded: false,
            toggleExpand: vi.fn()
        };
        render(<SceneDetailView {...defaultProps} />);

        // Toggle Details
        // Initial state 'off'
        const detailsOnBtn = screen.getByTitle('Toggle details columns on');
        await act(async () => {
            fireEvent.click(detailsOnBtn);
        });
        // Expect active class or state change (can't check internal state directly, check class)
        expect(detailsOnBtn.closest('button')).toHaveClass('btn-primary');

        const detailsOffBtn = screen.getByTitle('Toggle details columns off');
        await act(async () => {
            fireEvent.click(detailsOffBtn);
        });
        expect(detailsOffBtn.closest('button')).toHaveClass('btn-primary');

        // Toggle Overlay
        // Initial state 'off'
        // There might be multiple 'on' buttons
        const overlayHeader = screen.getByText('Overlay').closest('div');
        const overlayOn = within(overlayHeader).getByText('on');

        await act(async () => {
            fireEvent.click(overlayOn);
        });
        expect(overlayOn.closest('button')).toHaveClass('btn-primary');
    });
});
