import React, { useState } from 'react';

import { Icon } from './Icon';

export function ExportDialog({ isOpen, onClose, sceneName, onExport }) {
    const [duration, setDuration] = useState(5.0);
    const [status, setStatus] = useState('idle'); // idle, exporting, success, error
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleExport = async () => {
        setStatus('exporting');
        setError(null);
        try {
            const result = await onExport({ duration });
            if (result && result.download_url) {
                setDownloadUrl(result.download_url);
                setStatus('success');
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (e) {
            console.error("Export failed:", e);
            setError(e.message || "Export failed");
            setStatus('error');
        }
    };

    const handleClose = () => {
        // Reset state on close
        if (status === 'success' || status === 'error') {
            setStatus('idle');
            setDownloadUrl(null);
            setError(null);
        }
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h3>Export Video</h3>
                    <button className="btn-icon" onClick={handleClose}>
                        <Icon name="close" size={16} />
                    </button>
                </div>

                <div className="modal-content">
                    {status === 'idle' && (
                        <>
                            <p className="text-muted" style={{ margin: 0, fontSize: '14px' }}>
                                Export <strong>{sceneName}</strong> as an MP4 video.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Duration (seconds)</label>
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(parseFloat(e.target.value))}
                                    min="1"
                                    max="60"
                                    step="0.5"
                                    className="input"
                                />
                            </div>
                            <div className="info-box">
                                <Icon name="info" size={14} />
                                <span>Resolution: 1280x720 (HD) @ 30fps</span>
                            </div>
                        </>
                    )}

                    {status === 'exporting' && (
                        <div className="status-container">
                            <div className="spinner"></div>
                            <p>Rendering video... please wait.</p>
                            <span className="text-muted text-sm">This may take a few seconds per second of video.</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="status-container text-success">
                            <Icon name="check" size={32} />
                            <p>Export Complete!</p>
                            <a href={downloadUrl} download className="btn-primary" target="_blank" rel="noreferrer">
                                Download Video
                            </a>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="status-container text-error">
                            <Icon name="warning" size={32} />
                            <p>Export Failed</p>
                            <span className="error-msg">{error}</span>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {status === 'idle' && (
                        <>
                            <button className="btn" onClick={handleClose}>Cancel</button>
                            <button className="btn-primary" onClick={handleExport}>
                                Start Export
                            </button>
                        </>
                    )}
                    {(status === 'success' || status === 'error') && (
                        <button className="btn-secondary" onClick={handleClose}>
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
