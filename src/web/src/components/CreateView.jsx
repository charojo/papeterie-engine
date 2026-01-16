import React, { useState } from 'react';
import { SelectionTile } from './SelectionTile';
import { NewSpriteForm } from './NewSpriteForm';
import { NewSceneForm } from './NewSceneForm';
import { GenerateSceneForm } from './GenerateSceneForm';

export function CreateView({ onCreated }) {
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
                    {selectedType === 'sprite' && <NewSpriteForm onSuccess={(name) => onCreated('sprite', name)} />}
                    {selectedType === 'scene-upload' && <NewSceneForm onSuccess={(name) => onCreated('scene', name)} />}
                    {selectedType === 'scene-gen' && <GenerateSceneForm onSuccess={(name) => onCreated('scene', name)} />}
                </div>
            </div>
        </div>
    )
}
