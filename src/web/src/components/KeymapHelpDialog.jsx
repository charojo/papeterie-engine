import React, { useEffect } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

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
                    <Button variant="icon" onClick={onClose} icon="close" />
                </div>
                <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-subtle uppercase tracking-wide px-2">Selection</h4>
                        <table className="w-full text-sm border-separate border-spacing-y-1">
                            <tbody>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm whitespace-nowrap">Click</kbd>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Select Sprite</td>
                                </tr>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <div className="flex items-center gap-1">
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Shift</kbd>
                                            <span className="text-subtle">+</span>
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Click</kbd>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Multi-Select / Toggle</td>
                                </tr>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Escape</kbd>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Clear Selection / Close</td>
                                </tr>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <div className="flex items-center gap-1">
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Ctrl</kbd>
                                            <span className="text-subtle">+</span>
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Z</kbd>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Undo Action</td>
                                </tr>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <div className="flex items-center gap-1">
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Ctrl</kbd>
                                            <span className="text-subtle">+</span>
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Y</kbd>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Redo Action</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-subtle uppercase tracking-wide px-2">Movement & Scale</h4>
                        <table className="w-full text-sm border-separate border-spacing-y-1">
                            <tbody>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Arrows</kbd>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Move Selected</td>
                                </tr>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <div className="flex items-center gap-1">
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Shift</kbd>
                                            <span className="text-subtle">+</span>
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Arrows</kbd>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Fast Move</td>
                                </tr>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <div className="flex items-center gap-1">
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">+</kbd>
                                            <span className="text-subtle">/</span>
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">-</kbd>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Scale Selection / Zoom</td>
                                </tr>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <div className="flex items-center gap-1">
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Shift</kbd>
                                            <span className="text-subtle">+</span>
                                            <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">+/-</kbd>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Fast Scale</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-subtle uppercase tracking-wide px-2">Playback</h4>
                        <table className="w-full text-sm border-separate border-spacing-y-1">
                            <tbody>
                                <tr className="group">
                                    <td className="w-32 px-2 py-1 align-middle">
                                        <kbd className="text-main font-mono bg-bg-base px-1.5 py-0.5 rounded border border-muted shadow-sm">Space</kbd>
                                    </td>
                                    <td className="px-2 py-1 text-muted align-middle group-hover:text-main transition-colors">Play / Pause Scene</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="text-[10px] text-subtle italic px-2 opacity-60">* Space toggles scene playback globally (except in text inputs).</p>
                    </div>
                </div>
                <div className="px-4 py-3 border-t border-muted bg-bg-base flex justify-end">
                    <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
}
