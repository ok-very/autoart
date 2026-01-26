/**
 * MappingsPanel
 *
 * Inspector panel showing cross-entity mappings:
 * - Email ↔ Record links
 * - Action ↔ Record references
 * - Action ↔ Email links
 *
 * Displays mapping status (synced, drift, broken) with visual indicators.
 */

import { clsx } from 'clsx';
import {
    Link2,
    Mail,
    FileText,
    Target,
    ExternalLink,
    RefreshCw,
    AlertTriangle,
    Check,
    AlertCircle,
    Plus,
    MoreHorizontal,
    Unlink,
} from 'lucide-react';
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';

import { Badge } from '@autoart/ui';

import { LinkSearchCombobox } from './LinkSearchCombobox';

import {
    useActionMappings,
    useRecordMappings,
    toMappingEntries,
    type MappingStatus,
    type MappingEntry,
} from '../../api/hooks/mappings';
import { useUIStore } from '../../stores/uiStore';

export interface MappingsPanelProps {
    /** Action ID to show mappings for (mutually exclusive with recordId) */
    actionId?: string | null;
    /** Record ID to show mappings for (mutually exclusive with actionId) */
    recordId?: string | null;
    /** Additional className */
    className?: string;
}

/**
 * Status indicator configuration
 */
const statusConfig: Record<MappingStatus, {
    icon: typeof Check;
    colorClass: string;
    bgClass: string;
    label: string;
}> = {
    synced: {
        icon: Check,
        colorClass: 'text-green-600',
        bgClass: 'bg-green-50',
        label: 'Synced',
    },
    drift: {
        icon: AlertTriangle,
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        label: 'Drift detected',
    },
    broken: {
        icon: AlertCircle,
        colorClass: 'text-red-600',
        bgClass: 'bg-red-50',
        label: 'Broken link',
    },
};

/**
 * Fallback status config for unknown statuses
 */
const fallbackStatusConfig = {
    icon: Check,
    colorClass: 'text-slate-600',
    bgClass: 'bg-slate-50',
    label: 'Unknown',
};

/**
 * Entity type icon mapping
 */
const entityIcons: Record<MappingEntry['type'], typeof Mail> = {
    email: Mail,
    record: FileText,
    action: Target,
    document: FileText,
};

/**
 * Single mapping entry row
 */
/**
 * Fallback icon for unknown entity types
 */
const fallbackIcon = FileText;

function MappingRow({
    entry,
    onNavigate,
    onUnlink,
}: {
    entry: MappingEntry;
    onNavigate?: (entry: MappingEntry) => void;
    onUnlink?: (entry: MappingEntry) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const Icon = entityIcons[entry.type] || fallbackIcon;
    const statusInfo = statusConfig[entry.status] || fallbackStatusConfig;
    const StatusIcon = statusInfo.icon;

    // Close menu on Escape and handle focus
    useEffect(() => {
        if (!showMenu) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowMenu(false);
                menuButtonRef.current?.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        // Focus the menu when opened
        menuRef.current?.querySelector('button')?.focus();

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showMenu]);

    return (
        <div
            className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                'hover:bg-slate-50',
                onNavigate && 'cursor-pointer'
            )}
            onClick={() => onNavigate?.(entry)}
        >
            {/* Entity icon */}
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-slate-600" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 truncate">
                        {entry.title}
                    </span>
                    {entry.mode && (
                        <Badge variant="neutral" size="xs">
                            {entry.mode === 'dynamic' ? '↺' : '📌'}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-slate-500 capitalize">
                    {entry.type}
                </p>
            </div>

            {/* Status indicator */}
            <div
                className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded text-xs',
                    statusInfo.bgClass,
                    statusInfo.colorClass
                )}
                title={statusInfo.label}
            >
                <StatusIcon size={12} />
            </div>

            {/* Actions menu */}
            {onUnlink && (
                <div className="relative">
                    <button
                        ref={menuButtonRef}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(prev => !prev);
                        }}
                        aria-haspopup="menu"
                        aria-expanded={showMenu}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                        <MoreHorizontal size={14} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div
                                ref={menuRef}
                                role="menu"
                                aria-label="Mapping actions"
                                className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[120px]"
                            >
                                <button
                                    role="menuitem"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onUnlink(entry);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <Unlink size={12} />
                                    Unlink
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Navigate arrow */}
            {onNavigate && !onUnlink && (
                <ExternalLink size={14} className="text-slate-400 shrink-0" />
            )}
        </div>
    );
}

/**
 * Section header
 */
function SectionHeader({
    title,
    count,
    icon: Icon,
}: {
    title: string;
    count: number;
    icon: typeof Link2;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2">
            <Icon size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {title}
            </span>
            <Badge variant="neutral" size="xs">
                {count}
            </Badge>
        </div>
    );
}

/**
 * MappingsPanel for Action
 */
function ActionMappingsPanel({
    actionId,
    className,
}: {
    actionId: string;
    className?: string;
}) {
    const { inspectRecord, inspectAction, openOverlay } = useUIStore();
    const { data: mappings, isLoading, error } = useActionMappings(actionId);

    // Link picker state
    const [showLinkPicker, setShowLinkPicker] = useState(false);
    const linkButtonRef = useRef<HTMLButtonElement>(null);

    const entries = useMemo(() => {
        if (!mappings) return [];
        return toMappingEntries(mappings);
    }, [mappings]);

    const handleNavigate = useCallback((entry: MappingEntry) => {
        if (entry.type === 'record') {
            inspectRecord(entry.id);
        } else if (entry.type === 'action') {
            inspectAction(entry.id);
        }
    }, [inspectRecord, inspectAction]);

    const handleUnlink = useCallback((entry: MappingEntry) => {
        openOverlay('confirm-unlink', {
            sourceType: 'action',
            sourceId: actionId,
            targetType: entry.type,
            targetId: entry.id,
            targetTitle: entry.title,
            onConfirm: async () => {
                // TODO: Wire useDeleteMapping mutation when backend endpoint is ready
                console.warn('[MappingsPanel] Unlink not yet implemented - mutation hook needed');
                // For now, just close the overlay without action
                // When implemented: await deleteMapping({ sourceId: actionId, targetId: entry.id });
            },
        });
    }, [actionId, openOverlay]);

    const handleLinkSelect = useCallback((type: 'action' | 'record', id: string) => {
        // TODO: Call useCreateMapping mutation
        console.log('Link:', actionId, type, id);
        setShowLinkPicker(false);
    }, [actionId]);

    const getLinkPickerPosition = useCallback(() => {
        if (!linkButtonRef.current) return null;
        const rect = linkButtonRef.current.getBoundingClientRect();
        return { top: rect.bottom + 4, left: rect.left };
    }, []);

    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center py-8', className)}>
                <RefreshCw size={16} className="animate-spin mr-2 text-slate-400" />
                <span className="text-sm text-slate-400">Loading mappings...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={clsx('text-center py-8 text-red-500', className)}>
                <p className="text-sm">Failed to load mappings</p>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className={clsx('text-center py-8 text-slate-400', className)}>
                <Link2 size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No mappings yet</p>
                <p className="text-xs mt-1">
                    Link records or emails to see them here
                </p>
                <button
                    ref={linkButtonRef}
                    onClick={() => setShowLinkPicker(true)}
                    className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1"
                >
                    <Plus size={12} />
                    Link...
                </button>
                {showLinkPicker && getLinkPickerPosition() && (
                    <LinkSearchCombobox
                        position={getLinkPickerPosition()!}
                        targetTypes={['action', 'record']}
                        onSelect={handleLinkSelect}
                        onClose={() => setShowLinkPicker(false)}
                    />
                )}
            </div>
        );
    }

    // Group by type
    const recordEntries = entries.filter((e) => e.type === 'record');
    const emailEntries = entries.filter((e) => e.type === 'email');
    const actionEntries = entries.filter((e) => e.type === 'action');

    return (
        <div className={clsx('space-y-4', className)}>
            {/* Link button */}
            <div className="flex justify-end px-3">
                <button
                    ref={linkButtonRef}
                    onClick={() => setShowLinkPicker(true)}
                    className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex items-center gap-1"
                >
                    <Plus size={12} />
                    Link...
                </button>
                {showLinkPicker && getLinkPickerPosition() && (
                    <LinkSearchCombobox
                        position={getLinkPickerPosition()!}
                        targetTypes={['action', 'record']}
                        onSelect={handleLinkSelect}
                        onClose={() => setShowLinkPicker(false)}
                    />
                )}
            </div>

            {/* Records section */}
            {recordEntries.length > 0 && (
                <div>
                    <SectionHeader title="Records" count={recordEntries.length} icon={FileText} />
                    <div className="space-y-1">
                        {recordEntries.map((entry) => (
                            <MappingRow
                                key={entry.id}
                                entry={entry}
                                onNavigate={handleNavigate}
                                onUnlink={handleUnlink}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Emails section */}
            {emailEntries.length > 0 && (
                <div>
                    <SectionHeader title="Emails" count={emailEntries.length} icon={Mail} />
                    <div className="space-y-1">
                        {emailEntries.map((entry) => (
                            <MappingRow
                                key={entry.id}
                                entry={entry}
                                onNavigate={handleNavigate}
                                onUnlink={handleUnlink}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Actions section */}
            {actionEntries.length > 0 && (
                <div>
                    <SectionHeader title="Related Actions" count={actionEntries.length} icon={Target} />
                    <div className="space-y-1">
                        {actionEntries.map((entry) => (
                            <MappingRow
                                key={entry.id}
                                entry={entry}
                                onNavigate={handleNavigate}
                                onUnlink={handleUnlink}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Status legend */}
            <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Status indicators</p>
                <div className="flex flex-wrap gap-3">
                    {Object.entries(statusConfig).map(([status, config]) => {
                        const StatusIcon = config.icon;
                        return (
                            <div key={status} className="flex items-center gap-1 text-xs text-slate-500">
                                <StatusIcon size={12} className={config.colorClass} />
                                <span>{config.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * MappingsPanel for Record
 */
function RecordMappingsPanel({
    recordId,
    className,
}: {
    recordId: string;
    className?: string;
}) {
    const { inspectAction } = useUIStore();
    const { data: mappings, isLoading, error } = useRecordMappings(recordId);

    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center py-8', className)}>
                <RefreshCw size={16} className="animate-spin mr-2 text-slate-400" />
                <span className="text-sm text-slate-400">Loading mappings...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={clsx('text-center py-8 text-red-500', className)}>
                <p className="text-sm">Failed to load mappings</p>
            </div>
        );
    }

    const hasReferencingActions = mappings?.referencingActions && mappings.referencingActions.length > 0;
    const hasLinks = mappings?.links && (mappings.links.outgoing.length > 0 || mappings.links.incoming.length > 0);

    if (!hasReferencingActions && !hasLinks) {
        return (
            <div className={clsx('text-center py-8 text-slate-400', className)}>
                <Link2 size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No mappings yet</p>
                <p className="text-xs mt-1">
                    This record is not referenced by any actions
                </p>
            </div>
        );
    }

    return (
        <div className={clsx('space-y-4', className)}>
            {/* Referencing actions */}
            {hasReferencingActions && (
                <div>
                    <SectionHeader
                        title="Referenced by"
                        count={mappings!.referencingActions.length}
                        icon={Target}
                    />
                    <div className="space-y-1">
                        {mappings!.referencingActions.map((ref) => (
                            <MappingRow
                                key={ref.actionId}
                                entry={{
                                    id: ref.actionId,
                                    type: 'action',
                                    title: ref.actionTitle,
                                    status: 'synced',
                                    mode: ref.mode,
                                }}
                                onNavigate={() => inspectAction(ref.actionId)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Record links */}
            {hasLinks && (
                <>
                    {mappings!.links.outgoing.length > 0 && (
                        <div>
                            <SectionHeader
                                title="Links to"
                                count={mappings!.links.outgoing.length}
                                icon={ExternalLink}
                            />
                            <div className="space-y-1">
                                {mappings!.links.outgoing.map((link) => (
                                    <MappingRow
                                        key={link.id}
                                        entry={{
                                            id: link.target_record_id,
                                            type: 'record',
                                            title: link.target_record?.unique_name || 'Unknown record',
                                            status: 'synced',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {mappings!.links.incoming.length > 0 && (
                        <div>
                            <SectionHeader
                                title="Linked from"
                                count={mappings!.links.incoming.length}
                                icon={Link2}
                            />
                            <div className="space-y-1">
                                {mappings!.links.incoming.map((link) => (
                                    <MappingRow
                                        key={link.id}
                                        entry={{
                                            id: link.source_record_id,
                                            type: 'record',
                                            title: link.source_record?.unique_name || 'Unknown record',
                                            status: 'synced',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * MappingsPanel Component
 */
export function MappingsPanel({
    actionId,
    recordId,
    className,
}: MappingsPanelProps) {
    // Determine which panel to show
    if (actionId) {
        return <ActionMappingsPanel actionId={actionId} className={className} />;
    }

    if (recordId) {
        return <RecordMappingsPanel recordId={recordId} className={className} />;
    }

    // Empty state
    return (
        <div className={clsx('text-center py-8 text-slate-400', className)}>
            <Link2 size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select an action or record</p>
        </div>
    );
}

export default MappingsPanel;
