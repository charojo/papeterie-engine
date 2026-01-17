import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { API_BASE } from '../config';
import { useOptimization } from './useOptimization';
import { useAssetLogs } from './useAssetLogs';
import { useBehaviorEditor } from './useBehaviorEditor';
import { useLayerOperations } from './useLayerOperations';
import { useTransformEditor } from './useTransformEditor';
import { useHistory } from './useHistory';
import { UpdateConfigCommand } from '../utils/Commands';

/**
 * Hook to encapsulate logic for asset manipulation, state management, and optimization.
 * 
 * Extracted from GenericDetailView.jsx.
 * 
 * @param {string} type - 'sprite' or 'scene'
 * @param {object} asset - Asset object
 * @param {Function} refresh - Refresh callback
 * @param {Function} onDelete - Delete callback
 */
export function useAssetController(type, asset, refresh, onDelete) {
    const [selectedImage, setSelectedImage] = useState(type === 'sprite' ? asset.name : 'original');
    const [selectedSprites, setSelectedSprites] = useState([]); // Multi-selection support
    const [configPrompt, setConfigPrompt] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const { execute: executeCommand, undo, redo, canUndo, canRedo } = useHistory();

    const {
        isOptimizing,
        imageTimestamp,
        setImageTimestamp,
        visualPrompt,
        setVisualPrompt,
        processingMode,
        setProcessingMode,
        handleOptimize,
        handleRevert,
        handleSaveRotation
    } = useOptimization(type, asset, refresh);

    // Use extracted hook for log fetching and polling
    const logs = useAssetLogs(type, asset.name, isOptimizing, type === 'scene' ? refresh : null);

    // Initialization & Reset
    useEffect(() => {
        if (type === 'sprite') {
            setSelectedImage(asset.name);
            setSelectedSprites([asset.name]);
        } else {
            // Default to first sprite if available, otherwise original
            const hasSprites = asset.used_sprites && asset.used_sprites.length > 0;
            setSelectedImage(hasSprites ? asset.used_sprites[0] : 'original');
        }

        // Update timestamp on new asset
        setImageTimestamp(Date.now());

        // Load persisted prompt
        const key = `papeterie_optimize_prompt_${type}_${asset.name}`;
        const saved = localStorage.getItem(key);
        setVisualPrompt(saved || '');

        setConfigPrompt('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asset.name, type]); // Removed asset.used_sprites to prevent reset on incremental updates

    // Auto-select new sprites during optimization
    const prevSpriteCountRef = useRef(0);
    const prevAssetNameRef = useRef(asset.name);

    useEffect(() => {
        const currentCount = asset.used_sprites?.length || 0;

        // Reset ref on new asset
        if (asset.name !== prevAssetNameRef.current) {
            prevAssetNameRef.current = asset.name;
            prevSpriteCountRef.current = currentCount;
            return;
        }

        // Check for new sprites during optimization
        if (type === 'scene' && isOptimizing && currentCount > prevSpriteCountRef.current) {
            if (currentCount > 0) {
                // Select the newest sprite (last in the list)
                setSelectedImage(asset.used_sprites[currentCount - 1]);
            }
        }

        prevSpriteCountRef.current = currentCount;
    }, [asset.name, asset.used_sprites, type, isOptimizing]);

    // Persist prompt changes
    useEffect(() => {
        if (asset.name) {
            const key = `papeterie_optimize_prompt_${type}_${asset.name}`;
            localStorage.setItem(key, visualPrompt);
        }
    }, [visualPrompt, asset.name, type]);

    // --- Actions ---

    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('lastActiveTab') || 'sprites');

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        localStorage.setItem('lastActiveTab', tab);
    };

    const { handleBehaviorsChange: handleEventsChange } = useBehaviorEditor(type, asset, selectedImage, refresh, executeCommand);


    const {
        layerVisibility,
        showSpriteLibrary,
        setShowSpriteLibrary,
        toggleLayerVisibility,
        handleAddSprite,
        handleRemoveLayer,
        handleDeleteSprite,
        handleUpdateLayerOrder,
        initializeVisibility
    } = useLayerOperations(asset, refresh, executeCommand);

    const {
        handleSpritePositionChanged,
        handleSpriteRotationChanged,
        handleSpriteScaleChanged: handleSaveScale,
        handleKeyframeMove,
        handleKeyframeDelete
    } = useTransformEditor(asset, refresh, executeCommand);

    const [telemetry, setTelemetry] = useState(null);
    const handleTelemetry = useCallback((data) => {
        setTelemetry(data);
    }, []);

    const [debugOverlayMode, setDebugOverlayMode] = useState('off'); // 'on' | 'off'

    // Initialize visibility from config
    useEffect(() => {
        initializeVisibility(asset.config);
    }, [asset.config, initializeVisibility]);

    const handleUpdateConfig = async () => {
        toast.info("Config refinement coming soon!", { description: `Prompt: ${configPrompt}` });
        setConfigPrompt('');
    };

    const saveConfig = useCallback(async (newConfig, description = "Updated config") => {
        try {
            if (typeof newConfig === 'string') {
                newConfig = JSON.parse(newConfig);
            }

            if (executeCommand) {
                const command = new UpdateConfigCommand(
                    type,
                    asset.name,
                    asset.config,
                    newConfig,
                    refresh,
                    description
                );
                await executeCommand(command);
            } else {
                const endpoint = type === 'sprite' ? `sprites` : `scenes`;
                const res = await fetch(`${API_BASE}/${endpoint}/${encodeURIComponent(asset.name)}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newConfig)
                });
                if (!res.ok) throw new Error(await res.text());
                await refresh();
                toast.success(description);
            }
        } catch (e) {
            console.error("Failed to save config:", e);
            toast.error(`Failed to save config: ${e.message}`);
        }
    }, [asset.config, asset.name, type, refresh, executeCommand]);

    const handleDeleteClick = useCallback(() => {
        setShowDeleteDialog(true);
    }, []);

    const handleConfirmDelete = async (mode) => {
        const endpoint = type === 'sprite' ? `sprites` : `scenes`;
        try {
            const res = await fetch(`${API_BASE}/${endpoint}/${asset.name}?mode=${mode}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).detail);

            const data = await res.json();

            if (data.kept_sprites && data.kept_sprites.length > 0) {
                toast.warning(`Deleted scene, but preserved shared sprites: ${data.kept_sprites.join(', ')}`, { duration: 6000 });
            } else {
                toast.success(type === 'sprite' ? `Deleted sprite '${asset.name}'` : `Deleted scene '${asset.name}'`);
            }

            setShowDeleteDialog(false);
            if (onDelete) onDelete();
        } catch (e) {
            toast.error(`Deletion failed: ${e.message}`);
        }
    };

    const handleClearSelection = useCallback(() => {
        setSelectedImage('original');
        setSelectedSprites([]);
    }, []);

    const handleSpriteSelected = useCallback(async (spriteName, allSelected = null) => {
        // Toggle deselection if already selected AND single select
        if (selectedImage === spriteName && (!allSelected || allSelected.length <= 1)) {
            handleClearSelection();
            return;
        }

        // Stay on current tab if it's already a detail-oriented tab (debug or json)
        if (activeTab !== 'sprites' && activeTab !== 'debug' && activeTab !== 'json') {
            setActiveTab('sprites');
        }
        setSelectedImage(spriteName || 'original');

        if (allSelected) {
            setSelectedSprites(allSelected);
        } else if (spriteName) {
            // Fallback for single select calls
            setSelectedSprites([spriteName]);
        }

        // Z-Ordering Logic for Multi-Selection
        // REMOVED: Rule 4 Violation. Selection should not auto-reorder Z-depths.
        // See: docs/design/layer_and_selection_rules.md
        /* 
        if (type === 'scene' && (allSelected || spriteName)) {
            // ... Logic removed to prevent auto-bringing to front on select
        } 
        */
    }, [selectedImage, activeTab, handleClearSelection]);

    // --- Computed State ---

    const statusLabel = type === 'sprite'
        ? (asset.has_metadata ? "Configured" : (asset.has_original ? "Optimizing" : "Raw Sprite"))
        : ((asset.used_sprites && asset.used_sprites.length > 0) ? "Configured" : "Raw Scene");

    const configData = type === 'sprite' ? asset.metadata : asset.config;

    const activeLayer = (type === 'scene' && selectedImage !== 'original')
        ? (asset.config?.layers || []).find(l => l.sprite_name === selectedImage)
        : null;

    const currentBehaviors = type === 'sprite'
        ? (asset.metadata?.behaviors || asset.metadata?.events || [])
        : (activeLayer ? (activeLayer.behaviors || activeLayer.events || []) : []);

    // Extract behavior_guidance from the active layer (scene) or metadata (sprite)
    const behaviorGuidance = type === 'sprite'
        ? (asset.metadata?.behavior_guidance || null)
        : (activeLayer?.behavior_guidance || null);

    return {
        selectedImage,
        setSelectedImage,
        selectedSprites, // Multi-selection
        configPrompt,
        setConfigPrompt,
        showDeleteDialog,
        setShowDeleteDialog,
        isOptimizing,
        imageTimestamp,
        visualPrompt,
        setVisualPrompt,
        processingMode,
        setProcessingMode,
        handleOptimize,
        handleRevert,
        handleSaveRotation,
        logs,
        activeTab,
        handleTabChange,
        handleEventsChange,
        layerVisibility,
        showSpriteLibrary,
        setShowSpriteLibrary,
        toggleLayerVisibility,
        handleAddSprite,
        handleRemoveLayer,
        handleDeleteSprite,
        handleUpdateLayerOrder,
        handleSpritePositionChanged,
        handleSpriteRotationChanged,
        handleSaveScale,
        handleKeyframeMove,
        handleKeyframeDelete,
        telemetry,
        handleTelemetry,
        debugOverlayMode,
        setDebugOverlayMode,
        handleUpdateConfig,
        saveConfig,
        handleDeleteClick,
        handleConfirmDelete,
        handleSpriteSelected,
        handleClearSelection,
        // History management
        undo,
        redo,
        canUndo,
        canRedo,
        executeCommand,
        // Computed
        statusLabel,
        configData,
        activeLayer,
        currentBehaviors,
        behaviorGuidance
    };
}
