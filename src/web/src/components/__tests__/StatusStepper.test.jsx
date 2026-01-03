import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusStepper } from '../StatusStepper';

describe('StatusStepper', () => {
    it('renders all steps', () => {
        const { container: _container } = render(<StatusStepper currentStatus="Raw Scene" />);

        expect(screen.getByText('Import')).toBeInTheDocument();
        expect(screen.getByText('Optimize')).toBeInTheDocument();
        expect(screen.getByText('Configure')).toBeInTheDocument();
        expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('highlights Import step for Raw Scene status', () => {
        const { container: _container } = render(<StatusStepper currentStatus="Raw Scene" />);

        const importStep = screen.getByText('Import').parentElement;
        expect(importStep).toHaveStyle({ color: 'var(--color-primary)' });
    });

    it('highlights Import step for Raw Sprite status', () => {
        const { container: _container } = render(<StatusStepper currentStatus="Raw Sprite" />);

        const importStep = screen.getByText('Import').parentElement;
        expect(importStep).toHaveStyle({ color: 'var(--color-primary)' });
    });

    it('highlights Optimize step for Optimizing status', () => {
        const { container: _container } = render(<StatusStepper currentStatus="Optimizing" />);

        const optimizeStep = screen.getByText('Optimize').parentElement;
        expect(optimizeStep).toHaveStyle({ color: 'var(--color-primary)' });
    });

    it('highlights Ready step for Configured status', () => {
        const { container: _container } = render(<StatusStepper currentStatus="Configured" />);

        const readyStep = screen.getByText('Ready').parentElement;
        expect(readyStep).toHaveStyle({ color: 'var(--color-primary)' });
    });

    it('makes current step bold', () => {
        const { container: _container } = render(<StatusStepper currentStatus="Optimizing" />);

        const optimizeLabel = screen.getByText('Optimize');
        expect(optimizeLabel).toHaveStyle({ fontWeight: '600' });
    });

    it('renders dividers between steps', () => {
        const { container } = render(<StatusStepper currentStatus="Raw Scene" />);

        // Should have 3 dividers (between 4 steps)
        const dividers = container.querySelectorAll('div[style*="width: 20px"]');
        expect(dividers.length).toBe(3);
    });

    it('activates all steps up to current status', () => {
        const { container: _container } = render(<StatusStepper currentStatus="Configured" />);

        // All steps should be active (colored) for Configured status
        const importStep = screen.getByText('Import').parentElement;
        const optimizeStep = screen.getByText('Optimize').parentElement;
        const configureStep = screen.getByText('Configure').parentElement;
        const readyStep = screen.getByText('Ready').parentElement;

        expect(importStep).toHaveStyle({ color: 'var(--color-primary)' });
        expect(optimizeStep).toHaveStyle({ color: 'var(--color-primary)' });
        expect(configureStep).toHaveStyle({ color: 'var(--color-primary)' });
        expect(readyStep).toHaveStyle({ color: 'var(--color-primary)' });
    });
});
