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
import DOMPurify from 'dompurify';
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
    ChevronRight,
} from 'lucide-react';
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';

import { Badge, Menu } from '@autoart/ui';

import { LinkSearchCombobox } from './LinkSearchCombobox';

import {
    useActionMappings,
    useRecordMappings,
    type MappingStatus,
    type MappingEntry,
} from '../../api/hooks/mappings';
import { useMailLinksForTarget, useUnlinkEmail } from '../../api/hooks/mailMessages';
import type { MailLinkWithMessage } from '../../api/types/mail';
import { useUIStore } from '../../stores/uiStore';
import { formatTimeAgo } from '../../utils/formatTimeAgo';

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
    colorClass: 'text-ws-text-secondary',
    bgClass: 'bg-ws-bg',
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
    const Icon = entityIcons[entry.type] || fallbackIcon;
    const statusInfo = statusConfig[entry.status] || fallbackStatusConfig;
    const StatusIcon = statusInfo.icon;

    return (
        <div
            className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                'hover:bg-ws-bg',
                onNavigate && 'cursor-pointer'
            )}
            onClick={() => onNavigate?.(entry)}
        >
            {/* Entity icon */}
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-ws-text-secondary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ws-text-primary truncate">
                        {entry.title}
                    </span>
                    {entry.mode && (
                        <Badge variant="neutral" size="xs">
                            {entry.mode === 'dynamic' ? '↺' : '📌'}
                        </Badge>
                    )}
                </div>
                {entry.subtitle ? (
                    <p className="text-xs text-ws-text-secondary truncate">
                        {entry.subtitle}
                    </p>
                ) : (
                    <p className="text-xs text-ws-text-secondary capitalize">
                        {entry.type}
                    </p>
                )}
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
                <div onClick={(e) => e.stopPropagation()}>
                    <Menu>
                        <Menu.Target>
                            <button
                                className="p-1 text-ws-muted hover:text-ws-text-secondary hover:bg-slate-100 rounded transition-colors"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                        </Menu.Target>
                        <Menu.Dropdown align="end">
                            <Menu.Item
                                leftSection={<Unlink size={12} />}
                                className="text-red-600"
                                onClick={() => onUnlink(entry)}
                            >
                                Unlink
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </div>
            )}

            {/* Navigate arrow */}
            {onNavigate && !onUnlink && (
                <ExternalLink size={14} className="text-ws-muted shrink-0" />
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
            <Icon size={14} className="text-ws-muted" />
            <span className="text-xs font-medium text-ws-text-secondary uppercase tracking-wide">
                {title}
            </span>
            <Badge variant="neutral" size="xs">
                {count}
            </Badge>
        </div>
    );
}

/**
 * DOMPurify config for email HTML — strip elements that could escape
 * the container or hijack the page, but allow inline styles (emails
 * depend on them for layout).
 */
const PURIFY_CONFIG = {
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    ALLOW_ARIA_ATTR: false,
    ADD_ATTR: ['target'],
};

/**
 * Email mapping row with expand/collapse and HTML rendering.
 * File-local — only used in ActionMappingsPanel.
 */
function EmailMappingRow({
    link,
    onUnlink,
}: {
    link: MailLinkWithMessage;
    onUnlink?: (link: MailLinkWithMessage) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const { message } = link;

    const receivedLabel = message.received_at
        ? formatTimeAgo(message.received_at)
        : '';

    return (
        <div>
            {/* Collapsed header row */}
            <div
                className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer',
                    'hover:bg-[var(--ws-bg)]',
                    expanded && 'bg-[var(--ws-row-expanded-bg)]',
                )}
                onClick={() => setExpanded((v) => !v)}
            >
                {/* Mail icon */}
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-[var(--ws-text-secondary)]" />
                </div>

                {/* Subject + sender */}
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--ws-text-primary)] truncate block">
                        {message.subject || '(no subject)'}
                    </span>
                    <span className="text-xs text-[var(--ws-text-secondary)] truncate block">
                        {message.sender_name || message.sender || 'Unknown sender'}
                    </span>
                </div>

                {/* Date */}
                {receivedLabel && (
                    <span className="text-xs text-[var(--ws-text-secondary)] shrink-0">
                        {receivedLabel}
                    </span>
                )}

                {/* Chevron */}
                <ChevronRight
                    size={12}
                    className={clsx(
                        'text-[var(--ws-muted-fg)] shrink-0 transition-transform duration-150',
                        expanded && 'rotate-90',
                    )}
                />
            </div>

            {/* Expanded detail */}
            <div
                className={clsx(
                    'grid transition-[grid-template-rows] duration-150 ease-out',
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
            >
                <div
                    className={clsx(
                        'overflow-hidden transition-opacity duration-150 ease-out',
                        expanded ? 'opacity-100' : 'opacity-0',
                    )}
                >
                    <div className="px-3 pb-3 pt-1 ml-11 space-y-2">
                        {/* Body content */}
                        {message.body_html ? (
                            <div
                                className={clsx(
                                    'text-xs text-[var(--ws-text-secondary)] max-h-60 overflow-auto',
                                    'rounded border border-[var(--ws-panel-border)] p-2',
                                    '[&_*]:max-w-full [&_img]:max-w-full [&_table]:max-w-full',
                                    '[&_*]:!position-[static] [&_*]:!z-auto',
                                )}
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(message.body_html, PURIFY_CONFIG),
                                }}
                            />
                        ) : message.body_preview ? (
                            <p className="text-xs text-[var(--ws-text-secondary)] whitespace-pre-line line-clamp-3">
                                {message.body_preview}
                            </p>
                        ) : null}

                        {/* Unlink */}
                        {onUnlink && (
                            <div className="flex justify-end">
                                <button
                                    className="text-xs text-[var(--ws-text-secondary)] hover:text-[var(--ws-color-error)] transition-colors inline-flex items-center gap-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUnlink(link);
                                    }}
                                >
                                    <Unlink size={10} />
                                    Unlink
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
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
    const { data: mailLinks } = useMailLinksForTarget('action', actionId);
    const unlinkEmail = useUnlinkEmail();

    // Link picker state
    const [showLinkPicker, setShowLinkPicker] = useState(false);
    const linkButtonRef = useRef<HTMLButtonElement>(null);

    const entries = useMemo(() => {
        const recordEntries: MappingEntry[] = [];

        if (mappings) {
            for (const ref of mappings.references) {
                if (ref.source_record_id) {
                    recordEntries.push({
                        id: ref.id,
                        type: 'record',
                        title: ref.target_field_key || 'Record',
                        status: 'synced',
                        mode: ref.mode,
                    });
                }
            }
        }

        return recordEntries;
    }, [mappings]);

    const handleNavigate = useCallback((entry: MappingEntry) => {
        if (entry.type === 'record') {
            inspectRecord(entry.id, 'selection-inspector');
        } else if (entry.type === 'action') {
            inspectAction(entry.id, 'selection-inspector');
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

    const handleUnlinkEmail = useCallback((link: MailLinkWithMessage) => {
        openOverlay('confirm-unlink', {
            sourceType: 'action',
            sourceId: actionId,
            targetType: 'email',
            targetId: link.id,
            targetTitle: link.message.subject || '(no subject)',
            onConfirm: () =>
                unlinkEmail.mutateAsync({
                    messageId: link.mail_message_id,
                    linkId: link.id,
                }),
        });
    }, [actionId, openOverlay, unlinkEmail]);

    const handleLinkSelect = useCallback((type: 'action' | 'record', id: string) => {
        // TODO: Call useCreateMapping mutation
        console.log('Link:', actionId, type, id);
        setShowLinkPicker(false);
    }, [actionId]);

    // Track link picker position in state (updated when picker opens)
    const [linkPickerPosition, setLinkPickerPosition] = useState<{ top: number; left: number } | null>(null);

    // Update position when link picker opens
    useEffect(() => {
        if (showLinkPicker && linkButtonRef.current) {
            const rect = linkButtonRef.current.getBoundingClientRect();
            setLinkPickerPosition({ top: rect.bottom + 4, left: rect.left });
        } else if (!showLinkPicker) {
            setLinkPickerPosition(null);
        }
    }, [showLinkPicker]);

    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center py-8', className)}>
                <RefreshCw size={16} className="animate-spin mr-2 text-ws-muted" />
                <span className="text-sm text-ws-muted">Loading mappings...</span>
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

    const hasAnyEntries = entries.length > 0 || (mailLinks?.length ?? 0) > 0;

    if (!hasAnyEntries) {
        return (
            <div className={clsx('text-center py-8 text-ws-muted', className)}>
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
                {linkPickerPosition && (
                    <LinkSearchCombobox
                        position={linkPickerPosition}
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
                {linkPickerPosition && (
                    <LinkSearchCombobox
                        position={linkPickerPosition}
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
            {(mailLinks?.length ?? 0) > 0 && (
                <div>
                    <SectionHeader title="Emails" count={mailLinks!.length} icon={Mail} />
                    <div className="space-y-1">
                        {mailLinks!.map((link) => (
                            <EmailMappingRow
                                key={link.id}
                                link={link}
                                onUnlink={handleUnlinkEmail}
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
            <div className="pt-4 border-t border-ws-panel-border">
                <p className="text-xs text-ws-text-secondary mb-2">Status indicators</p>
                <div className="flex flex-wrap gap-3">
                    {Object.entries(statusConfig).map(([status, config]) => {
                        const StatusIcon = config.icon;
                        return (
                            <div key={status} className="flex items-center gap-1 text-xs text-ws-text-secondary">
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
                <RefreshCw size={16} className="animate-spin mr-2 text-ws-muted" />
                <span className="text-sm text-ws-muted">Loading mappings...</span>
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
            <div className={clsx('text-center py-8 text-ws-muted', className)}>
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
                                onNavigate={() => inspectAction(ref.actionId, 'selection-inspector')}
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
        <div className={clsx('text-center py-8 text-ws-muted', className)}>
            <Link2 size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select an action or record</p>
        </div>
    );
}

export default MappingsPanel;
