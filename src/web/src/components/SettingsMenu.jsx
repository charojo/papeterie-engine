import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

export const SettingsMenu = ({
    theme,
    onThemeChange,
    fontSize,
    onFontSizeChange,
    contrast,
    onContrastChange,
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
        <div ref={menuRef} style={{ position: 'relative' }}>
            <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px' }}
                onClick={() => setIsOpen(!isOpen)}
                title="Settings"
                aria-label="Settings"
            >
                <Icon name="settings" size={16} style={{ opacity: 0.7 }} />
            </button>

            {isOpen && (
                <div className="glass" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    minWidth: '220px',
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                    zIndex: 100,
                    overflow: 'hidden'
                }}>
                    {/* User info */}
                    {user && (
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.85rem'
                        }}>
                            Signed in as <strong style={{ color: 'var(--color-text-main)' }}>{user.user.username}</strong>
                            {user.type === 'local' && <span style={{ opacity: 0.6 }}> (Local)</span>}
                        </div>
                    )}

                    {/* Theme Section */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Theme
                        </div>
                        <select
                            value={theme}
                            onChange={(e) => onThemeChange(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: '0.9rem',
                                backgroundColor: 'var(--color-bg-elevated)',
                                color: 'var(--color-text-main)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            <option value="purple">Purple</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                            <option value="stark">Stark</option>
                        </select>
                    </div>

                    {/* Combined Contrast Slider */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Contrast
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', fontFamily: 'monospace' }}>
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
                            style={{
                                width: '100%',
                                cursor: 'pointer',
                                accentColor: 'var(--color-primary)'
                            }}
                        />
                    </div>

                    {/* Font Size Selector */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Text Size
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {['small', 'medium', 'large', 'xl'].map((size) => (
                                <button
                                    key={size}
                                    className={`btn ${fontSize === size ? 'btn-primary selected-ring' : ''}`}
                                    style={{
                                        flex: 1,
                                        padding: '4px',
                                        fontSize: size === 'small' ? '0.7rem' : size === 'large' ? '1rem' : size === 'xl' ? '1.1rem' : '0.85rem',
                                        height: '32px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        position: 'relative'
                                    }}
                                    onClick={() => onFontSizeChange(size)}
                                    title={size.charAt(0).toUpperCase() + size.slice(1)}
                                >
                                    A
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            onContrastChange(0.60);
                            onFontSizeChange('medium');
                        }}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--color-border)',
                            color: 'var(--color-primary)',
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
                    >
                        <Icon name="history" size={14} />
                        Reset Display Settings
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
