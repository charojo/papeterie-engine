import React, { useState } from 'react';

const DELETE_MODES = {
    scene: [
        {
            id: 'delete_scene',
            label: 'Delete Scene Only',
            description: 'Removes the scene folder. Keeps all created sprites.',
            danger: true
        },
        {
            id: 'delete_all',
            label: 'Delete Scene & Sprites',
            description: 'Removes the scene and all its sprites (unless used elsewhere).',
            danger: true
        },
        {
            id: 'reset',
            label: 'Reset Scene',
            description: 'Deletes configuration and generated sprites. Keeps original image.',
            danger: false
        }
    ],
    sprite: [
        {
            id: 'reset',
            label: 'Reset Sprite',
            description: 'Deletes optimized versions and metadata. Keeps original image.',
            danger: false
        },
        {
            id: 'delete',
            label: 'Delete Completely',
            description: 'Permanently removes the sprite and all its files.',
            danger: true
        }
    ]
};

export function DeleteConfirmationDialog({ isOpen, onClose, onConfirm, type, assetName }) {
    if (!isOpen) return null;

    const modes = DELETE_MODES[type] || [];
    const [selectedMode, setSelectedMode] = useState(modes[modes.length - 1]?.id);

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
                backgroundColor: '#1e1e1e', padding: '24px', borderRadius: '8px',
                width: '400px', maxWidth: '90%', border: '1px solid #333',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }}>
                <h3 style={{ marginTop: 0, color: '#ef4444' }}>Delete {type === 'scene' ? 'Scene' : 'Sprite'}?</h3>
                <p>You are about to modify <strong>{assetName}</strong>.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
                    {modes.map(mode => (
                        <label key={mode.id} style={{
                            display: 'flex', gap: '10px', padding: '10px',
                            border: selectedMode === mode.id ? '1px solid #646cff' : '1px solid #333',
                            borderRadius: '6px', cursor: 'pointer',
                            backgroundColor: selectedMode === mode.id ? 'rgba(100,108,255,0.1)' : 'transparent'
                        }}>
                            <input
                                type="radio"
                                name="deleteMode"
                                value={mode.id}
                                checked={selectedMode === mode.id}
                                onChange={() => setSelectedMode(mode.id)}
                            />
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{mode.label}</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{mode.description}</div>
                            </div>
                        </label>
                    ))}
                </div>

                {type === 'scene' && selectedMode === 'delete_all' && (
                    <div style={{
                        padding: '10px', backgroundColor: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.5)', borderRadius: '6px',
                        marginBottom: '20px', fontSize: '0.85rem', color: '#fbbf24'
                    }}>
                        <strong>Warning:</strong> Sprites shared with other scenes will be preserved.
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button
                        className="btn"
                        onClick={handleConfirm}
                        style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            borderColor: '#adc6ff' // Using a contrasting border just in case
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
