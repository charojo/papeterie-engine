import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

export const SettingsMenu = ({
    theme,
    onThemeChange,
    fontSize,
    onFontSizeChange,
    contrast,
    onContrastChange,
    onResetAll,
    onLogout,
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
            <button
                className="btn-icon"
                onClick={() => setIsOpen(!isOpen)}
                title="Settings"
                aria-label="Settings"
            >
                <Icon name="settings" size={16} />
            </button>

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
                                <button
                                    key={size}
                                    className={`btn flex-1 p-1 h-8 flex items-center justify-center relative ${fontSize === size ? 'btn-primary selected-ring' : ''} ${size === 'small' ? 'text-xs' : size === 'large' ? 'text-md' : size === 'xl' ? 'text-lg' : 'text-sm'}`}
                                    onClick={() => onFontSizeChange(size)}
                                    title={size.charAt(0).toUpperCase() + size.slice(1)}
                                >
                                    A
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={onResetAll}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '500'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Reset all display settings, panel sizes, and toolbar positions"
                    >
                        <Icon name="history" size={14} />
                        Reset All
                    </button>

                    {/* Logout */}
                    <button
                        onClick={() => {
                            onLogout();
                            setIsOpen(false);
                        }}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <Icon name="chevronRight" size={14} />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
