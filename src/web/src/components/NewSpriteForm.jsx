import React, { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from './Icon';
import { API_BASE } from '../config';
import './Forms.css';

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
                onSuccess(data.name);
                return data.name;
            });

        toast.promise(promise, {
            loading: 'Creating sprite...',
            success: (name) => `Sprite '${name}' created successfully`,
            error: (err) => `Failed to create sprite: ${err.message}`
        });

        promise.finally(() => setLoading(false));
    };

    return (
        <form onSubmit={handleSubmit} className="standard-form">
            <div className="form-group">
                <label htmlFor="sprite-name" className="form-label">Sprite Name</label>
                <input id="sprite-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. mythical_dragon" autoFocus />
            </div>
            <div className="form-group">
                <label htmlFor="sprite-file" className="form-label">Source Image (PNG)</label>
                <input id="sprite-file" type="file" onChange={e => {
                    const file = e.target.files[0];
                    setFile(file);
                    if (file && !name) {
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                        setName(nameWithoutExt);
                    }
                }} accept="image/png" className="input" />
            </div>
            <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <Icon name="image" className="animate-spin" /> : 'Create Sprite'}
                </button>
                {onCancel && (
                    <button type="button" className="btn" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                )}
            </div>
        </form>
    )
}
