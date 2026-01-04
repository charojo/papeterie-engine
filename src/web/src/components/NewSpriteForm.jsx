import React, { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from './Icon';

const API_BASE = "http://localhost:8000/api";

export function NewSpriteForm({ onSuccess, onCancel }) {
    const [name, setName] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !name) {
            toast.error("Missing Information", { description: "Please provide both a name and an image." });
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('name', name);
        formData.append('file', file);

        const promise = fetch(`${API_BASE}/sprites/upload`, { method: 'POST', body: formData })
            .then(async res => {
                if (!res.ok) throw new Error(await res.text());
                return res.json();
            })
            .then(async data => {
                await new Promise(r => setTimeout(r, 500));
                onSuccess(data); // Pass full data object so we can use it immediately
                return data.name;
            });

        toast.promise(promise, {
            loading: 'Creating sprite...',
            success: (name) => `Sprite '${name}' created successfully`,
            error: (err) => `Failed to create sprite: ${err.message}`
        });

        try {
            await promise;
        } catch { /* handled by promise */ }
        finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <label htmlFor="sprite-name" style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Sprite Name</label>
                <input id="sprite-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. mythical_dragon" autoFocus />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="sprite-file" style={{ display: 'block', color: 'var(--color-text-muted)' }}>Source Image (PNG)</label>
                <input id="sprite-file" type="file" onChange={e => {
                    const file = e.target.files[0];
                    setFile(file);
                    if (file && !name) {
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                        setName(nameWithoutExt);
                    }
                }} accept="image/png" className="input" />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {onCancel && <button type="button" className="btn" onClick={onCancel} disabled={loading}>Cancel</button>}
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <Icon name="image" className="animate-spin" /> : 'Create Sprite'}
                </button>
            </div>
        </form>
    )
}
