import React from 'react';
import { Icon } from './Icon';

export const TopBar = ({ title, leftContent, rightContent }) => {
    return (
        <header className="glass" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-elevated)',
            zIndex: 500,
            height: '40px',
            flexShrink: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="app" size={20} className="text-primary" />
                    {title || "Papeterie"}
                </h3>
                {leftContent}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {rightContent}
            </div>
        </header>
    );
};
