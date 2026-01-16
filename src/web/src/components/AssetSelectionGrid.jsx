import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import './AssetSelectionGrid.css';

/**
 * AssetSelectionGrid - Unified grid for selecting scenes or sprites
 * 
 * @param {string} title - Header title
 * @param {Array} items - Array of items to display
 * @param {function} onSelect - Callback when item is selected
 * @param {function} onCreate - Callback for "Create New" action
 * @param {function} onCancel - Optional callback for Cancel (also binds Escape key)
 * @param {string} searchPlaceholder - Placeholder for search input
 * @param {string} createLabel - Label for create button (e.g., "Create", "Upload New")
 * @param {string} itemIcon - Icon name for items
 * @param {function} renderThumbnail - Function to render thumbnail: (item) => React.Node
 * @param {function} getItemName - Function to get item name: (item) => string
 * @param {function} getItemSubtitle - Function to get subtitle: (item) => string
 */
export const AssetSelectionGrid = ({
    title,
    items = [],
    onSelect,
    onCreate,
    onCancel,
    searchPlaceholder = 'Search...',
    createLabel = 'Create',
    itemIcon = 'scene',
    renderThumbnail,
    getItemName = (item) => item?.name || 'Unnamed',
    getItemSubtitle = () => null
}) => {
    const [search, setSearch] = useState('');

    // Escape key handler
    useEffect(() => {
        if (!onCancel) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);

    const filteredItems = (items || []).filter(item => {
        if (!item) return false;
        const name = getItemName(item) || '';
        return name.toLowerCase().includes((search || '').toLowerCase());
    });

    return (
        <div className="asset-selection-grid-container">
            <div className="asset-selection-grid-header">
                <h2>{title}</h2>
                <div className="asset-selection-grid-controls">
                    <input
                        className="input asset-selection-grid-search"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {onCancel && (
                        <button className="btn" onClick={onCancel}>
                            <Icon name="close" size={16} /> Cancel
                        </button>
                    )}
                </div>
            </div>

            <div className="asset-selection-grid">
                {/* Always show Create as the first item */}
                <div
                    className="card glass btn create-item-card"
                    data-testid="create-item-button"
                    onClick={onCreate}
                >
                    <Icon name="add" size={24} color="var(--color-primary)" />
                    <span className="create-item-label">{createLabel}</span>
                </div>

                {filteredItems.map(item => (
                    <div
                        key={getItemName(item)}
                        data-testid={`item-${getItemName(item)}`}
                        className="card glass btn asset-item-card"
                        onClick={() => onSelect(item)}
                    >
                        {/* Thumbnail area */}
                        {renderThumbnail && (
                            <div className="asset-item-thumbnail-wrapper">
                                {renderThumbnail(item)}
                            </div>
                        )}

                        {/* Name row */}
                        <div className="asset-item-name-row">
                            <Icon name={itemIcon} />
                            <span className="asset-item-name-text" title={getItemName(item)}>
                                {getItemName(item)}
                            </span>
                        </div>

                        {/* Subtitle */}
                        {getItemSubtitle(item) && (
                            <div className="asset-item-subtitle">
                                {getItemSubtitle(item)}
                            </div>
                        )}
                    </div>
                ))}

                {filteredItems.length === 0 && (
                    <div className="asset-selection-grid-empty">No items found.</div>
                )}
            </div>
        </div>
    );
};
