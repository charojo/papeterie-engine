import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
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

    // Auto-scroll logs when expanded
    useEffect(() => {
        if (logRef.current && !isLogMinimized) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs, isLogMinimized]);

    // Get last log line for minimized view
    const lastLogLine = logs ? logs.trim().split('\n').pop() : "Waiting for activity...";

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '16px',
            height: 'calc(100vh - 60px)', overflow: 'hidden'
        }}>
            {/* Main Content Split - 2fr visual, 1fr config for more image space */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isExpanded ? '1fr' : '2fr 1fr',
                gap: '24px',
                flex: 1, overflow: 'hidden', minHeight: 0
            }}>
                {/* Visuals Column - no heading label */}
                <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div className="card glass" style={{
                        flex: 1,
                        padding: isExpanded ? 0 : '16px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        {visualContent}
                    </div>
                </section>

                {/* Config Column - Hidden if expanded, no heading label */}
                {!isExpanded && (
                    <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="card glass" style={{ flex: 1, padding: '16px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {configContent}
                        </div>
                    </section>
                )}
            </div>

            {/* Logs Panel - Collapsible, starts minimized */}
            {!isExpanded && (
                <section className="card glass" style={{
                    height: isLogMinimized ? '32px' : '120px',
                    padding: isLogMinimized ? '6px 12px' : '12px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'height 0.2s ease-in-out'
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
