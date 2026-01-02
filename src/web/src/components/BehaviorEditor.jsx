import React, { useState } from 'react';
import { Icon } from './Icon';

const BehaviorTypes = {
    OSCILLATE: "oscillate",
    DRIFT: "drift",
    PULSE: "pulse",
    BACKGROUND: "background",
    LOCATION: "location"
};

const CoordinateTypes = ["y", "x", "scale", "rotation", "opacity"];

export function BehaviorEditor({ behaviors = [], onChange, readOnly = false, spriteName, isVisible, onToggleVisibility, onRemoveSprite }) {
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = (type) => {
        const newBehavior = createDefaultBehavior(type);
        onChange([...behaviors, newBehavior]);
        setIsAdding(false);
    };

    const handleUpdate = (index, updatedBehavior) => {
        const newBehaviors = [...behaviors];
        newBehaviors[index] = updatedBehavior;
        onChange(newBehaviors);
    };

    const handleRemove = (index) => {
        const newBehaviors = behaviors.filter((_, i) => i !== index);
        onChange(newBehaviors);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                        {spriteName ? `Editing: ${spriteName}` : 'Active Behaviors'}
                    </h3>
                    {onToggleVisibility && (
                        <button
                            className="btn-icon"
                            onClick={onToggleVisibility}
                            title={isVisible ? "Hide Sprite" : "Show Sprite"}
                            style={{ opacity: isVisible ? 1 : 0.5 }}
                        >
                            <Icon name={isVisible ? "visible" : "hidden"} size={14} />
                        </button>
                    )}
                </div>
                {onRemoveSprite && !readOnly && (
                    <button
                        className="btn-icon"
                        onClick={onRemoveSprite}
                        title="Remove Sprite from Scene"
                        style={{ marginLeft: '8px', opacity: 0.7 }}
                    >
                        <Icon name="delete" size={14} color="#ef4444" />
                    </button>
                )}
                {!readOnly && (
                    <div style={{ position: 'relative' }}>
                        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            <Icon name="generate" size={12} /> Add Behavior
                        </button>
                        {isAdding && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0, zIndex: 10,
                                background: '#252525', border: '1px solid #444', borderRadius: '4px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '120px'
                            }}>
                                {Object.values(BehaviorTypes).map(type => (
                                    <div
                                        key={type}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
                                        className="hover-bg"
                                        onClick={() => handleAdd(type)}
                                    >
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {behaviors.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No behaviors defined. Animation is static.
                    </div>
                )}

                {behaviors.map((b, idx) => (
                    <BehaviorCard
                        key={idx}
                        behavior={b}
                        onChange={updated => handleUpdate(idx, updated)}
                        onRemove={() => handleRemove(idx)}
                        readOnly={readOnly}
                    />
                ))}
            </div>
        </div >
    );
}

function BehaviorCard({ behavior, onChange, onRemove, readOnly }) {
    const [expanded, setExpanded] = useState(true);

    const updateParam = (key, value) => {
        const newParams = { ...behavior };
        // Detect numeric fields
        const numVal = parseFloat(value);
        if (!isNaN(numVal) && typeof value !== 'boolean' && key !== 'coordinate' && key !== 'waveform') {
            newParams[key] = numVal;
        } else {
            newParams[key] = value;
        }
        onChange(newParams);
    };

    const typeColor = {
        [BehaviorTypes.OSCILLATE]: '#3b82f6',
        [BehaviorTypes.DRIFT]: '#10b981',
        [BehaviorTypes.PULSE]: '#f59e0b',
        [BehaviorTypes.BACKGROUND]: '#8b5cf6',
        [BehaviorTypes.LOCATION]: '#ec4899',
    }[behavior.type] || '#888';

    return (
        <div style={{ background: '#1e1e1e', borderRadius: '6px', border: '1px solid #333', overflow: 'hidden' }}>
            <div
                style={{
                    padding: '8px 12px', background: '#252525', display: 'flex', alignItems: 'center', gap: '8px',
                    borderBottom: expanded ? '1px solid #333' : 'none', cursor: 'pointer'
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: typeColor }}></div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>
                    {behavior.type.toUpperCase()} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({behavior.coordinate || 'y'})</span>
                </span>
                {!readOnly && (
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove">
                        <Icon name="delete" size={12} />
                    </button>
                )}
            </div>

            {expanded && (
                <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                    {/* Common Fields */}
                    {behavior.type !== BehaviorTypes.LOCATION && (
                        <Field label="Coordinate" value={behavior.coordinate} options={CoordinateTypes} onChange={v => updateParam('coordinate', v)} readOnly={readOnly} />
                    )}

                    {/* Oscillate Fields */}
                    {behavior.type === BehaviorTypes.OSCILLATE && (
                        <>
                            <Field label="Frequency (Hz)" value={behavior.frequency} type="number" step="0.1" onChange={v => updateParam('frequency', v)} readOnly={readOnly} />
                            <Field label="Amplitude (px)" value={behavior.amplitude} type="number" onChange={v => updateParam('amplitude', v)} readOnly={readOnly} />
                            <Field label="Phase (rad)" value={behavior.phase_offset} type="number" step="0.1" onChange={v => updateParam('phase_offset', v)} readOnly={readOnly} />
                        </>
                    )}

                    {/* Drift Fields */}
                    {behavior.type === BehaviorTypes.DRIFT && (
                        <>
                            <Field label="Velocity (/s)" value={behavior.velocity} type="number" onChange={v => updateParam('velocity', v)} readOnly={readOnly} />
                            <Field label="Cap Value" value={behavior.drift_cap ?? ''} type="number" onChange={v => updateParam('drift_cap', v)} readOnly={readOnly} />
                        </>
                    )}

                    {/* Pulse Fields */}
                    {behavior.type === BehaviorTypes.PULSE && (
                        <>
                            <Field label="Frequency (Hz)" value={behavior.frequency} type="number" step="0.1" onChange={v => updateParam('frequency', v)} readOnly={readOnly} />
                            <Field label="Min Value" value={behavior.min_value} type="number" step="0.1" onChange={v => updateParam('min_value', v)} readOnly={readOnly} />
                            <Field label="Max Value" value={behavior.max_value} type="number" step="0.1" onChange={v => updateParam('max_value', v)} readOnly={readOnly} />
                            <Field label="Waveform" value={behavior.waveform} options={["sine", "spike"]} onChange={v => updateParam('waveform', v)} readOnly={readOnly} />
                        </>
                    )}

                    {/* Background Fields */}
                    {behavior.type === BehaviorTypes.BACKGROUND && (
                        <>
                            <Field label="Scroll Speed (x)" value={behavior.scroll_speed} type="number" step="0.1" onChange={v => updateParam('scroll_speed', v)} readOnly={readOnly} />
                            <Field label="Fill Screen" value={true} type="text" readOnly={true} />
                        </>
                    )}

                    {/* Location Fields */}
                    {behavior.type === BehaviorTypes.LOCATION && (
                        <>
                            <Field label="X Offset" value={behavior.x} type="number" onChange={v => updateParam('x', v)} readOnly={readOnly} />
                            <Field label="Y Offset" value={behavior.y} type="number" onChange={v => updateParam('y', v)} readOnly={readOnly} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function Field({ label, value, type = "text", step, options, onChange, readOnly }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', opacity: 0.7 }}>{label}</label>
            {options ? (
                <select
                    className="input"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    disabled={readOnly}
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                >
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    className="input"
                    type={type}
                    step={step}
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value)}
                    disabled={readOnly}
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                />
            )}
        </div>
    );
}

function createDefaultBehavior(type) {
    if (type === BehaviorTypes.OSCILLATE) {
        return { type, enabled: true, frequency: 1.0, amplitude: 10, coordinate: "y", phase_offset: 0 };
    } else if (type === BehaviorTypes.DRIFT) {
        return { type, enabled: true, velocity: 10, coordinate: "y", drift_cap: null };
    } else if (type === BehaviorTypes.PULSE) {
        return { type, enabled: true, frequency: 1.0, min_value: 0.5, max_value: 1.0, coordinate: "opacity", waveform: "sine" };
    } else if (type === BehaviorTypes.BACKGROUND) {
        return { type, enabled: true, scroll_speed: 0.0, coordinate: "y" };
    } else if (type === BehaviorTypes.LOCATION) {
        return { type, enabled: true, x: 0, y: 0 };
    }
    return { type, enabled: true };
}
