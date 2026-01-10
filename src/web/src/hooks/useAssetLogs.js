import { useState, useEffect } from 'react';
import { API_BASE } from '../config';

/**
 * Hook for fetching and polling asset logs.
 * 
 * Extracted from useAssetController as part of Phase 3 refactoring.
 * 
 * @param {string} type - 'sprite' or 'scene'
 * @param {string} assetName - Name of the asset
 * @param {boolean} isPolling - Whether to poll logs every second
 * @param {Function} onPollRefresh - Optional callback on each poll (e.g., to refresh scene data)
 * @returns {string} logs - Current log content
 */
export function useAssetLogs(type, assetName, isPolling = false, onPollRefresh = null) {
    const [logs, setLogs] = useState('');

    useEffect(() => {
        let interval;

        const fetchLogs = () => {
            const endpoint = type === 'sprite' ? `sprites` : `scenes`;
            fetch(`${API_BASE}/logs/${endpoint}/${assetName}`)
                .then(res => res.json())
                .then(data => {
                    const raw = data.content || "";
                    setLogs(raw);
                })
                .catch(() => { /* Silently ignore log fetch errors */ });
        };

        fetchLogs(); // Initial fetch

        if (isPolling) {
            interval = setInterval(() => {
                fetchLogs();
                // Callback for additional actions during polling
                if (onPollRefresh && type === 'scene') {
                    onPollRefresh();
                }
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [assetName, type, isPolling, onPollRefresh]);

    return logs;
}
