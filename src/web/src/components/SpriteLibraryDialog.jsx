import React, { useState } from 'react';
import { Icon } from './Icon';
import { NewSpriteForm } from './NewSpriteForm';

const ASSET_BASE = "http://localhost:8000";

export const SpriteLibraryDialog = ({ sprites, onAdd, onClose, isOpen }) => {
    const [search, setSearch] = useState('');
    const [showUpload, setShowUpload] = useState(false);

    if (!isOpen) return null;

    const filteredSprites = sprites.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)'
        }}
            onClick={onClose}
        >
            <div
                className="card glass"
                style={{ width: '80%', maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>{showUpload ? 'Upload New Sprite' : 'Add Sprite to Scene'}</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {!showUpload && (
                            <>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        className="input"
                                        placeholder="Search..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        autoFocus
                                        style={{ paddingRight: search ? '28px' : undefined }}
                                    />
                                    {search && (
                                        <button
                                            className="btn-icon"
                                            onClick={() => setSearch('')}
                                            style={{
                                                position: 'absolute',
                                                right: '4px',
                                                padding: '4px',
                                                background: 'transparent'
                                            }}
                                            title="Clear search"
                                        >
                                            <Icon name="close" size={14} />
                                        </button>
                                    )}
                                </div>
                                <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ padding: '6px 12px' }}>
                                    <Icon name="add" size={14} /> New
                                </button>
                            </>
                        )}
                        <button className="btn-icon" onClick={onClose}><Icon name="close" size={20} /></button>
                    </div>
                </div>

                <div style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                    {showUpload ? (
                        <NewSpriteForm
                            onSuccess={(data) => {
                                setShowUpload(false);
                                onAdd(data);
                            }}
                            onCancel={() => setShowUpload(false)}
                        />
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                            {filteredSprites.map(sprite => (
                                <div
                                    key={sprite.name}
                                    className="btn"
                                    style={{
                                        flexDirection: 'column',
                                        gap: '4px',
                                        height: '120px',
                                        justifyContent: 'flex-end',
                                        border: '1px solid var(--color-border)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        padding: '8px'
                                    }}
                                    onClick={() => {
                                        onAdd(sprite);
                                    }}
                                >
                                    {/* Sprite thumbnail as background */}
                                    <img
                                        src={`${ASSET_BASE}${sprite.image_url}`}
                                        alt={sprite.name}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            maxWidth: '80%',
                                            maxHeight: '70px',
                                            objectFit: 'contain',
                                            opacity: 0.9
                                        }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <span style={{
                                        fontSize: '0.8rem',
                                        textAlign: 'center',
                                        wordBreak: 'break-word',
                                        width: '100%',
                                        background: 'rgba(0,0,0,0.5)',
                                        padding: '2px 4px',
                                        borderRadius: '2px',
                                        zIndex: 1
                                    }}>
                                        {sprite.name}
                                    </span>
                                </div>
                            ))}
                            {filteredSprites.length === 0 && <div style={{ opacity: 0.5, padding: '20px', gridColumn: '1 / -1', textAlign: 'center' }}>No sprites match "{search}"</div>}
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
};
