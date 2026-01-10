/**
 * Simple frontend logger to centralize console output and allow for future expansion (e.g., sending to server).
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// Default to INFO in all environments. Enable debug with: localStorage.setItem('papeterie_debug', '1')
const DEBUG_ENABLED = typeof localStorage !== 'undefined' && localStorage.getItem('papeterie_debug') === '1';
const CURRENT_LEVEL = DEBUG_ENABLED ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

class Logger {
    constructor(namespace) {
        this.namespace = namespace;
        this.color = this._getColorForNamespace(namespace);
    }

    _getColorForNamespace(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
            hash = namespace.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return "#" + "00000".substring(0, 6 - c.length) + c;
    }

    _print(level, message, ...args) {
        if (level < CURRENT_LEVEL) return;

        const timestamp = new Date().toLocaleTimeString();
        const tag = `%c[${this.namespace}]`;
        const style = `color: ${this.color}; font-weight: bold;`;

        switch (level) {
            case LOG_LEVELS.DEBUG:
                console.debug(`%c[${timestamp}] ${tag} ${message}`, style, ...args);
                break;
            case LOG_LEVELS.INFO:
                console.info(`%c[${timestamp}] ${tag} ${message}`, style, ...args);
                break;
            case LOG_LEVELS.WARN:
                console.warn(`%c[${timestamp}] ${tag} ${message}`, style, ...args);
                break;
            case LOG_LEVELS.ERROR:
                console.error(`%c[${timestamp}] ${tag} ${message}`, style, ...args);
                // Future: Dispatch event for UI Toast
                window.dispatchEvent(new CustomEvent('papeterie-error', {
                    detail: { source: this.namespace, message }
                }));
                break;
        }
    }

    debug(message, ...args) { this._print(LOG_LEVELS.DEBUG, message, ...args); }
    info(message, ...args) { this._print(LOG_LEVELS.INFO, message, ...args); }
    warn(message, ...args) { this._print(LOG_LEVELS.WARN, message, ...args); }
    error(message, ...args) { this._print(LOG_LEVELS.ERROR, message, ...args); }
}

export const createLogger = (namespace) => new Logger(namespace);
