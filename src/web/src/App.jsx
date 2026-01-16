// ## @DOC
// # ### Papeterie Engine: Web Dashboard
// # This React application provides a "Director's Console" for the Paper Theatre.
// # Key features:
// # - **Scene View**: A live, interactive canvas for arranging 2D sprites.
// # - **Timeline Editor**: Frame-by-frame control over animation behaviors.
// # - **AI Prompt Console**: Direct interface with the Gemini compiler.
import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { SceneDetailView } from './components/SceneDetailView';
import { Icon } from './components/Icon';
import { SettingsMenu } from './components/SettingsMenu';
import { SceneSelectionDialog } from './components/SceneSelectionDialog';
import { TopBar } from './components/TopBar';
import { usePersistentState } from './hooks/usePersistentState';
import { LoginView } from './components/LoginView';
import { PromptsView } from './components/PromptsView';
import { CreateView } from './components/CreateView';
import { SelectionTile } from './components/SelectionTile';
import { CollapsibleSection } from './components/CollapsibleSection';
import SampleTSComponent from './components/SampleTSComponent';
import { API_BASE, fetchWithTimeout } from './config';
import './App.css';

window.API_BASE = API_BASE;

function App() {
  const [sprites, setSprites] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [selectedItem, setSelectedItem] = usePersistentState('papeterie-selected-item', null);
  const [view, setView] = usePersistentState('papeterie-view', 'list');
  const [isExpanded, setIsExpanded] = usePersistentState('papeterie-is-expanded', false);

  const [user, setUser] = usePersistentState('papeterie-user', null);

  // Per-theme contrast defaults
  const THEME_CONTRAST_DEFAULTS = {
    teal: 0.74,
    dark: 0.64,
    light: 0.50,
    stark: 0.64
  };

  // Theme state with migration from 'blue' to 'teal'
  const [theme, setThemeRaw] = usePersistentState('papeterie-theme', 'teal');
  const setTheme = useCallback((newTheme) => {
    // Migrate 'blue' to 'teal'
    setThemeRaw(newTheme === 'blue' ? 'teal' : newTheme);
  }, [setThemeRaw]);

  // Per-theme contrast overrides (user adjustments saved per theme)
  const [contrastOverrides, setContrastOverrides] = usePersistentState('papeterie-contrast-overrides', {});

  // Compute current contrast: user override > theme default
  const activeTheme = theme === 'blue' ? 'teal' : (theme === 'contrast' ? 'stark' : theme);
  const contrast = contrastOverrides[activeTheme] ?? THEME_CONTRAST_DEFAULTS[activeTheme] ?? 0.60;

  // Handler that saves per-theme
  const handleContrastChange = useCallback((value) => {
    setContrastOverrides(prev => ({ ...prev, [activeTheme]: value }));
  }, [activeTheme, setContrastOverrides]);

  const [fontSize, setFontSize] = usePersistentState('papeterie-font-size', 'medium'); // small, medium, large, xl
  const [storageMode, setStorageMode] = useState('LOCAL');
  const [isInitializing, setIsInitializing] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);

  const [contextualActions, setContextualActions] = useState(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.style.colorScheme = activeTheme === 'light' ? 'light' : 'dark';
    document.documentElement.style.setProperty('--contrast-factor', contrast);
  }, [activeTheme, contrast]);

  // Apply font size to document
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  const fetchData = useCallback(async () => {
    // Skip fetching if backend is unavailable
    if (!backendAvailable) return;
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
  }, [user, storageMode, selectedItem, view, setSelectedItem, backendAvailable]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/config`, {}, 5000);
        const config = await res.json();
        setStorageMode(config.storage_mode);
        setBackendAvailable(true);
      } catch (e) {
        // Gracefully fall back to LOCAL mode when backend is unavailable
        // This prevents console spam when running frontend-only or during backend startup
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
    if (!isInitializing) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing, user]);

  if (isInitializing) {
    return (
      <div className="app-loading-container">
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
          <div className="top-bar-right-content">
            {/* 1. Play (Far Left) */}
            {contextualActions?.play && (
              <div className="contextual-play-group">
                {contextualActions.play}
                <div className="contextual-divider" />
              </div>
            )}

            {/* 2. Middle Group (Search, Open, Share, Trash) */}
            <div className="contextual-middle-group">
              {contextualActions?.search}
              <button className="btn-icon" onClick={() => setView('scene-selection')} title="Create/Open a Scene">
                <Icon name="scene" size={16} />
              </button>
              {contextualActions?.right}
            </div>

            <div className="contextual-divider" />

            {/* Settings & User Profile */}
            <SettingsMenu
              theme={activeTheme}
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

      <main className="main-content">
        {view === 'create' && (
          <CreateView
            onCreated={async (type, name) => {
              await fetchData();
              const endpoint = type === 'sprite' ? 'sprites' : 'scenes';
              const res = await fetch(`${API_BASE}/${endpoint}`);
              const data = await res.json();
              const newItem = data.find(s => s.name === name);

              if (newItem) {
                if (type === 'sprite') {
                  toast.success(`Sprite '${name}' created!`, {
                    description: "It is now available to add to your scenes."
                  });
                  setSelectedItem(null);
                  setView('list');
                } else {
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
            onCancel={() => {
              // Return to previous view
              if (selectedItem) {
                setView('scene-detail');
              } else {
                setView('list');
              }
            }}
          />
        )}

        {view === 'scene-detail' && selectedItem && (
          <SceneDetailView
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
                /* No-op: Sprite navigation disabled in favor of scene-only flow */
                console.log("Sprite open requested for", spriteName);
              } else {
                console.warn("Could not find sprite:", spriteName);
              }
            }}
          />
        )}

        {view === 'configuration' && (
          <PromptsView user={user} />
        )}

        {view === 'list' && (
          /* Default empty state */
          <div className="welcome-empty-state">
            <Icon name="app" size={64} className="welcome-icon" />
            <h2>Welcome to Papeterie</h2>
            <SampleTSComponent />
            <button className="btn btn-primary" onClick={() => setView('scene-selection')} data-testid="welcome-open-scene">Open Scene</button>
            <button className="btn" onClick={() => setView('create')} data-testid="welcome-new-project">New Project</button>
          </div>
        )}
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div >
  )
}

export default App
