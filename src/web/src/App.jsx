import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { GenericDetailView } from './components/GenericDetailView';
import { Icon } from './components/Icon';
import { SettingsMenu } from './components/SettingsMenu';
import { SceneSelectionDialog } from './components/SceneSelectionDialog';
import { TopBar } from './components/TopBar';
import { usePersistentState } from './hooks/usePersistentState';
import { LoginView } from './components/LoginView';
import { PromptsView } from './components/PromptsView';

// Use window.location to determine API base dynamically if not explicit
// This handles different ports or network access
const protocol = window.location.protocol;
const hostname = window.location.hostname;
const port = "8000"; // Assuming backend is always on 8000 for now, or use window.location.port if proxied
// If we are on port 5173 (dev), backend is on 8000. 
// If we are on prod, it might be same origin /api.
const isDev = window.location.port === "5173";
const API_BASE = isDev ? `${protocol}//${hostname}:${port}/api` : `${protocol}//${hostname}:${window.location.port || 80}/api`;

window.API_BASE = API_BASE;

function App() {
  const [sprites, setSprites] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [selectedItem, setSelectedItem] = usePersistentState('papeterie-selected-item', null);
  const [view, setView] = usePersistentState('papeterie-view', 'list');
  const [isExpanded, setIsExpanded] = usePersistentState('papeterie-is-expanded', false);

  const [user, setUser] = usePersistentState('papeterie-user', null);
  const [theme, setTheme] = usePersistentState('papeterie-theme', 'purple');
  const [contrast, setContrast] = usePersistentState('papeterie-contrast', 0.60); // 0.0 - 1.0, 0.60 is "Natural" pivot
  const [fontSize, setFontSize] = usePersistentState('papeterie-font-size', 'medium'); // small, medium, large, xl
  const [storageMode, setStorageMode] = useState('LOCAL');
  const [isInitializing, setIsInitializing] = useState(true);

  // Apply theme to document
  useEffect(() => {
    // Migrate old contrast theme to stark
    const activeTheme = theme === 'contrast' ? 'stark' : theme;
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.style.colorScheme = activeTheme === 'light' ? 'light' : 'dark';
    document.documentElement.style.setProperty('--contrast-factor', contrast);
  }, [theme, contrast]);

  // Apply font size to document
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  const fetchData = useCallback(async () => {
    if (!user && storageMode !== 'LOCAL') return;

    try {
      const headers = user ? { 'Authorization': `Bearer ${user.access_token}` } : {};
      const [spriteRes, sceneRes] = await Promise.all([
        fetch(`${API_BASE}/sprites`, { headers }),
        fetch(`${API_BASE}/scenes`, { headers })
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
  }, [user, storageMode, selectedItem, view, setSelectedItem]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_BASE}/config`);
        const config = await res.json();
        setStorageMode(config.storage_mode);
      } catch (e) {
        console.error("Failed to load config", e);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing, user]);

  if (isInitializing) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-base)' }}>
        <div className="animate-spin"><Icon name="generate" size={48} color="var(--color-primary)" /></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={(userData) => setUser(userData)} storageMode={storageMode} />;
  }

  const handleLogout = () => {
    setUser(null);
    setSelectedItem(null);
  };

  return (
    <div className="app-container">
      <TopBar
        title="Papeterie"
        leftContent={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setView('scene-selection')} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Icon name="folder" size={14} /> Open
            </button>
            {/* Future: Add Recent Files here */}
          </div>
        }
        rightContent={
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setView('create')} title="New">
              <Icon name="add" size={16} />
            </button>
            <SettingsMenu
              theme={theme}
              onThemeChange={setTheme}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              contrast={contrast}
              onContrastChange={setContrast}
              onLogout={handleLogout}
              user={user}
            />
          </div>
        }
      />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {view === 'create' && (
          <CreateView
            onCreated={async (type, name) => {
              await fetchData();
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

        {view === 'scene-selection' && (
          <SceneSelectionDialog
            scenes={scenes}
            onSelect={(scene) => {
              setSelectedItem(scene);
              setView('scene-detail');
            }}
          />
        )}

        {/* Temporary: Sprite list for debugging or direct access if needed, though plan puts this in a dialog */}





        {view === 'scene-detail' && selectedItem && (
          <GenericDetailView
            type="scene"
            asset={selectedItem}
            sprites={sprites}
            refresh={fetchData}
            onDelete={() => { setSelectedItem(null); setView('list'); }}
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

        {view === 'configuration' && (
          <PromptsView user={user} />
        )}

        {view === 'list' && (
          /* Default empty state */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, flexDirection: 'column', gap: '16px' }}>
            <Icon name="app" size={64} opacity={0.2} />
            <h2>Welcome to Papeterie</h2>
            <button className="btn btn-primary" onClick={() => setView('scene-selection')}>Open Scene</button>
            <button className="btn" onClick={() => setView('create')}>New Project</button>
          </div>
        )}
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div >
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
