import React from 'react';

// Steps: Import -> Optimize -> Configure -> Ready
const STEPS = [
    { id: 'raw', label: 'Import' },
    { id: 'optimizing', label: 'Optimize' },
    { id: 'configuring', label: 'Configure' },
    { id: 'ready', label: 'Ready' }
];

export const StatusStepper = ({ currentStatus }) => {
    // Map current status to step index
    // statuses: "Raw Scene", "Configured", "Optimizing"

    let activeIndex = 0;
    if (currentStatus === 'Optimizing') activeIndex = 1;
    else if (currentStatus === 'Configured') activeIndex = 3;
    else if (currentStatus === 'Raw Scene' || currentStatus === 'Raw Sprite') activeIndex = 0;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', opacity: 0.9 }}>
            {STEPS.map((step, index) => {
                const isActive = index <= activeIndex;
                const isCurrent = index === activeIndex;

                return (
                    <React.Fragment key={step.id}>
                        {/* Step Circle */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '2px',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)'
                        }}>
                            <div style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: isActive ? 'var(--color-primary)' : 'transparent',
                                border: '1px solid currentColor'
                            }} />
                            <span style={{ fontWeight: isCurrent ? '600' : '400' }}>{step.label}</span>
                        </div>

                        {/* Divider */}
                        {index < STEPS.length - 1 && (
                            <div style={{
                                width: '8px', height: '1px',
                                background: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                                opacity: 0.5
                            }} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
