/**
 * Collection Item Card
 * 
 * Card component for displaying a selection in the collection list.
 * Shows type icon, label, value preview, remove button, and drag handle.
 */

import { Package, Folder, ListBullets, Lightning, Bell, X, DotsSixVertical } from '@phosphor-icons/react';
import type { SelectionReference, SelectionType } from '../../../stores';

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
    // Fallback for unknown types to prevent runtime crash
    const Icon = TYPE_ICONS[item.type] ?? Package;
    const typeLabel = TYPE_LABELS[item.type] ?? 'Unknown';

    return (
        <div
            className="flex items-center gap-3 p-3 rounded-lg border transition-all duration-150"
            style={isDragging
                ? {
                    borderColor: 'var(--ws-accent, #3F5C6E)',
                    background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 6%, transparent)',
                    boxShadow: '0 4px 12px -2px rgba(0,0,0,0.12)',
                }
                : {
                    borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                    background: 'var(--ws-bg, #F5F2ED)',
                }
            }
        >
            {/* Drag handle */}
            <button
                type="button"
                className="cursor-grab active:cursor-grabbing text-ws-muted hover:text-ws-text-secondary"
                aria-label="Drag to reorder"
            >
                <DotsSixVertical size={16} weight="bold" />
            </button>

            {/* Type icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--ws-text-disabled, #8C8C88) 12%, transparent)' }}>
                <Icon size={16} className="text-ws-text-secondary" />
            </div>

            {/* Content */}
            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Header: Label & ID */}
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-ws-muted uppercase tracking-wider">
                        {typeLabel}
                    </span>
                    {/* Show display label as subtext if value exists, otherwise it's the main text */}
                    {!!item.value && (
                        <>
                            <span className="text-[10px] text-ws-muted">•</span>
                            <span className="text-[10px] text-ws-text-secondary font-medium truncate max-w-[120px]">
                                {item.displayLabel}
                            </span>
                        </>
                    )}
                </div>

                {/* Primary Content: Value or Label */}
                <div className="text-sm font-semibold text-ws-fg truncate" title={String(item.value || item.displayLabel)}>
                    {item.value ? String(item.value) : item.displayLabel}
                </div>

                {/* Footer: ID/Key if needed */}
                <div className="text-[10px] text-ws-muted truncate mt-0.5 font-mono">
                    {item.fieldKey || item.sourceId}
                </div>
            </div>

            {/* Remove button */}
            <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="flex-shrink-0 p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                onMouseOver={(e) => {
                    e.currentTarget.style.color = 'var(--ws-color-error, #8C4A4A)';
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--ws-color-error, #8C4A4A) 10%, transparent)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.color = 'var(--ws-text-disabled, #8C8C88)';
                    e.currentTarget.style.background = 'transparent';
                }}
                aria-label="Remove from collection"
            >
                <X size={14} weight="bold" />
            </button>
        </div >
    );
}
