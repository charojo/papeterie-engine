import React, { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from './Icon';
import { Button } from './Button';
import { API_BASE } from '../config';


export function GenerateSceneForm({ onSuccess }) {
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !prompt) {
            toast.error("Missing Information", { description: "Please provide name and prompt" });
            return;
        }

        setLoading(true);

        const promise = fetch(`${API_BASE}/scenes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, prompt })
        })
            .then(async res => {
                if (!res.ok) throw new Error(await res.text());
                return res.json();
            })
            .then(async data => {
                await new Promise(r => setTimeout(r, 1000));
                onSuccess(data.name);
            });

        toast.promise(promise, {
            loading: 'Generating scene with AI (this may take a minute)...',
            success: 'Scene generated!',
            error: (e) => `Generation failed: ${e.message}`
        });

        promise.finally(() => setLoading(false));
    };

    return (
        <form onSubmit={handleSubmit} className="standard-form">
            <div className="form-group">
                <label htmlFor="gen-name" className="form-label">Scene Name</label>
                <input id="gen-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. magical_forest" />
            </div>
            <div className="form-group">
                <label htmlFor="gen-prompt" className="form-label">Description Prompt</label>
                <textarea id="gen-prompt" className="input form-textarea"
                    value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe the scene you want to generate" />
            </div>
            <Button
                type="submit"
                variant="primary"
                className="btn-form-submit"
                loading={loading}
                icon="generate"
            >
                Generate Scene
            </Button>
        </form>
    )
}
