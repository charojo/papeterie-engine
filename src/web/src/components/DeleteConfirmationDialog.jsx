import React, { useState } from 'react';
import './DeleteConfirmationDialog.css';

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
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h3>Delete {type === 'scene' ? 'Scene' : 'Sprite'}?</h3>
                </div>

                <div className="modal-content">
                    <p className="text-muted" style={{ margin: 0 }}>
                        Choose how to handle <strong style={{ color: 'var(--color-text-main)' }}>{assetName}</strong>:
                    </p>

                    <div className="delete-modes-container">
                        {modes.map(mode => {
                            const intensity = mode.dangerLevel * 0.33;
                            const isSelected = selectedMode === mode.id;

                            return (
                                <label
                                    key={mode.id}
                                    className={`delete-mode-item ${isSelected ? 'selected' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="deleteMode"
                                        value={mode.id}
                                        checked={isSelected}
                                        onChange={() => setSelectedMode(mode.id)}
                                        className="hidden-radio"
                                        style={{ display: 'none' }}
                                    />
                                    <span
                                        className="delete-mode-icon"
                                        style={{ opacity: isSelected ? 1 : (0.4 + (intensity * 0.3)) }}
                                    >
                                        {mode.icon}
                                    </span>
                                    <div className="delete-mode-details">
                                        <div className="delete-mode-label">{mode.label}</div>
                                        <div className="delete-mode-description">
                                            {mode.description}
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <span style={{ color: 'var(--color-text-subtle)', fontSize: '1rem' }}></span>
                                    )}
                                </label>
                            );
                        })}
                    </div>

                    {type === 'scene' && selectedMode === 'delete_all' && (
                        <div className="delete-dialog-note">
                            Note: Sprites shared with other scenes will be preserved.
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleConfirm}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

