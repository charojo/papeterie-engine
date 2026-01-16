import { createLogger } from '../utils/logger.js';

const log = createLogger('BehaviorFactory');

/**
 * Contextual data passed to behaviors during execution.
 * Encapsulates frame-specific and environmental state.
 */
export class BehaviorContext {
    constructor({ layer, dt, elapsedTime, screenW, screenH }) {
        this.layer = layer;
        this.dt = dt;
        this.elapsedTime = elapsedTime;
        this.screenW = screenW;
        this.screenH = screenH;
    }
}

/**
 * Registry for behavior runtimes.
 * Maps behavior types to their implementation classes.
 */
class BehaviorFactory {
    constructor() {
        this.registry = new Map();
    }

    /**
     * Register a behavior implementation.
     * @param {string} type - Behavior type (e.g., 'oscillate')
     * @param {class} RuntimeClass - Implementation class
     */
    register(type, RuntimeClass) {
        this.registry.set(type, RuntimeClass);
        log.debug(`Registered behavior: ${type}`);
    }

    /**
     * Create a runtime instance for a given behavior config.
     * @param {Object} config - Behavior configuration
     * @returns {Object|null} Behavior runtime instance or null if type not registered
     */
    create(config) {
        const RuntimeClass = this.registry.get(config.type);
        if (RuntimeClass) {
            return new RuntimeClass(config);
        }
        log.warn(`Unknown behavior type: ${config.type}`);
        return null;
    }
}

// Global singleton instance
export const behaviorFactory = new BehaviorFactory();
