import React, { useState } from 'react';
import { Icon } from './Icon';
import { NewSpriteForm } from './NewSpriteForm';
import { ASSET_BASE } from '../config';

export const SpriteLibraryDialog = ({ sprites, onAdd, onClose, isOpen }) => {
    const [search, setSearch] = useState('');
    const [showUpload, setShowUpload] = useState(false);

    if (!isOpen) return null;

    const filteredSprites = sprites.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-overlay backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="card glass w-4-5 max-w-800 max-h-4-5 flex flex-col p-0"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="m-0">{showUpload ? 'Upload New Sprite' : 'Add Sprite to Scene'}</h3>
                    <div className="flex gap-3 items-center">
                        {!showUpload && (
                            <>
                                <div className="relative flex items-center">
                                    <input
                                        className={`input ${search ? 'pr-7' : ''}`}
                                        placeholder="Search..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        autoFocus
                                    />
                                    {search && (
                                        <button
                                            className="btn-icon absolute right-1 p-1 bg-transparent"
                                            onClick={() => setSearch('')}
                                            title="Clear search"
                                        >
                                            <Icon name="close" size={14} />
                                        </button>
                                    )}
                                </div>
                                <button className="btn btn-primary py-xs px-3" onClick={() => setShowUpload(true)}>
                                    <Icon name="add" size={14} /> New
                                </button>
                            </>
                        )}
                        <button className="btn-icon" onClick={onClose}><Icon name="close" size={20} /></button>
                    </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1 min-h-0">
                    {showUpload ? (
                        <NewSpriteForm
                            onSuccess={(data) => {
                                setShowUpload(false);
                                onAdd(data);
                            }}
                            onCancel={() => setShowUpload(false)}
                        />
                    ) : (
                        <div className="grid grid-cols-auto-120 gap-3">
                            {filteredSprites.map(sprite => (
                                <div
                                    key={sprite.name}
                                    className="btn flex-col gap-1 h-180 justify-end border-muted relative overflow-hidden p-2"
                                    onClick={() => {
                                        onAdd(sprite);
                                    }}
                                >
                                    {/* Sprite thumbnail as background */}
                                    <img
                                        src={`${ASSET_BASE}${sprite.image_url}`}
                                        alt={sprite.name}
                                        className="absolute top-2 left-1-2 tx-center max-w-4-5 max-h-70 object-contain opacity-90"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <span className="text-sm text-center break-words w-full bg-surface py-xs rounded-xs z-1">
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
