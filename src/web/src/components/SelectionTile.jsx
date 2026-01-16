import React from 'react';
import { Icon } from './Icon';

export function SelectionTile({ icon, title, selected, onClick, 'data-testid': testId }) {
    return (
        <div className={`card glass selection-tile ${selected ? 'selected' : ''}`}
            onClick={onClick}
            data-testid={testId}
        >
            <Icon name={icon} size={48} />
            <h3>{title}</h3>
        </div>
    )
}
