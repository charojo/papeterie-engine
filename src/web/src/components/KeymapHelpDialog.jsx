import React, { useEffect } from 'react';
import { Icon } from './Icon';

export function KeymapHelpDialog({ isOpen, onClose }) {
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-surface border border-muted rounded-lg shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-muted bg-surface-hover">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-main">Keyboard Shortcuts</h3>
                    <button onClick={onClose} className="btn-icon">
                        <Icon name="close" size={16} />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-subtle uppercase tracking-wide">Selection</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                            <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted w-fit">Click</span>
                            <span className="text-muted">Select Sprite</span>

                            <div className="flex gap-1 w-fit">
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Shift</span>
                                <span className="text-subtle">+</span>
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Click</span>
                            </div>
                            <span className="text-muted">Multi-Select / Toggle</span>

                            <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted w-fit">Escape</span>
                            <span className="text-muted">Clear Selection / Close Dialog</span>

                            <div className="flex gap-1 w-fit">
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Ctrl</span>
                                <span className="text-subtle">+</span>
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Z</span>
                            </div>
                            <span className="text-muted">Undo Action</span>

                            <div className="flex gap-1 w-fit">
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Ctrl</span>
                                <span className="text-subtle">+</span>
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Y</span>
                            </div>
                            <span className="text-muted">Redo Action</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-subtle uppercase tracking-wide">Movement & Scale</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                            <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted w-fit">Arrow Keys</span>
                            <span className="text-muted">Move Selected</span>

                            <div className="flex gap-1 w-fit">
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Shift</span>
                                <span className="text-subtle">+</span>
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Arrows</span>
                            </div>
                            <span className="text-muted">Fast Move</span>

                            <div className="flex gap-1 w-fit">
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">+</span>
                                <span className="text-subtle">/</span>
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">-</span>
                            </div>
                            <span className="text-muted">Scale Selected / Zoom Scene (if none selected)</span>

                            <div className="flex gap-1 w-fit">
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">Shift</span>
                                <span className="text-subtle">+</span>
                                <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted">+/-</span>
                            </div>
                            <span className="text-muted">Fast Scale</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-subtle uppercase tracking-wide">Playback</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                            <span className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted w-fit">Space</span>
                            <span className="text-muted">Play / Pause Scene</span>
                        </div>
                        <p className="text-xs text-subtle italic pt-1">* Space toggles scene playback globally (except in text inputs).</p>
                    </div>
                </div>
                <div className="px-4 py-3 border-t border-muted bg-bg-base flex justify-end">
                    <button className="btn btn-secondary text-xs" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}
