import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AssetSelectionGrid } from './AssetSelectionGrid';
import { Icon } from './Icon';
import { ASSET_BASE } from '../config';

export function SoundPicker({ sounds, onSelect, onClose, onUpload }) {
    const [playing, setPlaying] = useState(null); // Filename of currently playing sound
    const audioRef = useRef(null);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }
    }, []);


    const handlePlay = (e, sound) => {
        e.stopPropagation(); // Don't select, just play

        if (playing === sound.filename) {
            audioRef.current.pause();
            setPlaying(null);
        } else {
            // Handle both relative (legacy/local) and absolute (new router) paths
            // The router now returns paths starting with /assets/ usually
            let url = sound.path;
            if (!url.startsWith('/') && !url.startsWith('http')) {
                url = `${ASSET_BASE}/${sound.path}`;
            }

            audioRef.current.src = url;
            audioRef.current.play().catch(err => console.warn("Preview play failed", err));
            setPlaying(sound.filename);

            audioRef.current.onended = () => setPlaying(null);
            audioRef.current.onerror = () => {
                console.warn("Audio playback error");
                setPlaying(null);
            };
        }
    };

    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setPlaying(null);
    }

    // Stop audio when component unmounts
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        }
    }, []);

    return (
        <AssetSelectionGrid
            title="Select Sound"
            items={sounds}
            onSelect={(sound) => { handleStop(); onSelect(sound); }}
            onCreate={onUpload}
            onCancel={() => { handleStop(); onClose(); }}
            createLabel="Upload Sound"
            itemIcon="sound"
            searchPlaceholder="Search sounds..."
            renderThumbnail={(sound) => (
                <div
                    className="flex justify-center items-center h-full w-full bg-surface-alt rounded cursor-pointer hover:bg-surface-hover transition-colors group"
                    onClick={(e) => handlePlay(e, sound)}
                    title={playing === sound.filename ? "Click to Pause" : "Click to Preview"}
                >
                    <Icon
                        name={playing === sound.filename ? "pause" : "play"}
                        size={24}
                        className={`transition-colors ${playing === sound.filename ? "text-primary" : "text-muted group-hover:text-text-main"}`}
                    />
                </div>
            )}
            getItemName={s => s.name}
            getItemSubtitle={s => playing === s.filename ? "Playing..." : ""}
        />
    );
}
