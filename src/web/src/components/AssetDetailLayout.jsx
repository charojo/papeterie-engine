import React, { useState, useRef, useEffect } from 'react';
import { StatusStepper } from './StatusStepper';
import { Icon } from './Icon';

export const AssetDetailLayout = ({
    title,
    statusLabel, // e.g. "Raw Scene"
    actions, // Header actions (buttons)
    visualContent, // React node for left column
    configContent, // React node for right column
    logs,
    _onRefreshLogs, // Callback to manually fetch logs (coming soon)
    isExpanded // Prop passed from parent
}) => {

    const [copyFeedback, setCopyFeedback] = useState(false);
    const logRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '16px',
            height: 'calc(100vh - 60px)', overflow: 'hidden'
        }}>
            {/* Header */}
            {!isExpanded && (
                <header style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingRight: '8px', flexShrink: 0, borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{title}</h1>
                        <StatusStepper currentStatus={statusLabel} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {actions}
                    </div>
                </header>
            )}

            {/* Main Content Split */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isExpanded ? '1fr' : '1fr 1fr',
                gap: '24px',
                flex: 1, overflow: 'hidden', minHeight: 0
            }}>
                {/* Visuals Column */}
                <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: isExpanded ? 0 : '12px' }}>
                    {!isExpanded && (
                        <h3 style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Icon name="image" size={14} /> Visuals
                        </h3>
                    )}
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

                {/* Config Column - Hidden if expanded */}
                {!isExpanded && (
                    <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '12px' }}>
                        <h3 style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Icon name="config" size={14} /> Configuration
                        </h3>
                        <div className="card glass" style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                            {configContent}
                        </div>
                    </section>
                )}
            </div>

            {/* Logs Panel - Hidden if expanded */}
            {!isExpanded && (
                <section className="card glass" style={{
                    height: '120px', padding: '12px', flexShrink: 0,
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.6, display: 'flex', gap: '4px' }}>
                            <Icon name="logs" size={12} /> SYSTEM LOGS
                        </span>
                        <button
                            className="btn"
                            style={{ padding: 0, lineHeight: 0, color: copyFeedback ? 'var(--color-primary)' : 'var(--color-text-muted)', background: 'transparent', border: 'none', fontSize: '0.75rem' }}
                            onClick={() => {
                                navigator.clipboard.writeText(logs || "");
                                setCopyFeedback(true);
                                setTimeout(() => setCopyFeedback(false), 2000);
                            }}
                        >
                            {copyFeedback ? "Copied!" : "Copy Log"}
                        </button>
                    </div>
                    <pre ref={logRef} style={{
                        flex: 1, margin: 0, fontSize: '0.75rem', overflowY: 'auto',
                        fontFamily: 'monospace', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap'
                    }}>
                        {logs || "Waiting for activity..."}
                    </pre>
                </section>
            )}
        </div>
    );
};
