import React from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export const DesignSystemView = ({ onBack }) => {
    return (
        <div className="flex flex-col h-full bg-base overflow-auto p-10 gap-10">
            <header className="flex justify-between items-center border-b border-muted pb-5">
                <div>
                    <h1 className="m-0 text-2xl font-bold flex items-center gap-3">
                        <Icon name="app" variant="roomy" color="var(--color-primary)" />
                        Papeterie Design System
                    </h1>
                    <p className="text-muted m-0 mt-1">Universal visual standards and component gallery</p>
                </div>
                <Button onClick={onBack} icon="close">Close Gallery</Button>
            </header>

            {/* Buttons Section */}
            <section className="flex flex-col gap-6">
                <h2 className="text-lg font-semibold border-l-4 border-primary pl-4">Buttons</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Variants */}
                    <div className="flex flex-col gap-4 p-5 bg-surface rounded-lg border border-border">
                        <h3 className="text-sm uppercase tracking-wider text-subtle mb-2">Variants</h3>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="primary">Primary</Button>
                            <Button variant="secondary">Secondary</Button>
                            <Button variant="ghost">Ghost Button</Button>
                            <Button variant="danger">Danger Action</Button>
                        </div>
                    </div>

                    {/* Sizes */}
                    <div className="flex flex-col gap-4 p-5 bg-surface rounded-lg border border-border">
                        <h3 className="text-sm uppercase tracking-wider text-subtle mb-2">Sizing modifiers</h3>
                        <div className="flex items-center flex-wrap gap-3">
                            <Button size="standard">Standard</Button>
                            <Button size="sm">Small (sm)</Button>
                            <Button size="xs">Extra Small (xs)</Button>
                        </div>
                    </div>

                    {/* States */}
                    <div className="flex flex-col gap-4 p-5 bg-surface rounded-lg border border-border">
                        <h3 className="text-sm uppercase tracking-wider text-subtle mb-2">States & Loading</h3>
                        <div className="flex flex-wrap gap-3">
                            <Button loading>Loading State</Button>
                            <Button disabled>Disabled Button</Button>
                            <Button active variant="ghost">Active / Selected</Button>
                        </div>
                    </div>

                    {/* Icons & Tabs */}
                    <div className="flex flex-col gap-4 p-5 bg-surface rounded-lg border border-border">
                        <h3 className="text-sm uppercase tracking-wider text-subtle mb-2">Special Contexts</h3>
                        <div className="flex flex-wrap gap-3">
                            <Button icon="add">With Icon</Button>
                            <Button variant="icon" icon="settings" title="Icon Only" />
                            <Button isTab active>Active Tab</Button>
                            <Button isTab>Inactive Tab</Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Icons Section */}
            <section className="flex flex-col gap-6">
                <h2 className="text-lg font-semibold border-l-4 border-primary pl-4">Iconography</h2>
                <div className="p-5 bg-surface rounded-lg border border-border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="flex flex-col items-center gap-2 p-4 border border-muted/20 rounded">
                            <Icon name="scene" variant="roomy" />
                            <span className="text-xs font-mono">variant="roomy" (32px)</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 border border-muted/20 rounded">
                            <Icon name="scene" variant="tight" />
                            <span className="text-xs font-mono">variant="tight" (16px)</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 border border-muted/20 rounded">
                            <Icon name="generate" className="animate-spin" variant="roomy" />
                            <span className="text-xs font-mono">Animated Spinner</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 border border-muted/20 rounded">
                            <Icon name="visible" color="var(--color-primary)" />
                            <span className="text-xs font-mono">Custom Color</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Forms Section */}
            <section className="flex flex-col gap-6 ">
                <h2 className="text-lg font-semibold border-l-4 border-primary pl-4">Form System</h2>
                <div className="p-8 bg-surface rounded-lg border border-border max-w-xl">
                    <form className="standard-form" onSubmit={e => e.preventDefault()}>
                        <div className="form-group">
                            <label className="form-label">Sprite Name</label>
                            <input className="input" placeholder="e.g. Hero_Idle" />
                            <span className="form-text">Unique identifier for the layer</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Behavior Description</label>
                            <textarea className="input h-24" placeholder="Describe the motion..." />
                        </div>

                        <div className="flex gap-3 justify-end mt-4">
                            <Button>Discard</Button>
                            <Button variant="primary" icon="save">Save Properties</Button>
                        </div>
                    </form>
                </div>
            </section>

            {/* Colors Section */}
            <section className="flex flex-col gap-6 mb-20">
                <h2 className="text-lg font-semibold border-l-4 border-primary pl-4">Theme Palette</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="h-24 rounded-lg border border-border flex flex-col items-center justify-center bg-primary text-white">
                        <span className="text-xs font-bold">Primary</span>
                    </div>
                    <div className="h-24 rounded-lg border border-border flex flex-col items-center justify-center bg-surface text-main">
                        <span className="text-xs font-bold">Surface</span>
                    </div>
                    <div className="h-24 rounded-lg border border-border flex flex-col items-center justify-center bg-elevated text-main">
                        <span className="text-xs font-bold">Elevated</span>
                    </div>
                    <div className="h-24 rounded-lg border border-border flex flex-col items-center justify-center bg-error text-white">
                        <span className="text-xs font-bold">Error</span>
                    </div>
                    <div className="h-24 rounded-lg border border-border flex flex-col items-center justify-center bg-selection-accent text-main">
                        <span className="text-xs font-bold">Selection</span>
                    </div>
                </div>
            </section>
        </div>
    );
};
