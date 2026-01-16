import React, { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from './Icon';
import { API_BASE } from '../config';
import './Forms.css';

export function NewSceneForm({ onSuccess }) {
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

        const promise = fetch(`${API_BASE}/scenes/upload`, { method: 'POST', body: formData })
            .then(async res => {
                if (!res.ok) throw new Error(await res.text());
                return res.json();
            })
            .then(async data => {
                await new Promise(r => setTimeout(r, 500));
                onSuccess(data.name);
            });

        toast.promise(promise, {
            loading: 'Uploading scene...',
            success: 'Scene uploaded successfully',
            error: (e) => `Upload failed: ${e.message}`
        });

        promise.finally(() => setLoading(false)).catch(() => { });
    };

    return (
        <form onSubmit={handleSubmit} className="standard-form">
            <div className="form-group">
                <label htmlFor="scene-name" className="form-label">Scene Name</label>
                <input id="scene-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. spooky_forest" autoFocus />
            </div>
            <div className="form-group">
                <label htmlFor="scene-file" className="form-label">Original Reference Image</label>
                <input id="scene-file" type="file" onChange={e => {
                    const file = e.target.files[0];
                    setFile(file);
                    if (file && !name) {
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                        setName(nameWithoutExt);
                    }
                }} accept="image/*" className="input" />
            </div>
            <button type="submit" className="btn btn-primary btn-form-submit" data-testid="upload-scene-submit" disabled={loading}>
                {loading ? <Icon name="image" className="animate-spin" /> : 'Upload Scene'}
            </button>
        </form>
    )
}
