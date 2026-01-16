import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExportDialog } from '../ExportDialog';

describe('ExportDialog', () => {
    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <ExportDialog isOpen={false} onClose={() => { }} sceneName="test-scene" onExport={() => { }} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders dialog when isOpen is true', () => {
        render(
            <ExportDialog isOpen={true} onClose={() => { }} sceneName="test-scene" onExport={() => { }} />
        );
        expect(screen.getByText('Export Video')).toBeInTheDocument();
        expect(screen.getByText('test-scene')).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
        const handleClose = vi.fn();
        render(
            <ExportDialog isOpen={true} onClose={handleClose} sceneName="test-scene" onExport={() => { }} />
        );
        fireEvent.click(screen.getByText('Cancel'));
        expect(handleClose).toHaveBeenCalled();
    });
});
