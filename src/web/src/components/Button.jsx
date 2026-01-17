import React from 'react';
import { Icon } from './Icon';

/**
 * Button Component - Unified interactive element for the Papeterie project.
 * 
 * @param {string} variant - primary, ghost, danger, icon
 * @param {string} size - standard, sm, xs
 * @param {boolean} isBlock - Apply full-width block styling
 * @param {boolean} isTab - Apply tab-specific styling
 * @param {boolean} loading - Display a loading spinner
 * @param {string} icon - Optional icon name
 * @param {string} iconVariant - tight, roomy (passed to Icon)
 * @param {React.ReactNode} children - Button label/content
 * @param {string} className - Optional additional classes
 * @param {boolean} active - Active state for tabs/icons
 */
export const Button = ({
    variant = 'secondary',
    size = 'standard',
    isBlock = false,
    isTab = false,
    loading = false,
    icon = null,
    iconVariant = 'tight',
    children,
    className = '',
    active = false,
    disabled = false,
    onClick,
    title,
    ...props
}) => {
    const baseClass = variant === 'icon' ? 'btn-icon' : 'btn';
    const variantClass = variant && variant !== 'secondary' && variant !== 'icon' ? `btn-${variant}` : '';
    const sizeClass = size && size !== 'standard' ? `btn-${size}` : '';
    const blockClass = isBlock ? 'btn-block' : '';
    const tabClass = isTab ? 'btn-tab' : '';
    const activeClass = active ? 'active' : '';

    const fullClassName = `${baseClass} ${variantClass} ${sizeClass} ${blockClass} ${tabClass} ${activeClass} ${className}`.trim();

    return (
        <button
            className={fullClassName}
            onClick={onClick}
            disabled={disabled || loading}
            title={title}
            {...props}
        >
            {loading ? (
                <Icon name="generate" className="animate-spin" variant={iconVariant} />
            ) : icon ? (
                <Icon name={icon} variant={iconVariant} />
            ) : null}
            {children && (
                <span className={variant === 'icon' && !children ? 'sr-only' : ''}>
                    {children}
                </span>
            )}
        </button>
    );
};
