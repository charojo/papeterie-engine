import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { BehaviorTypes, CoordinateTypes, createDefaultBehavior } from './BehaviorConstants';
import { API_BASE } from '../config';

export function BehaviorEditor({ behaviors = [], onChange, readOnly = false, spriteName, isVisible, _onToggleVisibility, _onRemoveSprite, behaviorGuidance, inline = false, highlightIndex = null, onSelect = null }) {
    // Ensure the editor expands and scrolls within its container

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
        <div className={`flex-col gap-0 ${inline ? 'h-auto overflow-visible' : 'h-full overflow-auto min-h-0'}`} style={{ minHeight: inline ? '40px' : '0' }}>
            {!inline && (
                <>
                    <div className="justify-between items-center flex-row">
                        <h3 className={`m-0 text-base font-bold ${isVisible === false ? 'text-subtle' : ''}`}>
                            {spriteName || 'Active Behaviors'}
                        </h3>

                        <div className="flex-row items-center gap-sm">
                            {/* Visibility/Remove buttons moved to ImageViewer floating controls */}

                            {!readOnly && !inline && (
                                <div className="relative">
                                    <Button
                                        variant="icon"
                                        onClick={() => setIsAdding(!isAdding)}
                                        title="Add Behavior"
                                        icon="add"
                                    />
                                    {isAdding && (
                                        <div className="absolute top-full right-0 z-10 panel shadow-lg min-w-120">
                                            {Object.values(BehaviorTypes).filter(t =>
                                                (activeTab === 'Motion' && [BehaviorTypes.OSCILLATE, BehaviorTypes.DRIFT, BehaviorTypes.PULSE, BehaviorTypes.BACKGROUND, BehaviorTypes.LOCATION].includes(t)) ||
                                                (activeTab === 'Sound' && t === BehaviorTypes.SOUND)
                                            ).map(type => (
                                                <div
                                                    key={type}
                                                    className="p-2 cursor-pointer text-sm hover-bg"
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
                    <div className="tab-container">
                        {TABS.map(tab => (
                            <Button
                                key={tab}
                                variant="ghost"
                                isTab
                                active={activeTab === tab}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </Button>
                        ))}
                    </div>
                </>
            )}


            {/* Behavior Guidance from LLM - shown once at top */}
            {behaviorGuidance && (
                <div className="mb-1 p-2 bg-primary-muted rounded text-xs">
                    <p className="m-0 italic lh-tight text-muted">
                        {behaviorGuidance}
                    </p>
                </div>
            )}

            <div className={`flex-1 flex-col gap-0.5 border-t ${inline ? 'overflow-visible' : 'overflow-auto'}`}>
                {filteredBehaviors.length === 0 && (
                    <div className="p-2 text-center text-subtle italic text-xs">
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
                            index={originalIndex}
                            onChange={updated => handleUpdate(originalIndex, updated)}
                            onRemove={() => handleRemove(originalIndex)}
                            onSelect={() => onSelect && onSelect(originalIndex)}
                            readOnly={readOnly}
                            isHighlighted={highlightIndex === originalIndex}
                        />
                    );
                })}
            </div>
        </div >
    );
}

import { SoundPicker } from './SoundPicker';

function BehaviorCard({ behavior, _index, onChange, onRemove, onSelect, readOnly, isHighlighted = false }) {
    const [expanded, setExpanded] = useState(false);
    const [soundOptions, setSoundOptions] = useState([]);
    const [showSoundPicker, setShowSoundPicker] = useState(false);

    // Auto-expand when highlighted via timeline selection
    useEffect(() => {
        if (isHighlighted) {
            setExpanded(true);
        }
    }, [isHighlighted]);

    const fetchSounds = () => {
        fetch(`${API_BASE}/sounds`)
            .then(res => res.json())
            .then(data => setSoundOptions(data.sounds || []))
            .catch(() => setSoundOptions([]));
    };

    // Fetch sound files for dropdown/picker
    useEffect(() => {
        if (behavior.type === 'sound') {
            fetchSounds();
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

    const handleUploadLaunch = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch(`${API_BASE}/sounds/upload`, {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    // Refresh options and select the new one
                    await fetchSounds();
                    updateParam('sound_file', file.name);
                    // If picker is open, it will update automatically via soundOptions state change if we re-fetch?
                    // fetchSounds updates state, so yes.
                }
            } catch (err) {
                console.error("Upload failed", err);
            }
        };
        input.click();
    };


    return (
        <div className={`bg-surface rounded-sm border overflow-hidden ${isHighlighted ? 'border-selection ring-selection-glow mx-px' : ''}`}>
            <div
                className="px-2 bg-elevated items-center gap-sm cursor-pointer min-h-5 flex-row"
                style={{
                    borderBottom: expanded ? '1px solid var(--color-border)' : 'none'
                }}
                title={`${behavior.type.charAt(0).toUpperCase() + behavior.type.slice(1)} Behavior - Click to edit`}
                onClick={() => {
                    setExpanded(!expanded);
                    if (!expanded && onSelect) onSelect(); // Select when expanding
                }}
            >
                <Icon name={behavior.type} size={14} />
                <span className="font-medium text-xs flex-1 text-muted">
                    {behavior.type.toUpperCase()}
                    {behavior.time_offset !== undefined && (
                        <span className="text-subtle ml-1">@{behavior.time_offset.toFixed(2)}s</span>
                    )}
                    <span className="text-subtle text-xs ml-1">({behavior.coordinate || 'y'})</span>
                </span>
                {!readOnly && (
                    <Button
                        variant="icon"
                        size="xs"
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        title="Delete Behavior"
                        icon="close"
                    />
                )}
            </div>

            {expanded && (
                <div className="p-1 grid-2-col relative">

                    {/* Common Fields */}
                    {behavior.type !== BehaviorTypes.BACKGROUND && (
                        <Field label="Time Offset (s)" value={behavior.time_offset} type="number" step="0.1" onChange={v => updateParam('time_offset', v)} readOnly={readOnly} />
                    )}
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
                            <div className="col-span-2">
                                <div className="flex-col gap-sm">
                                    <label className="text-xs text-subtle">Sound File</label>
                                    <div className="flex-row gap-sm items-center">
                                        <div
                                            className="input flex-1 p-2 text-sm flex items-center justify-between cursor-pointer hover:bg-surface-hover"
                                            onClick={() => !readOnly && setShowSoundPicker(true)}
                                            role="button"
                                            title="Click to select sound"
                                        >
                                            <span className={behavior.sound_file ? "text-text-main" : "text-muted italic"}>
                                                {behavior.sound_file || "Select a sound..."}
                                            </span>
                                            <Icon name="music" size={12} className="text-muted" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Field label="Volume" value={behavior.volume} type="number" step="0.1" onChange={v => updateParam('volume', v)} readOnly={readOnly} />
                            <Field label="Fade In (s)" value={behavior.fade_in} type="number" step="0.1" onChange={v => updateParam('fade_in', v)} readOnly={readOnly} />
                            <Field label="Fade Out (s)" value={behavior.fade_out} type="number" step="0.1" onChange={v => updateParam('fade_out', v)} readOnly={readOnly} />
                            <div className="flex-row items-center gap-md">
                                <label className="text-sm flex-row items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={behavior.loop || false}
                                        onChange={e => updateParam('loop', e.target.checked)}
                                        disabled={readOnly}
                                    />
                                    Loop
                                </label>
                            </div>

                            {/* Sound Picker Modal */}
                            {showSoundPicker && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                    <div className="bg-surface rounded-lg shadow-xl w-full max-w-2xl h-[70vh] flex overflow-hidden border border-border">
                                        <SoundPicker
                                            sounds={soundOptions}
                                            onSelect={(val) => {
                                                updateParam('sound_file', val.filename);
                                                setShowSoundPicker(false);
                                            }}
                                            onClose={() => setShowSoundPicker(false)}
                                            onUpload={handleUploadLaunch}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function Field({ label, value, type = "text", step, options, onChange, readOnly }) {
    const id = `field-${label.replace(/\s+/g, '-').toLowerCase()}`;

    const handleKeyDown = (e) => {
        if (readOnly) return;
        if (type !== 'number') return;

        const currentStep = parseFloat(step || 1);
        const currentVal = parseFloat(value ?? 0);

        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            e.stopPropagation();
            onChange(currentVal + currentStep);
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            e.stopPropagation();
            onChange(currentVal - currentStep);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            e.target.blur();
        }
    };

    return (
        <div className="flex-col gap-0">
            <label htmlFor={id} className="text-xs text-subtle">{label}</label>
            {options ? (
                <select
                    id={id}
                    className="input py-xs text-xs"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    disabled={readOnly}
                >
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    id={id}
                    className="input py-xs text-xs"
                    type={type}
                    step={step}
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={readOnly}
                />
            )}
        </div>
    );
}

