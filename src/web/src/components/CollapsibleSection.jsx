import React, { useState } from 'react';
import { Icon } from './Icon';

export function CollapsibleSection({ title, children, defaultOpen = false, icon }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.8,
                    fontSize: '0.9em',
                    gap: '4px',
                    userSelect: 'none'
                }}
            >
                <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={16} />
                {title} {icon && <span style={{ opacity: 0.5, display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.85em', marginLeft: '4px' }}>(<Icon name={icon} size={12} />)</span>}
            </div>
            {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {children}
                </div>
            )}
        </div>
    )
}
