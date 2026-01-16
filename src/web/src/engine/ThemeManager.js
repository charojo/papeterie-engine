/**
 * ThemeManager provides a centralized way for the engine to access 
 * design tokens defined in CSS.
 */

const FALLBACKS = {
    bgBase: "#1a1a1a",
    bgSurfaceGlass: "rgba(0, 0, 0, 0.7)",
    bgElevated: "#334155",
    textMain: "#f8fafc",
    textMuted: "rgba(255, 255, 255, 0.5)",
    textOnPrimary: "#ffffff",
    primary: "#6b8aae",
    selectionAccent: "#00ffff",
    selectionGlow: "rgba(0, 255, 255, 0.4)",
    danger: "#ef4444",
    skyBase: "rgb(200, 230, 255)"
};

export class ThemeManager {
    static getStyle() {
        if (typeof window === 'undefined' || !window.getComputedStyle || !document.documentElement) {
            return null;
        }
        return window.getComputedStyle(document.documentElement);
    }

    static getColor(variableName, fallbackKey) {
        const style = this.getStyle();
        const fallback = FALLBACKS[fallbackKey] || "#000000";
        if (!style) return fallback;
        const value = style.getPropertyValue(variableName)?.trim();
        return value || fallback;
    }

    /**
     * Common theme properties for quick access
     */
    static get theme() {
        return {
            bgBase: this.getColor('--color-bg-base', 'bgBase'),
            bgElevated: this.getColor('--color-bg-elevated', 'bgElevated'),
            bgSurfaceGlass: this.getColor('--color-bg-surface-glass', 'bgSurfaceGlass'),
            textMain: this.getColor('--color-text-main', 'textMain'),
            textMuted: this.getColor('--color-text-muted', 'textMuted'),
            textOnPrimary: this.getColor('--color-text-on-primary', 'textOnPrimary'),
            primary: this.getColor('--color-primary', 'primary'),
            selectionAccent: this.getColor('--color-selection-accent', 'selectionAccent'),
            selectionGlow: this.getColor('--color-selection-glow', 'selectionGlow'),
            danger: this.getColor('--color-danger', 'danger'),
            skyBase: this.getColor('--color-sky-base', 'skyBase')
        };
    }
}
