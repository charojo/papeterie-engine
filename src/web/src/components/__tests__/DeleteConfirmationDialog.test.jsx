import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmationDialog } from '../DeleteConfirmationDialog';

describe('DeleteConfirmationDialog', () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <DeleteConfirmationDialog
                isOpen={false}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="scene"
                assetName="test-scene"
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders dialog when isOpen is true', () => {
        render(
            <DeleteConfirmationDialog
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="scene"
                assetName="my-scene"
            />
        );
        expect(screen.getByText(/Delete Scene\?/i)).toBeInTheDocument();
        expect(screen.getByText('my-scene')).toBeInTheDocument();
    });

    it('displays scene-specific delete modes for type="scene"', () => {
        render(
            <DeleteConfirmationDialog
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="scene"
                assetName="test-scene"
            />
        );
        expect(screen.getByText('Reset Scene')).toBeInTheDocument();
        expect(screen.getByText('Delete Scene Only')).toBeInTheDocument();
        expect(screen.getByText('Delete Scene & Sprites')).toBeInTheDocument();
    });

    it('displays sprite-specific delete modes for type="sprite"', () => {
        render(
            <DeleteConfirmationDialog
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="sprite"
                assetName="test-sprite"
            />
        );
        expect(screen.getByText(/Delete Sprite\?/i)).toBeInTheDocument();
        expect(screen.getByText('Reset Sprite')).toBeInTheDocument();
        expect(screen.getByText('Delete Completely')).toBeInTheDocument();
    });

    it('calls onClose when Cancel button is clicked', () => {
        render(
            <DeleteConfirmationDialog
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="scene"
                assetName="test-scene"
            />
        );
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm with selected mode and onClose when Confirm is clicked', () => {
        render(
            <DeleteConfirmationDialog
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="scene"
                assetName="test-scene"
            />
        );
        // Default selection is 'reset'
        fireEvent.click(screen.getByText('Confirm'));
        expect(mockOnConfirm).toHaveBeenCalledWith('reset');
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('allows changing delete mode selection', () => {
        render(
            <DeleteConfirmationDialog
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="scene"
                assetName="test-scene"
            />
        );

        // Click on "Delete Scene & Sprites" option
        fireEvent.click(screen.getByText('Delete Scene & Sprites'));
        fireEvent.click(screen.getByText('Confirm'));

        expect(mockOnConfirm).toHaveBeenCalledWith('delete_all');
    });

    it('shows warning note when delete_all is selected for scenes', () => {
        render(
            <DeleteConfirmationDialog
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                type="scene"
                assetName="test-scene"
            />
        );

        // Initially no warning
        expect(screen.queryByText(/Sprites shared with other scenes/i)).not.toBeInTheDocument();

        // Select delete_all
        fireEvent.click(screen.getByText('Delete Scene & Sprites'));

        // Warning should appear
        expect(screen.getByText(/Sprites shared with other scenes will be preserved/i)).toBeInTheDocument();
    });
});
