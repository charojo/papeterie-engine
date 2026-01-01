import {
    Dna,
    Folder,
    Palette,
    FileText,
    Trash2,
    RefreshCw,
    Wand2,
    Image as ImageIcon,
    Settings,
    X,
    Plus,
    ChevronRight,
    ChevronDown,
    Maximize,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';

const icons = {
    sprites: Dna,
    scenes: Folder,
    generate: Palette,
    logs: FileText,
    delete: Trash2,
    revert: RefreshCw,
    optimize: Wand2,
    image: ImageIcon,
    config: Settings,
    close: X,
    add: Plus,
    chevronRight: ChevronRight,
    chevronDown: ChevronDown,
    maximize: Maximize,
    zoomIn: ZoomIn,
    zoomOut: ZoomOut
};

export const Icon = ({ name, size = 16, className, ...props }) => {
    const LucideIcon = icons[name] || icons.image;
    return <LucideIcon size={size} className={className} {...props} />;
};
