import { API_BASE } from '../config';
import { toast } from 'sonner';

/**
 * Base class for Command pattern.
 */
export class BaseCommand {
    constructor(description) {
        this.description = description;
    }

    async execute() {
        throw new Error('Execute method not implemented');
    }

    async undo() {
        throw new Error('Undo method not implemented');
    }
}

/**
 * Command for updating scene or sprite configuration via the /config endpoint.
 */
export class UpdateConfigCommand extends BaseCommand {
    /**
     * @param {string} type - 'scene' or 'sprite'
     * @param {string} assetName - Name of the asset
     * @param {object} oldConfig - Snapshot of config before change
     * @param {object} newConfig - Snapshot of config after change
     * @param {Function} refresh - Callback to refresh data after change
     * @param {string} description - Human readable description for history
     */
    constructor(type, assetName, oldConfig, newConfig, refresh, description) {
        super(description || `Update ${type} configuration`);
        this.type = type;
        this.assetName = assetName;
        this.oldConfig = JSON.parse(JSON.stringify(oldConfig));
        this.newConfig = JSON.parse(JSON.stringify(newConfig));
        this.refresh = refresh;
    }

    async _applyConfig(config) {
        const endpoint = this.type === 'sprite' ? 'sprites' : 'scenes';
        const url = `${API_BASE}/${endpoint}/${encodeURIComponent(this.assetName)}/config`;

        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to apply config: ${errorText}`);
        }

        if (this.refresh) {
            await this.refresh();
        }
    }

    async execute() {
        await this._applyConfig(this.newConfig);
        if (this.description) {
            toast.success(this.description);
        }
    }

    async undo() {
        await this._applyConfig(this.oldConfig);
        toast.info(`Undone: ${this.description}`);
    }
}
