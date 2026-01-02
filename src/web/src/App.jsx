import { useState, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { GenericDetailView } from './components/GenericDetailView';
import { Icon } from './components/Icon';

const API_BASE = "http://localhost:8000/api";

function App() {
  const [sprites, setSprites] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null); // Can be a sprite or a scene
  const [view, setView] = useState('list'); // 'list', 'create', 'sprite-detail', 'scene-detail'
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [spriteRes, sceneRes] = await Promise.all([
        fetch(`${API_BASE}/sprites`),
        fetch(`${API_BASE}/scenes`)
      ]);

      const spriteData = await spriteRes.json();
      const sceneData = await sceneRes.json();

      // Alphabetize
      spriteData.sort((a, b) => a.name.localeCompare(b.name));
      sceneData.sort((a, b) => a.name.localeCompare(b.name));

      setSprites(spriteData);
      setScenes(sceneData);

      // Refresh selected item from new data if it exists
      if (selectedItem) {
        const typeList = view === 'sprite-detail' ? spriteData : sceneData;
        const freshItem = typeList.find(i => i.name === selectedItem.name);
        if (freshItem) setSelectedItem(freshItem);
      }

    } catch (e) {
      console.error("Failed to fetch data", e);
      toast.error("Failed to fetch data", { description: e.message });
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Papeterie</h3>
          <button className="btn btn-primary" style={{ padding: '4px 8px' }} onClick={() => setView('create')}>
            <Icon name="add" size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, minHeight: 0 }}>

          <CollapsibleSection title="Scenes" defaultOpen={true} icon="scenes">
            {scenes.map(scene => (
              <div
                key={scene.name}
                className={`btn ${selectedItem?.name === scene.name && view === 'scene-detail' ? 'btn-primary' : ''}`}
                style={{ textAlign: 'left', border: 'none', background: selectedItem?.name === scene.name && view === 'scene-detail' ? 'var(--color-primary)' : 'transparent', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => { setSelectedItem(scene); setView('scene-detail'); }}
              >
                <Icon name="scenes" size={14} /> {scene.name}
              </div>
            ))}
            {scenes.length === 0 && <div style={{ opacity: 0.5, paddingLeft: '16px', fontSize: '0.9em' }}>No scenes found</div>}
          </CollapsibleSection>

          <CollapsibleSection title="Sprites" defaultOpen={true} icon="sprites">
            {sprites.map(sprite => (
              <div
                key={sprite.name}
                className={`btn ${selectedItem?.name === sprite.name && view === 'sprite-detail' ? 'btn-primary' : ''}`}
                style={{ textAlign: 'left', border: 'none', background: selectedItem?.name === sprite.name && view === 'sprite-detail' ? 'var(--color-primary)' : 'transparent', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => { setSelectedItem(sprite); setView('sprite-detail'); }}
              >
                <span title={sprite.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  <Icon name="sprites" size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} />{sprite.name}
                </span>
                {sprite.has_metadata && <span style={{ fontSize: '10px', opacity: 0.7 }}>✨</span>}
              </div>
            ))}
          </CollapsibleSection>

        </div>
      </aside>

      <main className="main-content">
        {view === 'create' && (
          <CreateView
            onCreated={async (type, name) => {
              await fetchData();
              // Fetch fresh data to force selection of new item
              const endpoint = type === 'sprite' ? 'sprites' : 'scenes';
              const res = await fetch(`${API_BASE}/${endpoint}`);
              const data = await res.json();
              const newItem = data.find(s => s.name === name);

              if (newItem) {
                setSelectedItem(newItem);
                setView(type === 'sprite' ? 'sprite-detail' : 'scene-detail');
              }
            }}
          />
        )}

        {view === 'sprite-detail' && selectedItem && (
          <GenericDetailView
            type="sprite"
            asset={selectedItem}
            refresh={fetchData}
            isExpanded={isExpanded}
            toggleExpand={() => setIsExpanded(!isExpanded)}
          />
        )}

        {view === 'scene-detail' && selectedItem && (
          <GenericDetailView
            type="scene"
            asset={selectedItem}
            refresh={fetchData}
            isExpanded={isExpanded}
            toggleExpand={() => setIsExpanded(!isExpanded)}
            onOpenSprite={(spriteName) => {
              const sprite = sprites.find(s => s.name === spriteName);
              if (sprite) {
                setSelectedItem(sprite);
                setView('sprite-detail');
              } else {
                console.warn("Could not find sprite:", spriteName);
                toast.warning(`Sprite '${spriteName}' not found`);
              }
            }}
          />
        )}

        {view === 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: '100%', opacity: 0.5, flexDirection: 'column', gap: '16px', paddingTop: '100px' }}>
            <Icon name="logs" size={48} opacity={0.5} />
            <h2>Select a Scene or Sprite</h2>
          </div>
        )}
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  )
}

function CreateView({ onCreated }) {
  const [selectedType, setSelectedType] = useState('sprite'); // 'sprite' | 'scene-upload' | 'scene-gen'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '24px', height: '100%', overflowY: 'auto' }}>

      {/* Selection Tiles */}
      <div style={{ display: 'flex', gap: '24px', justifyContent: 'flex-start' }}>
        <SelectionTile
          icon="sprites"
          title="New Sprite"
          selected={selectedType === 'sprite'}
          onClick={() => setSelectedType('sprite')}
        />
        <SelectionTile
          icon="scenes" // Using upload icon conceptually
          title="Upload Scene"
          selected={selectedType === 'scene-upload'}
          onClick={() => setSelectedType('scene-upload')}
        />
        <SelectionTile
          icon="generate"
          title="Generate Scene"
          selected={selectedType === 'scene-gen'}
          onClick={() => setSelectedType('scene-gen')}
        />
      </div>

      {/* Description & Form Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
        <div className="card glass" style={{ padding: '24px' }}>
          {selectedType === 'sprite' && <NewSpriteForm onSuccess={(name) => onCreated('sprite', name)} />}
          {selectedType === 'scene-upload' && <NewSceneForm onSuccess={(name) => onCreated('scene', name)} />}
          {selectedType === 'scene-gen' && <GenerateSceneForm onSuccess={(name) => onCreated('scene', name)} />}
        </div>
      </div>
    </div>
  )
}

function SelectionTile({ icon, title, selected, onClick }) {
  return (
    <div className="card glass"
      onClick={onClick}
      style={{
        width: '200px',
        height: '180px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '12px',
        border: selected ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.1)',
        background: selected ? 'rgba(var(--color-primary-rgb), 0.1)' : 'transparent',
        transition: 'all 0.2s'
      }}
    >
      <Icon name={icon} size={48} />
      <h3 style={{ margin: 0 }}>{title}</h3>
    </div>
  )
}

/* --- Forms with Toast Integration --- */

function NewSpriteForm({ onSuccess }) {
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

    const promise = fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
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
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
        {loading ? <Icon name="image" className="animate-spin" /> : 'Create Sprite'}
      </button>
    </form>
  )
} function NewSceneForm({ onSuccess }) {
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

    promise.finally(() => setLoading(false));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label htmlFor="scene-name" style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Scene Name</label>
        <input id="scene-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. spooky_forest" autoFocus />
      </div>
      <div>
        <label htmlFor="scene-file" style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Original Reference Image</label>
        <input id="scene-file" type="file" onChange={e => {
          const file = e.target.files[0];
          setFile(file);
          if (file && !name) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            setName(nameWithoutExt);
          }
        }} accept="image/*" className="input" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
        {loading ? <Icon name="image" className="animate-spin" /> : 'Create Scene'}
      </button>
    </form>
  )
}

function GenerateSceneForm({ onSuccess }) {
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label htmlFor="gen-name" style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Scene Name</label>
        <input id="gen-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. magical_forest" />
      </div>
      <div>
        <label htmlFor="gen-prompt" style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Description Prompt</label>
        <textarea id="gen-prompt" className="input" style={{ width: '100%', height: '100px', resize: 'vertical' }}
          value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the scene you want to generate" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
        {loading ? <Icon name="generate" className="animate-spin" /> : 'Generate Scene'}
      </button>
    </form>
  )
}


function CollapsibleSection({ title, children, defaultOpen = false, icon }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          cursor: 'pointer',
          fontWeight: 'bold',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.8,
          fontSize: '0.9em',
          gap: '4px',
          userSelect: 'none'
        }}
      >
        <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={16} />
        {title} {icon && <span style={{ opacity: 0.5, display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.85em', marginLeft: '4px' }}>(<Icon name={icon} size={12} />)</span>}
      </div>
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default App
