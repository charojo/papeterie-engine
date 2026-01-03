import React, { useState } from 'react';

const DELETE_MODES = {
    scene: [
        {
            id: 'reset',
            label: 'Reset Scene',
            description: 'Deletes configuration and generated sprites. Keeps original image.',
            danger: false,
            icon: '⚡',
            dangerLevel: 1
        },
        {
            id: 'delete_scene',
            label: 'Delete Scene Only',
            description: 'Removes the scene folder. Keeps all created sprites.',
            danger: true,
            icon: '⚠️',
            dangerLevel: 2
        },
        {
            id: 'delete_all',
            label: 'Delete Scene & Sprites',
            description: 'Removes the scene and all its sprites (unless used elsewhere).',
            danger: true,
            icon: '☢️',
            dangerLevel: 3
        }
    ],
    sprite: [
        {
            id: 'reset',
            label: 'Reset Sprite',
            description: 'Deletes optimized versions and metadata. Keeps original image.',
            danger: false,
            icon: '⚡',
            dangerLevel: 1
        },
        {
            id: 'delete',
            label: 'Delete Completely',
            description: 'Permanently removes the sprite and all its files.',
            danger: true,
            icon: '☢️',
            dangerLevel: 3
        }
    ]
};

export function DeleteConfirmationDialog({ isOpen, onClose, onConfirm, type, assetName }) {
    const modes = DELETE_MODES[type] || [];
    const [selectedMode, setSelectedMode] = useState(modes[0]?.id);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(selectedMode);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'var(--color-bg-surface)', padding: '24px', borderRadius: '8px',
                width: '400px', maxWidth: '90%', border: '1px solid var(--color-border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }}>
                <h3 style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>Delete {type === 'scene' ? 'Scene' : 'Sprite'}?</h3>
                <p style={{ color: 'var(--color-text-muted)' }}>Choose how to handle <strong style={{ color: 'var(--color-text-main)' }}>{assetName}</strong>:</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
                    {modes.map(mode => {
                        const intensity = mode.dangerLevel * 0.33;
                        const isSelected = selectedMode === mode.id;

                        return (
                            <label key={mode.id} style={{
                                display: 'flex', gap: '12px', padding: '12px',
                                border: isSelected ? '1px solid var(--color-border)' : '1px solid var(--color-border-muted)',
                                borderRadius: '8px', cursor: 'pointer',
                                backgroundColor: isSelected
                                    ? 'var(--color-bg-elevated)'
                                    : 'transparent',
                                transition: 'all 0.2s ease'
                            }}>
                                <input
                                    type="radio"
                                    name="deleteMode"
                                    value={mode.id}
                                    checked={isSelected}
                                    onChange={() => setSelectedMode(mode.id)}
                                    style={{ display: 'none' }}
                                />
                                <span style={{
                                    fontSize: '1.3rem',
                                    display: 'flex', alignItems: 'center',
                                    opacity: 0.4 + (intensity * 0.3)
                                }}>{mode.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: 500,
                                        color: 'var(--color-text-main)'
                                    }}>{mode.label}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                        {mode.description}
                                    </div>
                                </div>
                                {isSelected && (
                                    <span style={{ color: 'var(--color-text-subtle)', fontSize: '1rem' }}>●</span>
                                )}
                            </label>
                        );
                    })}
                </div>

                {type === 'scene' && selectedMode === 'delete_all' && (
                    <div style={{
                        padding: '10px', backgroundColor: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)', borderRadius: '6px',
                        marginBottom: '20px', fontSize: '0.85rem', color: 'var(--color-text-muted)'
                    }}>
                        Note: Sprites shared with other scenes will be preserved.
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        style={{
                            backgroundColor: 'var(--color-danger)',
                            color: 'white',
                            borderColor: 'var(--color-danger)',
                            padding: '10px 24px',
                            fontWeight: '600'
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

