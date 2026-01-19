/**
 * Collection Item Card
 * 
 * Card component for displaying a selection in the collection list.
 * Shows type icon, label, value preview, remove button, and drag handle.
 */

import { Package, Folder, ListBullets, Lightning, Bell, X, DotsSixVertical } from '@phosphor-icons/react';
import type { SelectionReference, SelectionType } from '../../stores';

// ---------------------------------------------------------------------------
// Type Icons
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<SelectionType, React.ComponentType<{ size?: number; className?: string }>> = {
    record: Package,
    field: ListBullets,
    node: Folder,
    action: Lightning,
    event: Bell,
    artist: Package,
};

const TYPE_LABELS: Record<SelectionType, string> = {
    record: 'Record',
    field: 'Field',
    node: 'Node',
    action: 'Action',
    event: 'Event',
    artist: 'Artist',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CollectionItemCardProps {
    item: SelectionReference;
    onRemove: (id: string) => void;
    isDragging?: boolean;
}

export function CollectionItemCard({ item, onRemove, isDragging = false }: CollectionItemCardProps) {
    const Icon = TYPE_ICONS[item.type];
    const typeLabel = TYPE_LABELS[item.type];

    return (
        <div
            className={`
        flex items-center gap-3 p-3 rounded-lg border
        ${isDragging ? 'border-violet-400 bg-violet-50 shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300'}
        transition-all duration-150
      `}
        >
            {/* Drag handle */}
            <button
                type="button"
                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                aria-label="Drag to reorder"
            >
                <DotsSixVertical size={16} weight="bold" />
            </button>

            {/* Type icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center">
                <Icon size={16} className="text-slate-600" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        {typeLabel}
                    </span>
                    {item.fieldKey && (
                        <span className="text-xs text-slate-400">• {item.fieldKey}</span>
                    )}
                </div>
                <div className="text-sm font-medium text-slate-900 truncate">
                    {item.displayLabel}
                </div>
                {item.value !== undefined && (
                    <div className="text-xs text-slate-500 truncate">
                        {typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}
                    </div>
                )}
            </div>

            {/* Remove button */}
            <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="flex-shrink-0 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label="Remove from collection"
            >
                <X size={14} weight="bold" />
            </button>
        </div>
    );
}
