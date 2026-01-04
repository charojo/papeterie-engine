import { render, fireEvent } from '@testing-library/react';
import { SpriteListEditor } from '../SpriteListEditor';
import { vi, describe, it, expect } from 'vitest';

// Mock Icon component
vi.mock('../Icon', () => ({
    Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

// Mock BehaviorEditor
vi.mock('../BehaviorEditor', () => ({
    BehaviorEditor: ({ behaviors }) => <div data-testid="behavior-editor">{behaviors.length} behaviors</div>
}));

describe('SpriteListEditor', () => {
    const mockAsset = {
        name: 'test_scene',
        config: {
            layers: [
                { sprite_name: 'boat', z_depth: 10, behaviors: [{}, {}] },
                { sprite_name: 'bird', z_depth: 20, behaviors: [{}] }
            ]
        }
    };

    const mockProps = {
        type: 'scene',
        asset: mockAsset,
        selectedSprite: 'boat',
        onSpriteSelected: vi.fn(),
        layerVisibility: { 'boat': true, 'bird': false },
        onToggleVisibility: vi.fn(),
        onRemoveLayer: vi.fn(),
        onBehaviorsChange: vi.fn(),
        onAddSprite: vi.fn()
    };

    it('renders all sprites in z-depth order', () => {
        const { getAllByText } = render(<SpriteListEditor {...mockProps} />);

        const names = getAllByText(/boat|bird/);
        // Sorted by z_depth desc: bird (20), boat (10)
        expect(names[0].textContent).toBe('20bird');
        expect(names[1].textContent).toBe('10boat');
    });

    it('expands selected sprite by default', () => {
        const { getByTestId } = render(<SpriteListEditor {...mockProps} />);

        // 'boat' is selected, so its behavior editor should be visible
        const editor = getByTestId('behavior-editor');
        expect(editor.textContent).toBe('2 behaviors');
    });

    it('toggles expansion on click', () => {
        const { getByText, getAllByTestId } = render(<SpriteListEditor {...mockProps} />);

        const birdName = getByText('bird');
        fireEvent.click(birdName);

        // Now bird should be expanded
        const editors = getAllByTestId('behavior-editor');
        expect(editors.length).toBe(2); // boat (autofill from isSelected) + bird
    });

    it('calls onToggleVisibility when eye icon is clicked', () => {
        const { getByTestId } = render(<SpriteListEditor {...mockProps} />);

        const birdVisibilityBtn = getByTestId('icon-hidden').closest('button');
        fireEvent.click(birdVisibilityBtn);

        expect(mockProps.onToggleVisibility).toHaveBeenCalledWith('bird');
    });

    it('renders single sprite for sprite type', () => {
        const spriteAsset = {
            name: 'solo_bird',
            metadata: { behaviors: [{}, {}, {}] }
        };
        const { getByText, getByTestId } = render(
            <SpriteListEditor
                {...mockProps}
                type="sprite"
                asset={spriteAsset}
                selectedSprite="solo_bird"
                layerVisibility={{ 'solo_bird': true }}
            />
        );

        expect(getByText('solo_bird')).toBeInTheDocument();
        expect(getByTestId('behavior-editor').textContent).toBe('3 behaviors');
    });
});
