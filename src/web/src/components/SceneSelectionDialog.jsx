import React from 'react';
import { AssetSelectionGrid } from './AssetSelectionGrid';
import { Icon } from './Icon';
import { ASSET_BASE } from '../config';

export const SceneSelectionDialog = ({ scenes, onSelect, onCreate, onCancel }) => {
    return (
        <AssetSelectionGrid
            title="Open a Scene"
            items={scenes}
            onSelect={onSelect}
            onCreate={onCreate}
            onCancel={onCancel}
            searchPlaceholder="Search scenes..."
            createLabel="Create"
            itemIcon="scene"
            getItemName={(scene) => scene.name}
            getItemSubtitle={(scene) => `${scene.config?.layers?.length || 0} Layers`}
            renderThumbnail={(scene) => {
                // 1. Try background image from config
                const backgroundUrl = scene.config?.background_image;
                if (backgroundUrl) {
                    return (
                        <img
                            src={`${ASSET_BASE}${backgroundUrl}`}
                            alt=""
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    );
                }
                // 2. Fallback: Try to use the first sprite as a thumbnail
                const firstSprite = scene.used_sprites?.[0];
                if (firstSprite) {
                    return (
                        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-base)' }}>
                            <img
                                src={`${ASSET_BASE}/assets/users/${scene.creator || 'default'}/sprites/${firstSprite}/${firstSprite}.png`}
                                alt=""
                                style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }}
                            />
                            <div style={{ position: 'absolute', bottom: 4, right: 4 }}>
                                <Icon name="scene" variant="tight" opacity={0.5} />
                            </div>
                        </div>
                    );
                }
                return <Icon name="scene" variant="roomy" opacity={0.2} />;
            }}
        />
    );
};
