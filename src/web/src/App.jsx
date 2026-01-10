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
import { API_BASE, fetchWithTimeout } from './config';

window.API_BASE = API_BASE;

import { createAssetRepository } from './repositories/AssetRepository';

// ... imports ...

function App() {
  const [sprites, setSprites] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [selectedItem, setSelectedItem] = usePersistentState('papeterie-selected-item', null);
  const [view, setView] = usePersistentState('papeterie-view', 'list');
  const [isExpanded, setIsExpanded] = usePersistentState('papeterie-is-expanded', false);

  const [user, setUser] = usePersistentState('papeterie-user', null);

  // Repository Instance
  const [repo, setRepo] = useState(null);

  // Per-theme contrast defaults
  const [contrastOverrides, setContrastOverrides] = usePersistentState('papeterie-contrast-overrides', {});
  const [theme, setTheme] = usePersistentState('papeterie-theme', 'teal');

  // Derived contrast
  const contrast = contrastOverrides[theme] || 'standard';

  const handleContrastChange = (newContrast) => {
    setContrastOverrides(prev => ({ ...prev, [theme]: newContrast }));
  };

  // Font Size
  const [fontSize, setFontSize] = usePersistentState('papeterie-font-size', 'medium');
  const [storageMode, setStorageMode] = useState('LOCAL');
  const [isInitializing, setIsInitializing] = useState(true);
  const [_backendAvailable, setBackendAvailable] = useState(true); // prefixed unused

  const [contextualActions, setContextualActions] = useState(null);

  // Apply theme/font effects ... (unchanged) ...

  // Initialize Repository when dependencies change
  useEffect(() => {
    if (isInitializing) return;
    const token = user ? user.access_token : null;
    const newRepo = createAssetRepository(storageMode, token);
    setRepo(newRepo);
  }, [storageMode, user, isInitializing]);

  const fetchData = useCallback(async () => {
    if (!repo) return;
    // Skip if backend is unavailable AND we are in server mode?
    // Local mode doesn't need backend for fetching (only processing).

    try {
      const [spriteData, sceneData] = await Promise.all([
        repo.getSprites(),
        repo.getScenes()
      ]);

      // Alphabetize
      spriteData.sort((a, b) => a.name.localeCompare(b.name));
      sceneData.sort((a, b) => a.name.localeCompare(b.name));

      setSprites(spriteData);
      setScenes(sceneData);

      // Refresh selected item logic ...
      if (selectedItem) {
        const typeList = view === 'sprite-detail' ? spriteData : sceneData;
        const freshItem = typeList.find(i => i.name === selectedItem.name);
        if (freshItem) setSelectedItem(freshItem);
      }

    } catch (e) {
      console.error("Failed to fetch data", e);
      toast.error("Failed to fetch data", { description: e.message });
    }
  }, [repo, selectedItem, view, setSelectedItem]);

  // Initial Config Load
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/config`, {}, 5000);
        const config = await res.json();
        setStorageMode(config.storage_mode);
        setBackendAvailable(true);
      } catch (e) {
        if (e.message === 'Request timed out' || e.message?.includes('Failed to fetch')) {
          console.warn('Backend unavailable, running in offline mode with LOCAL storage');
        } else {
          console.error('Failed to load config', e);
        }
        setBackendAvailable(false);
        setStorageMode('LOCAL');
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (repo) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

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

  const appTitle = (view === 'scene-detail' || view === 'sprite-detail') && selectedItem ? selectedItem.name : "Papeterie";

  return (
    <div className="app-container">
      <TopBar
        title={appTitle}
        leftContent={null}
        rightContent={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* 1. Play (Far Left) */}
            {contextualActions?.play && (
              <>
                {contextualActions.play}
                <div style={{ width: '1px', height: '20px', background: 'var(--color-divider)' }} />
              </>
            )}

            {/* 2. Middle Group (Search, Open, Share, Trash) */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {contextualActions?.search}
              <button className="btn-icon" onClick={() => setView('scene-selection')} title="Create/Open a Scene">
                <Icon name="scene" size={16} />
              </button>
              {contextualActions?.right}
            </div>

            <div style={{ width: '1px', height: '20px', background: 'var(--color-divider)' }} />

            {/* Settings & User Profile */}
            <SettingsMenu
              theme={theme}
              onThemeChange={setTheme}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              contrast={contrast}
              onContrastChange={handleContrastChange}
              onResetAll={() => {
                // Reset all persisted layout and contrast settings
                setContrastOverrides({});
                setFontSize('medium');
                localStorage.removeItem('papeterie-panel-split');
                localStorage.removeItem('papeterie-theatre-timeline-split');
                localStorage.removeItem('papeterie-toolbar-camera-pos');
                localStorage.removeItem('papeterie-toolbar-sprite-pos');
                window.location.reload(); // Reload to apply
              }}
              onLogout={handleLogout}
              user={user}
            />
          </div>
        }
      />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {view === 'create' && (
          <CreateView
            repo={repo}
            onCreated={async (type, name) => {
              await fetchData();
              // Refreshing data via fetchData should update sprites/scenes state.
              // To set selected, we can just find it in the NEW state...
              // But setSprites/setScenes is async. 
              // We'll rely on next render or just refetch directly for the item?
              // Existing code did a fetch. We should use repo.

              if (type === 'sprite') {
                const items = await repo.getSprites();
                const newItem = items.find(s => s.name === name);
                if (newItem) {
                  setSelectedItem(newItem);
                  setView('sprite-detail');
                }
              } else {
                const items = await repo.getScenes(); // if implemented
                const newItem = items.find(s => s.name === name);
                if (newItem) {
                  setSelectedItem(newItem);
                  setView('scene-detail');
                }
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
            onCreate={() => setView('create')}
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
            setContextualActions={setContextualActions}
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
            repo={repo}
          />
        )}

        {view === 'sprite-detail' && selectedItem && (
          <GenericDetailView
            type="sprite"
            asset={selectedItem}
            sprites={sprites}
            refresh={fetchData}
            onDelete={() => { setSelectedItem(null); setView('list'); }}
            isExpanded={isExpanded}
            toggleExpand={() => setIsExpanded(!isExpanded)}
            setContextualActions={setContextualActions}
            repo={repo}
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
            <button className="btn btn-primary" onClick={() => setView('scene-selection')} data-testid="welcome-open-scene">Open Scene</button>
            <button className="btn" onClick={() => setView('create')} data-testid="welcome-new-project">New Project</button>
          </div>
        )}
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div >
  )
}


function SelectionTile({ icon, title, selected, onClick, ...props }) {
  return (
    <div
      onClick={onClick}
      className={`card ${selected ? 'active' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '24px',
        width: '160px',
        cursor: 'pointer',
        border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        background: selected ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
        opacity: selected ? 1 : 0.7,
        transition: 'all 0.2s'
      }}
      {...props}
    >
      <Icon name={icon} size={32} color={selected ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
      <span style={{ fontWeight: 600, color: selected ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>{title}</span>
    </div>
  );
}

function CreateView({ onCreated, repo }) {
  const [selectedType, setSelectedType] = useState('scene-gen'); // 'sprite' | 'scene-upload' | 'scene-gen'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '24px', height: '100%', overflowY: 'auto' }}>

      {/* Selection Tiles */}
      <div style={{ display: 'flex', gap: '24px', justifyContent: 'flex-start' }}>
        <SelectionTile
          icon="generate"
          title="Generate Scene"
          selected={selectedType === 'scene-gen'}
          onClick={() => setSelectedType('scene-gen')}
          data-testid="create-option-generate-scene"
        />
        <SelectionTile
          icon="scene"
          title="Upload Scene"
          selected={selectedType === 'scene-upload'}
          onClick={() => setSelectedType('scene-upload')}
          data-testid="create-option-upload-scene"
        />
        <SelectionTile
          icon="sprites"
          title="Upload Sprite"
          selected={selectedType === 'sprite'}
          onClick={() => setSelectedType('sprite')}
          data-testid="create-option-upload-sprite"
        />
      </div>

      {/* Description & Form Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
        <div className="card glass" style={{ padding: '24px' }}>
          {selectedType === 'sprite' && <NewSpriteForm onSuccess={(name) => onCreated('sprite', name)} repo={repo} />}
          {selectedType === 'scene-upload' && <NewSceneForm onSuccess={(name) => onCreated('scene', name)} repo={repo} />}
          {selectedType === 'scene-gen' && <GenerateSceneForm onSuccess={(name) => onCreated('scene', name)} />}
        </div>
      </div>
    </div>
  )
}

// ... SelectionTile ...

/* --- Forms with Toast Integration --- */

function NewSpriteForm({ onSuccess, repo }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !name) {
      toast.error("Missing Information", { description: "Please provide both a name and an image." });
      return;
    }
    if (!repo) {
      toast.error("Repository not initialized");
      return;
    }

    setLoading(true);

    // Use the repository
    const promise = repo.saveSprite(name, file)
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
        {loading ? <Icon name="image" className="animate-spin" /> : 'Upload Sprite'}
      </button>
    </form>
  )
} function NewSceneForm({ onSuccess, repo }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !name) {
      toast.error("Missing Information", { description: "Please provide both a name and an image." });
      return;
    }
    if (!repo) {
      toast.error("Repository not initialized");
      return;
    }

    setLoading(true);

    const promise = repo.saveScene(name, file)
      .then(async data => {
        await new Promise(r => setTimeout(r, 500));
        onSuccess(data.name);
        return data.name;
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
      <button type="submit" className="btn btn-primary" data-testid="upload-scene-submit" disabled={loading} style={{ alignSelf: 'flex-start' }}>
        {loading ? <Icon name="image" className="animate-spin" /> : 'Upload Scene'}
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
