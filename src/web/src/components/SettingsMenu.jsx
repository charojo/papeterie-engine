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

    // Close menu when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
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
                <div className="glass absolute top-full right-0 mt-2 min-w-280 bg-elevated border rounded-xl shadow-xl z-1000 overflow-hidden py-1">
                    {/* User info with signout */}
                    {user && (
                        <div className="px-6 py-4 border-b text-muted text-xs flex justify-between items-center">
                            <span>
                                Signed in as <strong className="text-main">{user.user.username}</strong>
                                {user.type === 'local' && <span className="opacity-60"> (Local)</span>}
                            </span>
                            <button
                                className="text-muted text-xs underline hover:text-main focus:outline-none cursor-pointer bg-transparent border-none"
                                onClick={() => {
                                    onLogout();
                                    setIsOpen(false);
                                }}
                            >
                                signout
                            </button>
                        </div>
                    )}

                    {/* Theme Section */}
                    <div className="px-6 py-4 border-b">
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
                    <div className="px-6 py-4 border-b">
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
                    <div className="px-6 py-4 border-b">
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
                        className="py-4 px-6 border-b border-muted text-muted text-xs font-medium"
                        onClick={onResetAll}
                        title="Reset all display settings, panel sizes, and toolbar positions"
                        icon="revert"
                    >
                        Reset display options
                    </Button>

                    <Button
                        variant="ghost"
                        isBlock
                        className="py-4 px-6 text-primary text-xs font-semibold"
                        onClick={() => {
                            onOpenDesignSystem();
                            setIsOpen(false);
                        }}
                        title="View visual components and design standards"
                        icon="app"
                    >
                        Design System
                    </Button>
                </div>
            )}
        </div>
    );
}
