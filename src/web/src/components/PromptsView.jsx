import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from './Icon';
import { toast } from 'sonner';
import { API_BASE } from '../config';

export const PromptsView = ({ user }) => {
    const [prompts, setPrompts] = useState([]);
    const [selectedPrompt, setSelectedPrompt] = useState(null);
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const headers = useMemo(() => (user ? { 'Authorization': `Bearer ${user.access_token}` } : {}), [user]);

    const fetchPrompts = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/prompts`, { headers });
            const data = await res.json();
            setPrompts(data.prompts);
        } catch (e) {
            console.error("Failed to fetch prompts", e);
            toast.error("Failed to load prompt list");
        }
    }, [headers]);

    const fetchPromptContent = async (name) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/prompts/${name}`, { headers });
            const data = await res.json();
            setSelectedPrompt(name);
            setContent(data.content);
        } catch (e) {
            console.error("Failed to fetch prompt content", e);
            toast.error(`Failed to load prompt: ${name}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedPrompt) return;
        setIsSaving(true);
        const promise = fetch(`${API_BASE}/prompts/${selectedPrompt}`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: selectedPrompt, content })
        }).then(async res => {
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        });

        toast.promise(promise, {
            loading: 'Saving prompt...',
            success: 'Prompt saved successfully',
            error: (e) => `Failed to save: ${e.message}`
        });

        try {
            await promise;
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        fetchPrompts();
    }, [fetchPrompts]);

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Sidebar list */}
            <aside style={{
                width: '280px',
                borderRight: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.02)'
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name="config" size={20} /> System Prompts
                    </h2>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {prompts.map(name => (
                            <button
                                key={name}
                                className={`btn ${selectedPrompt === name ? 'btn-primary' : ''}`}
                                style={{
                                    textAlign: 'left',
                                    justifyContent: 'flex-start',
                                    padding: '10px 16px',
                                    fontSize: '0.9rem',
                                    border: 'none',
                                    background: selectedPrompt === name ? 'var(--color-primary)' : 'transparent',
                                    color: selectedPrompt === name ? 'var(--color-text-on-primary)' : 'var(--color-text-main)'
                                }}
                                onClick={() => fetchPromptContent(name)}
                            >
                                {name}.prompt
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Editor area */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {selectedPrompt ? (
                    <>
                        <header style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid var(--color-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>Editing: <span style={{ opacity: 0.7 }}>{selectedPrompt}.prompt</span></h3>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Icon name="save" size={16} /> Save Changes
                            </button>
                        </header>
                        <div style={{ flex: 1, padding: '0', position: 'relative', overflow: 'hidden' }}>
                            {isLoading && (
                                <div style={{
                                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Icon name="generate" className="animate-spin" size={32} />
                                </div>
                            )}
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    background: 'transparent',
                                    color: 'var(--color-text-main)',
                                    border: 'none',
                                    padding: '24px',
                                    fontFamily: '"Fira Code", "Source Code Pro", monospace',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.6',
                                    resize: 'none',
                                    outline: 'none'
                                }}
                                spellCheck="false"
                            />
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <Icon name="config" size={64} style={{ marginBottom: '16px' }} />
                        <h3>Select a prompt file to edit</h3>
                        <p style={{ maxWidth: '400px', textAlign: 'center' }}>
                            These files define how the Gemini AI interprets and structures your animations. Handle with care!
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};
