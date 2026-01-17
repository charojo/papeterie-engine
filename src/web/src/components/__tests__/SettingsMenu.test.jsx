import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsMenu } from '../SettingsMenu';

describe('SettingsMenu', () => {
    const defaultProps = {
        theme: 'teal',
        onThemeChange: vi.fn(),
        fontSize: 'medium',
        onFontSizeChange: vi.fn(),
        contrast: 0.6,
        onContrastChange: vi.fn(),
        onResetAll: vi.fn(),
        onLogout: vi.fn(),
        user: { user: { username: 'testuser' }, type: 'local' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders settings button', () => {
        render(<SettingsMenu {...defaultProps} />);
        expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument();
    });

    it('menu is closed by default', () => {
        render(<SettingsMenu {...defaultProps} />);
        expect(screen.queryByText('Theme')).not.toBeInTheDocument();
    });

    it('opens menu when button is clicked', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
        expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    it('displays user info when menu is open', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.getByText(/Local/i)).toBeInTheDocument();
    });

    it('calls onThemeChange when theme is changed', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

        const themeSelect = screen.getByRole('combobox');
        fireEvent.change(themeSelect, { target: { value: 'dark' } });

        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('dark');
    });

    it('displays all theme options', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

        expect(screen.getByRole('option', { name: 'Teal' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Dark' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Light' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Stark' })).toBeInTheDocument();
    });

    it('calls onContrastChange when contrast slider is changed', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '80' } });

        expect(defaultProps.onContrastChange).toHaveBeenCalledWith(0.8);
    });

    it('displays current contrast value as percentage', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
        expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('renders font size buttons', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

        // There should be 4 "A" buttons for font sizes
        const aButtons = screen.getAllByRole('button', { name: 'A' });
        expect(aButtons).toHaveLength(4);
    });

    it('calls onFontSizeChange when font size button is clicked', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

        // Click on "Large" button (third one, 0-indexed)
        const aButtons = screen.getAllByRole('button', { name: 'A' });
        fireEvent.click(aButtons[2]); // 'large' is index 2

        expect(defaultProps.onFontSizeChange).toHaveBeenCalledWith('large');
    });

    it('Reset All calls onResetAll', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

        fireEvent.click(screen.getByText('Reset display options'));

        expect(defaultProps.onResetAll).toHaveBeenCalled();
    });

    it('calls onLogout and closes menu when Sign out is clicked', () => {
        render(<SettingsMenu {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

        fireEvent.click(screen.getByText('signout'));

        expect(defaultProps.onLogout).toHaveBeenCalled();
        // Menu should be closed
        expect(screen.queryByText('Theme')).not.toBeInTheDocument();
    });

    it('closes menu when clicking outside', () => {
        render(
            <div>
                <div data-testid="outside">Outside</div>
                <SettingsMenu {...defaultProps} />
            </div>
        );

        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
        expect(screen.getByText('Theme')).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByTestId('outside'));
        expect(screen.queryByText('Theme')).not.toBeInTheDocument();
    });
});
