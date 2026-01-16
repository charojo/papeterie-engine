import React, { useState } from 'react';
import { AssetSelectionGrid } from './AssetSelectionGrid';
import { NewSpriteForm } from './NewSpriteForm';
import { Icon } from './Icon';
import { ASSET_BASE } from '../config';

/**
 * SpriteSelectionDialog - NOT a fixed dialog, renders inline like SceneSelectionDialog
 */
export const SpriteSelectionDialog = ({ sprites, onAdd, onClose }) => {
    const [showUpload, setShowUpload] = useState(false);

    // Upload form view
    if (showUpload) {
        return (
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2>Upload New Sprite</h2>
                    <button className="btn" onClick={() => setShowUpload(false)}>
                        <Icon name="back" size={16} /> Back
                    </button>
                </div>
                <div className="card glass" style={{ padding: '24px', maxWidth: '600px' }}>
                    <NewSpriteForm
                        onSuccess={(data) => {
                            setShowUpload(false);
                            onAdd(data);
                        }}
                        onCancel={() => setShowUpload(false)}
                    />
                </div>
            </div>
        );
    }

    // Main grid view - exactly like SceneSelectionDialog
    return (
        <AssetSelectionGrid
            title="Add Sprite to Scene"
            items={sprites}
            onSelect={onAdd}
            onCreate={() => setShowUpload(true)}
            onCancel={onClose}
            searchPlaceholder="Search sprites..."
            createLabel="Upload New"
            itemIcon="sprites"
            getItemName={(sprite) => sprite.name}
            getItemSubtitle={() => 'Sprite'}
            renderThumbnail={(sprite) => (
                <img
                    src={`${ASSET_BASE}${sprite.image_url}`}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            )}
        />
    );
};
