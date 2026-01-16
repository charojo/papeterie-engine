import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import './AssetDetailLayout.css';
import { useResizableRatio } from '../hooks/useResizable';

export const AssetDetailLayout = ({
    visualContent, // React node for left column
    configContent, // React node for right column
    logs,
    _onRefreshLogs, // Callback to manually fetch logs (coming soon)
    isExpanded, // Prop passed from parent
    resizableState, // Optional external control for resizing
    onResizeHandleDoubleClick // Callback for double-click on handle
}) => {

    const [copyFeedback, setCopyFeedback] = useState(false);
    const [isLogMinimized, setIsLogMinimized] = useState(true); // Start minimized
    const logRef = useRef(null);
    const containerRef = useRef(null);

    // Internal resizing logic (fallback if no external state provided)
    const internalResizable = useResizableRatio(
        'papeterie-panel-split',
        0.67, // Default 2:1 ratio (2fr:1fr = 0.67)
        { minRatio: 0.3, maxRatio: 0.85, direction: 'horizontal' }
    );

    // Use external state if provided, otherwise internal
    const { ratio, isResizing, startResize } = resizableState || internalResizable;

    // Auto-scroll logs when expanded
    useEffect(() => {
        if (logRef.current && !isLogMinimized) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs, isLogMinimized]);

    // Get last log line for minimized view
    const lastLogLine = logs ? logs.trim().split('\n').pop() : "Waiting for activity...";

    // Log panel resize
    const logContainerRef = useRef(null);
    const { ratio: logRatio, isResizing: isLogResizing, startResize: startLogResize } = useResizableRatio(
        'papeterie-log-panel-height',
        0.85, // Default 85% main content, 15% logs
        { minRatio: 0.5, maxRatio: 0.95, direction: 'vertical' }
    );

    return (
        <div
            ref={logContainerRef}
            className="asset-detail-layout"
        >
            {/* Main Content Split - resizable panels */}
            <div
                ref={containerRef}
                className="asset-detail-main"
                style={{
                    flex: isExpanded ? 1 : (isLogMinimized ? '1 1 auto' : `0 0 ${logRatio * 100}%`)
                }}
            >
                {/* Visuals Column - no card frame */}
                <section
                    className="asset-detail-visuals"
                    style={{
                        width: isExpanded ? '100%' : `${ratio * 100}%`
                    }}
                >
                    {visualContent}
                </section>

                {/* Resize Handle */}
                {!isExpanded && (
                    <div
                        className={`resize-handle resize-handle-h ${isResizing ? 'active' : ''}`}
                        onMouseDown={(e) => startResize(e, containerRef.current)}
                        onDoubleClick={onResizeHandleDoubleClick}
                        title="Drag to resize panels (Double-click to toggle)"
                    />
                )}

                {/* Config Column - Hidden if expanded, no card frame */}
                {!isExpanded && (
                    <section className="asset-detail-config">
                        {configContent}
                    </section>
                )}
            </div>

            {/* Log Resize Handle */}
            {!isExpanded && !isLogMinimized && (
                <div
                    className={`resize-handle resize-handle-v ${isLogResizing ? 'active' : ''}`}
                    onMouseDown={(e) => startLogResize(e, logContainerRef.current)}
                    title="Drag to resize log panel"
                />
            )}

            {/* Logs Panel - Resizable */}
            {!isExpanded && (
                <section
                    className="asset-detail-logs"
                    style={{
                        height: isLogMinimized ? '32px' : `${(1 - logRatio) * 100}%`,
                        minHeight: isLogMinimized ? '32px' : '60px',
                        padding: isLogMinimized ? '6px 12px' : '12px',
                        transition: isLogMinimized ? 'height 0.2s ease-in-out' : 'none'
                    }}
                >
                    <div
                        className="logs-header"
                        style={{ marginBottom: isLogMinimized ? 0 : '4px' }}
                    >
                        {isLogMinimized ? (
                            /* Minimized: show last log line */
                            <span className="logs-minimized-line">
                                {lastLogLine}
                            </span>
                        ) : (
                            <span className="logs-label">
                                <Icon name="logs" size={12} /> SYSTEM LOGS
                            </span>
                        )}
                        <div className="logs-actions">
                            <button
                                className="btn logs-btn-tool"
                                style={{
                                    color: copyFeedback ? 'var(--color-primary)' : 'var(--color-text-muted)'
                                }}
                                title="Copy logs to clipboard"
                                onClick={() => {
                                    navigator.clipboard.writeText(logs || "");
                                    setCopyFeedback(true);
                                    setTimeout(() => setCopyFeedback(false), 2000);
                                }}
                            >
                                {copyFeedback ? <Icon name="check" size={12} /> : <Icon name="copy" size={12} />}
                            </button>
                            <button
                                className="btn logs-btn-tool"
                                style={{
                                    color: 'var(--color-text-muted)'
                                }}
                                title={isLogMinimized ? "Expand logs" : "Minimize logs"}
                                onClick={() => setIsLogMinimized(!isLogMinimized)}
                            >
                                <Icon name={isLogMinimized ? "collapse" : "expand"} size={12} />
                            </button>
                        </div>
                    </div>
                    {!isLogMinimized && (
                        <pre ref={logRef} className="logs-pre">
                            {logs || "Waiting for activity..."}
                        </pre>
                    )}
                </section>
            )}
        </div>
    );
};
