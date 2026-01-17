import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

export const SettingsMenu = ({
    theme,
    onThemeChange,
    fontSize,
    onFontSizeChange,
    contrast,
    onContrastChange,
    onResetAll,
    onLogout,
    onOpenDesignSystem,
    user
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={menuRef} className="relative">
            <Button
                variant="icon"
                onClick={() => setIsOpen(!isOpen)}
                title="Settings"
                aria-label="Settings"
                icon="settings"
            />

            {isOpen && (
                <div className="glass absolute top-full right-0 mt-2 min-w-220 bg-elevated border rounded-xl shadow-xl z-100 overflow-hidden">
                    {/* User info */}
                    {user && (
                        <div className="px-4 py-3 border-b text-muted text-xs">
                            Signed in as <strong className="text-main">{user.user.username}</strong>
                            {user.type === 'local' && <span className="opacity-60"> (Local)</span>}
                        </div>
                    )}

                    {/* Theme Section */}
                    <div className="px-4 py-3 border-b">
                        <div className="text-xxs text-muted mb-2 uppercase tracking-wide">
                            Theme
                        </div>
                        <select
                            value={theme}
                            onChange={(e) => onThemeChange(e.target.value)}
                            className="input w-full px-3 py-2 text-sm bg-elevated text-muted border rounded cursor-pointer outline-none"
                        >
                            <option value="teal">Teal</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                            <option value="stark">Stark</option>
                        </select>
                    </div>

                    {/* Combined Contrast Slider */}
                    <div className="px-4 py-3 border-b">
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-xxs text-muted uppercase tracking-wide">
                                Contrast
                            </div>
                            <div className="text-xxs text-muted font-mono">
                                {Math.round(contrast * 100)}%
                            </div>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(contrast * 100)}
                            onChange={(e) => {
                                onContrastChange(parseInt(e.target.value) / 100);
                            }}
                            className="w-full cursor-pointer accent-primary"
                        />
                    </div>

                    {/* Font Size Selector */}
                    <div className="px-4 py-3 border-b">
                        <div className="text-xxs text-muted mb-2 uppercase tracking-wide">
                            Text Size
                        </div>
                        <div className="flex gap-1">
                            {['small', 'medium', 'large', 'xl'].map((size) => (
                                <Button
                                    key={size}
                                    variant={fontSize === size ? 'primary' : 'secondary'}
                                    className={`flex-1 p-1 h-8 ${fontSize === size ? 'selected-ring' : ''} ${size === 'small' ? 'text-xs' : size === 'large' ? 'text-md' : size === 'xl' ? 'text-lg' : 'text-sm'}`}
                                    onClick={() => onFontSizeChange(size)}
                                    title={size.charAt(0).toUpperCase() + size.slice(1)}
                                >
                                    A
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        isBlock
                        className="py-3 px-4 border-b border-muted text-muted text-xs font-medium"
                        onClick={onResetAll}
                        title="Reset all display settings, panel sizes, and toolbar positions"
                        icon="history"
                    >
                        Reset All
                    </Button>

                    <Button
                        variant="ghost"
                        isBlock
                        className="py-3 px-4 border-b border-muted text-primary text-xs font-semibold"
                        onClick={() => {
                            onOpenDesignSystem();
                            setIsOpen(false);
                        }}
                        title="View visual components and design standards"
                        icon="app"
                    >
                        Design System
                    </Button>

                    {/* Logout */}
                    <Button
                        variant="ghost"
                        isBlock
                        className="py-3 px-4 text-muted text-sm font-normal"
                        onClick={() => {
                            onLogout();
                            setIsOpen(false);
                        }}
                        icon="chevronRight"
                    >
                        Sign out
                    </Button>
                </div>
            )}
        </div>
    );
}
