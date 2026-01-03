import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';

const BehaviorTypes = {
    OSCILLATE: "oscillate",
    DRIFT: "drift",
    PULSE: "pulse",
    BACKGROUND: "background",
    LOCATION: "location",
    SOUND: "sound"
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

    const TABS = ['Motion', 'Sound']; // Environment & Timeline logic managed by parent or future/other components usually, but per design doc:
    // Design doc says: Motion, Sound, Environment, Timeline.
    // Timeline is now a separate component. Environment is complex. 
    // Let's stick to Motion and Sound for now in this list, or add Environment if we want to move it here.
    // The previous implementation didn't fully handle Environment editing in this component.
    // Let's implement Tabs for filtering.

    const [activeTab, setActiveTab] = useState('Motion');

    const filteredBehaviors = behaviors.filter(b => {
        if (activeTab === 'Motion') {
            return [BehaviorTypes.OSCILLATE, BehaviorTypes.DRIFT, BehaviorTypes.PULSE, BehaviorTypes.BACKGROUND, BehaviorTypes.LOCATION].includes(b.type);
        } else if (activeTab === 'Sound') {
            return b.type === BehaviorTypes.SOUND;
        }
        return true;
    });

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
                        <Icon name="delete" size={14} color="var(--color-danger)" />
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

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredBehaviors.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: '0.9rem' }}>
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
    const [expanded, setExpanded] = useState(true);
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

    const typeColor = {
        [BehaviorTypes.OSCILLATE]: '#60a5fa', // Blue
        [BehaviorTypes.DRIFT]: '#34d399',      // Emerald
        [BehaviorTypes.PULSE]: '#fbbf24',      // Amber
        [BehaviorTypes.BACKGROUND]: '#a78bfa', // Violet
        [BehaviorTypes.LOCATION]: '#f472b6',   // Pink
        [BehaviorTypes.SOUND]: '#facc15'        // Yellow
    }[behavior.type] || 'var(--color-text-subtle)';

    return (
        <div style={{ background: 'var(--color-bg-surface)', borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div
                style={{
                    padding: '8px 12px', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', gap: '8px',
                    borderBottom: expanded ? '1px solid var(--color-border)' : 'none', cursor: 'pointer'
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
                            <Field label="X Offset" value={behavior.x} type="number" onChange={v => updateParam('x', v)} readOnly={readOnly} />
                            <Field label="Y Offset" value={behavior.y} type="number" onChange={v => updateParam('y', v)} readOnly={readOnly} />
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
    } else if (type === BehaviorTypes.SOUND) {
        return { type, enabled: true, sound_file: "splash.mp3", volume: 1.0, time_offset: 0 };
    }
    return { type, enabled: true };
}
