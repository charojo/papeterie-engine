import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { useResizableRatio } from '../hooks/useResizable';

export const AssetDetailLayout = ({
    visualContent, // React node for left column
    configContent, // React node for right column
    logs,
    _onRefreshLogs, // Callback to manually fetch logs (coming soon)
    isExpanded // Prop passed from parent
}) => {

    const [copyFeedback, setCopyFeedback] = useState(false);
    const [isLogMinimized, setIsLogMinimized] = useState(true); // Start minimized
    const logRef = useRef(null);
    const containerRef = useRef(null);

    // Resizable panel ratio (left panel width as fraction of total)
    const { ratio, isResizing, startResize } = useResizableRatio(
        'papeterie-panel-split',
        0.67, // Default 2:1 ratio (2fr:1fr = 0.67)
        { minRatio: 0.3, maxRatio: 0.85, direction: 'horizontal' }
    );

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
            style={{
                display: 'flex', flexDirection: 'column',
                height: 'calc(100vh - 60px)', overflow: 'hidden'
            }}
        >
            {/* Main Content Split - resizable panels */}
            <div
                ref={containerRef}
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flex: isExpanded ? 1 : (isLogMinimized ? '1 1 auto' : `0 0 ${logRatio * 100}%`),
                    overflow: 'hidden',
                    minHeight: 0
                }}
            >
                {/* Visuals Column - no card frame */}
                <section style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    width: isExpanded ? '100%' : `${ratio * 100}%`,
                    flexShrink: 0,
                    background: 'var(--color-bg-base)'
                }}>
                    {visualContent}
                </section>

                {/* Resize Handle */}
                {!isExpanded && (
                    <div
                        className={`resize-handle resize-handle-h ${isResizing ? 'active' : ''}`}
                        onMouseDown={(e) => startResize(e, containerRef.current)}
                        title="Drag to resize panels"
                    />
                )}

                {/* Config Column - Hidden if expanded, no card frame */}
                {!isExpanded && (
                    <section style={{
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        flex: 1,
                        minWidth: 0,
                        background: 'var(--color-bg-surface)'
                    }}>
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
                <section style={{
                    height: isLogMinimized ? '32px' : `${(1 - logRatio) * 100}%`,
                    minHeight: isLogMinimized ? '32px' : '60px',
                    padding: isLogMinimized ? '6px 12px' : '12px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--color-bg-surface)',
                    borderTop: '1px solid var(--color-border)',
                    transition: isLogMinimized ? 'height 0.2s ease-in-out' : 'none'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: isLogMinimized ? 0 : '4px'
                    }}>
                        {isLogMinimized ? (
                            /* Minimized: show last log line */
                            <span style={{
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                                color: 'var(--color-text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                marginRight: '8px'
                            }}>
                                {lastLogLine}
                            </span>
                        ) : (
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                opacity: 0.6,
                                display: 'flex',
                                gap: '4px'
                            }}>
                                <Icon name="logs" size={12} /> SYSTEM LOGS
                            </span>
                        )}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button
                                className="btn"
                                style={{
                                    padding: '2px 4px',
                                    lineHeight: 1,
                                    color: copyFeedback ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '0.7rem'
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
                                className="btn"
                                style={{
                                    padding: '2px 4px',
                                    lineHeight: 1,
                                    color: 'var(--color-text-muted)',
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '0.7rem'
                                }}
                                title={isLogMinimized ? "Expand logs" : "Minimize logs"}
                                onClick={() => setIsLogMinimized(!isLogMinimized)}
                            >
                                <Icon name={isLogMinimized ? "collapse" : "expand"} size={12} />
                            </button>
                        </div>
                    </div>
                    {!isLogMinimized && (
                        <pre ref={logRef} style={{
                            flex: 1, margin: 0, fontSize: '0.75rem', overflowY: 'auto',
                            fontFamily: 'monospace', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap'
                        }}>
                            {logs || "Waiting for activity..."}
                        </pre>
                    )}
                </section>
            )}
        </div>
    );
};
