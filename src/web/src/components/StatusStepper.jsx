import React from 'react';
import './StatusStepper.css';

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
        <div className="status-stepper-container">
            {STEPS.map((step, index) => {
                const isActive = index <= activeIndex;
                const isCurrent = index === activeIndex;

                return (
                    <React.Fragment key={step.id}>
                        {/* Step Circle */}
                        <div className={`status-step ${isActive ? 'active' : 'inactive'}`}>
                            <div className={`status-step-circle ${isActive ? 'active' : ''}`} />
                            <span className={isCurrent ? 'current' : ''}>{step.label}</span>
                        </div>

                        {/* Divider */}
                        {index < STEPS.length - 1 && (
                            <div className={`status-step-divider ${isActive ? 'active' : 'inactive'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
