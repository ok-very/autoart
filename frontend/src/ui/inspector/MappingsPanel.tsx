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
} from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@autoart/ui';

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
function MappingRow({
    entry,
    onNavigate,
}: {
    entry: MappingEntry;
    onNavigate?: (entry: MappingEntry) => void;
}) {
    const Icon = entityIcons[entry.type];
    const statusInfo = statusConfig[entry.status];
    const StatusIcon = statusInfo.icon;

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

            {/* Navigate arrow */}
            {onNavigate && (
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
    const { inspectRecord, inspectAction } = useUIStore();
    const { data: mappings, isLoading, error } = useActionMappings(actionId);

    const entries = useMemo(() => {
        if (!mappings) return [];
        return toMappingEntries(mappings);
    }, [mappings]);

    const handleNavigate = (entry: MappingEntry) => {
        if (entry.type === 'record') {
            // Extract record ID from the mapping - this would need more context
            // For now, just log the navigation intent
            console.log('Navigate to record:', entry.id);
        } else if (entry.type === 'action') {
            inspectAction(entry.id);
        }
    };

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
            </div>
        );
    }

    // Group by type
    const recordEntries = entries.filter((e) => e.type === 'record');
    const emailEntries = entries.filter((e) => e.type === 'email');
    const actionEntries = entries.filter((e) => e.type === 'action');

    return (
        <div className={clsx('space-y-4', className)}>
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
