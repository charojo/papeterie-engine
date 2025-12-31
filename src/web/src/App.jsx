import { useState, useEffect } from 'react'

const API_BASE = "http://localhost:8000/api";

function App() {
  const [sprites, setSprites] = useState([]);
  const [selectedSprite, setSelectedSprite] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'new', 'detail'

  useEffect(() => {
    fetchSprites();
  }, []);

  const fetchSprites = async () => {
    try {
      const res = await fetch(`${API_BASE}/sprites`);
      const data = await res.json();
      setSprites(data);
    } catch (e) {
      console.error("Failed to fetch sprites", e);
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Papeterie File</h3>
          <button className="btn btn-primary" style={{ padding: '4px 8px' }} onClick={() => setView('new')}>+</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          {sprites.map(sprite => (
            <div
              key={sprite.name}
              className={`btn ${selectedSprite?.name === sprite.name ? 'btn-primary' : ''}`}
              style={{ textAlign: 'left', border: 'none', background: selectedSprite?.name === sprite.name ? 'var(--color-primary)' : 'transparent' }}
              onClick={() => { setSelectedSprite(sprite); setView('detail'); }}
            >
              {sprite.name}
              {sprite.has_metadata && <span style={{ float: 'right', fontSize: '10px', opacity: 0.7 }}>✨</span>}
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content">
        {view === 'new' && <NewSpriteView onCreated={async (name) => {
          console.log("[App] onCreated called with name:", name);

          // Force a fetch to ensuring we have the latest
          try {
            console.log("[App] Fetching refreshing list...");
            const res = await fetch(`${API_BASE}/sprites`);
            const data = await res.json();
            console.log("[App] Fresh sprites list:", data);

            setSprites(data);

            const newSprite = data.find(s => s.name === name);
            if (newSprite) {
              console.log("[App] Found new sprite, switching view to:", newSprite);
              setSelectedSprite(newSprite);
              setView('detail');
            } else {
              console.warn("[App] Could not find created sprite in list. Name searched:", name);
              setView('list');
            }
          } catch (e) {
            console.error("[App] Error in onCreated flow:", e);
            setView('list');
          }
        }} />}
        {view === 'detail' && selectedSprite && <SpriteDetailView sprite={selectedSprite} refresh={fetchSprites} />}
        {view === 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
            <h2>Select a Sprite or Create New</h2>
          </div>
        )}
      </main>
    </div>
  )
}

function NewSpriteView({ onCreated }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [removeBg, setRemoveBg] = useState(false);
  const [optimize, setOptimize] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !name) {
      alert("Please provide both a name and an image.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    formData.append('remove_background', removeBg);
    formData.append('optimize', optimize);

    console.log("[NewSpriteView] Submitting form...", { name, file, removeBg, optimize });

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log("[NewSpriteView] Response status:", res.status);


      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server responded with ${res.status}: ${errText}`);
      }

      const data = await res.json();

      // Simulate a small delay so user sees "Uploading..." state
      await new Promise(r => setTimeout(r, 500));

      onCreated(data.name);
    } catch (e) {
      console.error("Upload failed", e);
      alert(`Upload failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card glass" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create New Sprite</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Sprite Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. mythical_dragon" />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Source Image (PNG)</label>
          <input type="file" onChange={e => setFile(e.target.files[0])} accept="image/png" className="input" />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
            <input type="checkbox" checked={removeBg} onChange={e => setRemoveBg(e.target.checked)} />
            Remove Green Screen
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
            <input type="checkbox" checked={optimize} onChange={e => setOptimize(e.target.checked)} />
            Optimize Image
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Processing & Uploading...' : 'Create Sprite'}
        </button>
      </form>
    </div>
  )
}

function SpriteDetailView({ sprite, refresh }) {
  const [prompt, setPrompt] = useState(sprite.prompt_text || '');
  const [compiling, setCompiling] = useState(false);
  const [logs, setLogs] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Update local state when sprite prop changes
  useEffect(() => {
    setPrompt(sprite.prompt_text || '');
    setLogs('');
    setCopyFeedback(false);
  }, [sprite]);

  const imageUrl = `${API_BASE.replace('/api', '')}/assets/sprites/${sprite.name}/${sprite.name}.png`; // Hacky static serve simulation?

  // Actually, I haven't implemented static serving for generic assets yet in backend.
  // I should add `StaticFiles` to backend main.py to serve `assets`.
  // For now let's assume I will add it.

  const handleCompile = async () => {
    setCompiling(true);
    setLogs("Starting compilation with Gemini...\n");
    try {
      const res = await fetch(`${API_BASE}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sprite.name, prompt: prompt || "Animate this naturally" })
      });

      if (!res.ok) throw new Error("Compilation failed");

      const data = await res.json();
      setLogs(prev => prev + "Compilation success!\n" + JSON.stringify(data, null, 2));
      refresh();
    } catch (e) {
      setLogs(prev => prev + "Error: " + e.message);
    } finally {
      setCompiling(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      height: 'calc(100vh - 60px)',
      overflow: 'hidden'
    }}>

      {/* Top Section: Split View (Visuals | Metadata) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        gap: '24px',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0
      }}>

        {/* Left Column: Visuals & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '8px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sprite.name}</h1>
            <div style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '12px', background: sprite.has_metadata ? 'rgba(74, 222, 128, 0.2)' : 'rgba(244, 63, 94, 0.2)', color: sprite.has_metadata ? '#4ade80' : '#f43f5e' }}>
              {sprite.has_metadata ? 'Compiled' : 'Raw'}
            </div>
          </header>

          <div className="card glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Header Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Visuals</h3>
              <div style={{ display: 'flex', gap: '8px' }}>

                {/* Optimize Button */}
                <button className="btn"
                  title="✨ AI Optimize Sprite"
                  style={{ color: '#d8b4fe', borderColor: 'rgba(216, 180, 254, 0.3)' }}
                  onClick={async () => {
                    try {
                      setLogs(prev => prev + "Starting AI Optimization...\n");
                      const res = await fetch(`${API_BASE}/sprites/${sprite.name}/process`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ optimize: true, remove_background: false })
                      });

                      if (!res.ok) throw new Error(await res.text());

                      const data = await res.json();
                      if (data.method && data.method.startsWith('fallback')) {
                        setLogs(prev => prev + `⚠️ Optimization completed via FALLBACK (Manual Green Screen).\n   AI Error: ${data.error_details || 'Unknown'}\n`);
                      } else {
                        setLogs(prev => prev + "✨ AI Optimization successful!\n");
                      }

                      refresh();
                    } catch (e) {
                      setLogs(prev => prev + "Error processing: " + e.message + "\n");
                    }
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                </button>



                {/* Copy Prompt Button */}
                <button className="btn"
                  title="🧠 Copy Optimization Prompt"
                  style={{ color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.3)' }}
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/system-prompt`);
                      const data = await res.json();
                      const fullPrompt = `${data.content}\n\nUser Request: ${prompt || "Optimize this sprite..."}`;
                      navigator.clipboard.writeText(fullPrompt);
                      setLogs(prev => prev + "Copied optimization prompt + request to clipboard!\n");
                    } catch (e) {
                      setLogs(prev => prev + "Failed to fetch prompt: " + e.message + "\n");
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </button>

                {/* Revert Button */}
                {sprite.has_original && (
                  <button className="btn"
                    title="↩️ Revert to Original"
                    style={{ color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                    onClick={async () => {
                      if (!confirm("Revert to original image?")) return;
                      try {
                        setLogs(prev => prev + "Reverting...\n");
                        const res = await fetch(`${API_BASE}/sprites/${sprite.name}/revert`, { method: 'POST' });
                        if (!res.ok) throw new Error(await res.text());
                        setLogs(prev => prev + "Revert complete!\n");
                        refresh();
                      } catch (e) {
                        setLogs(prev => prev + "Error reverting: " + e.message + "\n");
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Original (if exists) */}
            {sprite.has_original && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.8em', opacity: 0.7 }}>Original Source</div>
                <div style={{
                  height: '100px',
                  background: '#0a0a0a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #333',
                  opacity: 0.6
                }}>
                  <img
                    src={`${API_BASE.replace('/api', '')}/assets/sprites/${sprite.name}/${sprite.name}.original.png?t=${Date.now()}`}
                    alt="Original"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {/* Current / Optimized */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '0.8em', opacity: 0.7 }}>{sprite.has_original ? "Optimized / Current" : "Current Image"}</div>
              <div style={{
                aspectRatio: '1',
                background: '#0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #333'
              }}>
                {sprite.has_image ? (
                  <img
                    src={`${API_BASE.replace('/api', '')}/assets/sprites/${sprite.name}/${sprite.name}.png?t=${Date.now()}`}
                    alt={sprite.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ color: '#666' }}>No Image</span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Prompt & Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

          {/* Compiler Prompt */}
          <div className="card glass" style={{ display: 'flex', flexDirection: 'column', padding: '16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Animation Prompt</h3>
              <button className="btn"
                title="⚡ Compile Metadata"
                style={{ color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.3)', padding: '4px' }}
                onClick={handleCompile} disabled={compiling}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              </button>
            </div>

            <textarea
              className="input"
              style={{ width: '100%', resize: 'none', height: '80px', fontFamily: 'monospace', fontSize: '0.9em' }}
              placeholder="Describe how this sprite should move..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>

          {/* Metadata Panel */}
          <div className="card glass" style={{ display: 'flex', flexDirection: 'column', padding: '16px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '8px' }}>Metadata (JSON)</h3>
            <pre style={{
              flex: 1,
              background: 'rgba(0,0,0,0.3)',
              padding: '12px',
              borderRadius: '6px',
              overflowY: 'auto',
              margin: 0,
              fontSize: '0.85em',
              color: '#a5b4fc',
              whiteSpace: 'pre-wrap'
            }}>
              {sprite.metadata ? JSON.stringify(sprite.metadata, null, 2) : <span style={{ opacity: 0.5 }}>No compiled metadata</span>}
            </pre>
          </div>

        </div>
      </div>

      {/* Bottom Section: Logs (Full Width) */}
      <div className="card glass" style={{
        height: '150px',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        flexShrink: 0,
        position: 'relative'
      }}>
        {/* Controls (Absolute Top Right) - Scaled Down & Subtle */}
        <div style={{
          position: 'absolute',
          top: '1px',
          right: '16px',
          display: 'flex',
          gap: '2px',
          zIndex: 10,
          opacity: 0.5,
          transform: 'scale(0.56)',
          transformOrigin: 'top right'
        }}>
          <button
            className="btn"
            style={{ padding: 0, lineHeight: 0, color: copyFeedback ? '#4ade80' : '#9ca3af', background: 'transparent', border: 'none' }}
            title={copyFeedback ? "Copied!" : "Copy logs to clipboard"}
            onClick={() => {
              navigator.clipboard.writeText(logs || "");
              setCopyFeedback(true);
              setTimeout(() => setCopyFeedback(false), 2000);
            }}
          >
            {copyFeedback ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
          <button
            className="btn"
            style={{ padding: 0, lineHeight: 0, color: '#9ca3af', background: 'transparent', border: 'none' }}
            title="Clear logs"
            onClick={() => setLogs('')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>

        {/* Logs Pre */}
        <pre style={{
          flex: 1,
          background: 'rgba(0,0,0,0.3)',
          padding: '12px',
          borderRadius: '6px',
          overflowY: 'auto',
          margin: 0,
          fontSize: '0.85em',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap'
        }}>
          {logs || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Processing logs show here...</span>}
        </pre>
      </div>

    </div>
  )
}

export default App

