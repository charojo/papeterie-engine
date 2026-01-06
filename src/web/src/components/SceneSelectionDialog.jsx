import React, { useState } from 'react';
import { Icon } from './Icon';

export const SceneSelectionDialog = ({ scenes, onSelect, onCreate }) => {
    const [search, setSearch] = useState('');

    const filteredScenes = scenes.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Open a Scene</h2>
                <input
                    className="input"
                    placeholder="Search scenes..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '200px' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
                {/* Always show Create as the first item */}
                <div
                    className="card glass btn"
                    data-testid="create-scene-button"
                    onClick={onCreate}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 'auto',
                        gap: '8px',
                        border: '2px dashed var(--color-primary)',
                        opacity: 0.8
                    }}
                >
                    <Icon name="add" size={24} color="var(--color-primary)" />
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Create</span>
                </div>

                {filteredScenes.map(scene => (
                    <div
                        key={scene.name}
                        data-testid={`scene-item-${scene.name}`}
                        className="card glass btn"
                        onClick={() => onSelect(scene)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            height: 'auto',
                            gap: '8px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', width: '100%' }}>
                            <Icon name="scene" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={scene.name}>{scene.name}</span>
                        </div>
                        <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                            {scene.layers?.length || 0} Layers
                        </div>
                    </div>
                ))}
                {filteredScenes.length === 0 && <div style={{ opacity: 0.5 }}>No scenes found.</div>}
            </div>
        </div>
    );
};
