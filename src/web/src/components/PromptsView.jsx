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
        <div className="flex h-full overflow-hidden">
            {/* Sidebar list */}
            <aside className="w-70 border-r flex flex-col bg-surface">
                <div className="p-5 border-b">
                    <h2 className="m-0 text-md flex items-center gap-2">
                        <Icon name="config" size={20} /> System Prompts
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="flex flex-col gap-1">
                        {prompts.map(name => (
                            <button
                                key={name}
                                className={`btn text-left justify-start px-4 py-2 text-sm border-none ${selectedPrompt === name ? 'btn-primary bg-primary text-white' : 'transparent text-main'}`}
                                onClick={() => fetchPromptContent(name)}
                            >
                                {name}.prompt
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Editor area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {selectedPrompt ? (
                    <>
                        <header className="px-6 py-4 border-b flex justify-between items-center bg-surface">
                            <div>
                                <h3 className="m-0 text-sm">Editing: <span className="opacity-70">{selectedPrompt}.prompt</span></h3>
                            </div>
                            <button
                                className="btn btn-primary flex items-center gap-2"
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                            >
                                <Icon name="save" size={16} /> Save Changes
                            </button>
                        </header>
                        <div className="flex-1 p-0 relative overflow-hidden">
                            {isLoading && (
                                <div className="absolute inset-0 bg-overlay z-10 flex items-center justify-center">
                                    <Icon name="generate" className="animate-spin" size={32} />
                                </div>
                            )}
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full h-full p-6 bg-base text-main text-sm font-mono resize-none border-none outline-none leading-relaxed"
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
