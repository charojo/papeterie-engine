import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { BehaviorTypes, CoordinateTypes, createDefaultBehavior } from './BehaviorConstants';

export function BehaviorEditor({ behaviors = [], onChange, readOnly = false, spriteName, isVisible, _onToggleVisibility, _onRemoveSprite, behaviorGuidance, inline = false }) {
    // Ensure the editor expands and scrolls within its container
    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
        height: inline ? 'auto' : '100%',
        minHeight: inline ? '40px' : '0',
        overflowY: inline ? 'visible' : 'auto'
    };
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

    const TABS = ['Motion', 'Sound']; // Environment & Timeline logic managed by parent or future/other components usually, but per design doc:
    // Design doc says: Motion, Sound, Environment, Timeline.
    // Timeline is now a separate component. Environment is complex. 
    // Let's stick to Motion and Sound for now in this list, or add Environment if we want to move it here.
    // The previous implementation didn't fully handle Environment editing in this component.
    // Let's implement Tabs for filtering.

    const [activeTab, setActiveTab] = useState('Motion');

    const filteredBehaviors = behaviors.filter(b => {
        if (inline) return true; // Show all in inline mode
        if (activeTab === 'Motion') {
            return [BehaviorTypes.OSCILLATE, BehaviorTypes.DRIFT, BehaviorTypes.PULSE, BehaviorTypes.BACKGROUND, BehaviorTypes.LOCATION].includes(b.type);
        } else if (activeTab === 'Sound') {
            return b.type === BehaviorTypes.SOUND;
        }
        return true;
    });

    return (
        <div style={containerStyle}>
            {!inline && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, opacity: isVisible === false ? 0.5 : 1 }}>
                            {spriteName || 'Active Behaviors'}
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {/* Visibility/Remove buttons moved to ImageViewer floating controls */}

                            {!readOnly && !inline && (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        className="btn-icon"
                                        onClick={() => setIsAdding(!isAdding)}
                                        title="Add Behavior"
                                    >
                                        <Icon name="add" size={16} />
                                    </button>
                                    {isAdding && (
                                        <div style={{
                                            position: 'absolute', top: '100%', right: 0, zIndex: 10,
                                            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '4px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '120px'
                                        }}>
                                            {Object.values(BehaviorTypes).filter(t =>
                                                (activeTab === 'Motion' && [BehaviorTypes.OSCILLATE, BehaviorTypes.DRIFT, BehaviorTypes.PULSE, BehaviorTypes.BACKGROUND, BehaviorTypes.LOCATION].includes(t)) ||
                                                (activeTab === 'Sound' && t === BehaviorTypes.SOUND)
                                            ).map(type => (
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
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                className={`btn`}
                                style={{
                                    borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : 'none',
                                    borderRadius: 0, padding: '4px 12px', color: activeTab === tab ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                                    fontSize: '0.8rem'
                                }}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </>
            )}


            {/* Behavior Guidance from LLM - shown once at top */}
            {behaviorGuidance && (
                <div style={{
                    margin: '0 0 4px 0',
                    padding: '6px 8px',
                    background: 'rgba(var(--color-primary-rgb), 0.05)',
                    borderRadius: '4px',
                    fontSize: '0.75rem'
                }}>
                    <p style={{ margin: 0, fontStyle: 'italic', lineHeight: '1.3' }}>
                        {behaviorGuidance}
                    </p>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {filteredBehaviors.length === 0 && (
                    <div style={{ padding: '8px', textAlign: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: '0.75rem' }}>
                        No {activeTab.toLowerCase()} behaviors defined.
                    </div>
                )}

                {filteredBehaviors.map((b, _idx) => {
                    // We need the original index to update/remove correctly
                    const originalIndex = behaviors.indexOf(b);
                    return (
                        <BehaviorCard
                            key={originalIndex}
                            behavior={b}
                            onChange={updated => handleUpdate(originalIndex, updated)}
                            onRemove={() => handleRemove(originalIndex)}
                            readOnly={readOnly}
                        />
                    );
                })}
            </div>
        </div >
    );
}

function BehaviorCard({ behavior, onChange, onRemove, readOnly }) {
    const [expanded, setExpanded] = useState(false);
    const [soundOptions, setSoundOptions] = useState([]);

    // Fetch sound files for dropdown
    useEffect(() => {
        if (behavior.type === 'sound') {
            fetch('http://localhost:8000/api/sounds')
                .then(res => res.json())
                .then(data => setSoundOptions(data.sounds || []))
                .catch(() => setSoundOptions([]));
        }
    }, [behavior.type]);

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



    return (
        <div style={{ background: 'var(--color-bg-surface)', borderRadius: '4px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div
                style={{
                    padding: '0px 6px', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', gap: '4px',
                    borderBottom: expanded ? '1px solid var(--color-border)' : 'none', cursor: 'pointer',
                    minHeight: '20px'
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Icon name={behavior.type} size={14} />
                <span style={{ fontWeight: 600, fontSize: '0.75rem', flex: 1 }}>
                    {behavior.type.toUpperCase()}
                    {behavior.type === BehaviorTypes.LOCATION && behavior.time_offset !== undefined && (
                        <span style={{ color: 'var(--color-primary)', marginLeft: '4px' }}>@{behavior.time_offset.toFixed(2)}s</span>
                    )}
                    <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>({behavior.coordinate || 'y'})</span>
                </span>
                {!readOnly && (
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove">
                        <Icon name="delete" size={10} />
                    </button>
                )}
            </div>

            {expanded && (
                <div style={{ padding: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>

                    {/* Common Fields */}
                    {behavior.type !== BehaviorTypes.LOCATION && behavior.type !== BehaviorTypes.SOUND && (
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
                            <Field label="Time (s)" value={behavior.time_offset} type="number" step="0.05" onChange={v => updateParam('time_offset', v)} readOnly={readOnly} />
                            <Field label="X Offset (px)" value={behavior.x} type="number" onChange={v => updateParam('x', v)} readOnly={readOnly} />
                            <Field label="Y Offset (px)" value={behavior.y} type="number" onChange={v => updateParam('y', v)} readOnly={readOnly} />
                            <Field label="Vert % (0-1)" value={behavior.vertical_percent} type="number" step="0.01" onChange={v => updateParam('vertical_percent', v)} readOnly={readOnly} />
                            <Field label="Horiz % (0-1)" value={behavior.horizontal_percent} type="number" step="0.01" onChange={v => updateParam('horizontal_percent', v)} readOnly={readOnly} />
                            <Field label="Scale" value={behavior.scale} type="number" step="0.1" onChange={v => updateParam('scale', v)} readOnly={readOnly} />
                            <Field label="Rotation" value={behavior.rotation} type="number" step="5" onChange={v => updateParam('rotation', v)} readOnly={readOnly} />
                            <Field label="Z Depth" value={behavior.z_depth} type="number" step="1" onChange={v => updateParam('z_depth', v)} readOnly={readOnly} />
                        </>
                    )}

                    {/* Sound Fields */}
                    {behavior.type === BehaviorTypes.SOUND && (
                        <>
                            <div style={{ gridColumn: 'span 2' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', opacity: 0.7 }}>Sound File</label>
                                    <select
                                        className="input"
                                        value={behavior.sound_file || ''}
                                        onChange={e => updateParam('sound_file', e.target.value)}
                                        disabled={readOnly}
                                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                    >
                                        <option value="">Select a sound...</option>
                                        {soundOptions.map(s => (
                                            <option key={s.filename} value={s.filename}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <Field label="Volume" value={behavior.volume} type="number" step="0.1" onChange={v => updateParam('volume', v)} readOnly={readOnly} />
                            <Field label="Time Offset (s)" value={behavior.time_offset} type="number" step="0.1" onChange={v => updateParam('time_offset', v)} readOnly={readOnly} />
                            <Field label="Fade In (s)" value={behavior.fade_in} type="number" step="0.1" onChange={v => updateParam('fade_in', v)} readOnly={readOnly} />
                            <Field label="Fade Out (s)" value={behavior.fade_out} type="number" step="0.1" onChange={v => updateParam('fade_out', v)} readOnly={readOnly} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={behavior.loop || false}
                                    onChange={e => updateParam('loop', e.target.checked)}
                                    disabled={readOnly}
                                />
                                <label style={{ fontSize: '0.8rem' }}>Loop</label>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function Field({ label, value, type = "text", step, options, onChange, readOnly }) {
    const id = `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label htmlFor={id} style={{ fontSize: '0.7rem', opacity: 0.7 }}>{label}</label>
            {options ? (
                <select
                    id={id}
                    className="input"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    disabled={readOnly}
                    style={{ padding: '1px 4px', fontSize: '0.7rem' }}
                >
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    id={id}
                    className="input"
                    type={type}
                    step={step}
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value)}
                    disabled={readOnly}
                    style={{ padding: '1px 4px', fontSize: '0.7rem' }}
                />
            )}
        </div>
    );
}

