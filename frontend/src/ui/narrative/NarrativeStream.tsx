/**
 * NarrativeStream
 *
 * The main center content component showing the event-aware narrative stream.
 * Groups actions by status:
 * - Pending: Actions awaiting work + suggestions
 * - Active: In-progress actions with recent events
 * - Recorded: Completed facts grouped by 7 families
 *
 * This replaces/augments the traditional task list with a narrative view
 * where "what happened" is as important as "what exists now."
 */

import { clsx } from 'clsx';
import {
    Clock,
    Play,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@autoart/ui';

import type { DerivedStatus, Event, ContextType } from '@autoart/shared';
import { useActionViews, useContextEvents } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

import { NarrativeCard, type NarrativeEvent } from './NarrativeCard';
import { FactFamilyGroup, groupFactsByFamily, type FactEntry, type FactFamily } from './FactFamilyGroup';

export interface NarrativeStreamProps {
    /** Context ID to show narrative for */
    contextId?: string | null;
    /** Context type (from shared schema) */
    contextType?: ContextType;
    /** Callback when an action is selected */
    onActionSelect?: (actionId: string) => void;
    /** Additional className */
    className?: string;
}

/**
 * Status group configuration
 */
const statusGroups: Array<{
    key: 'pending' | 'active' | 'recorded';
    label: string;
    description: string;
    icon: typeof Clock;
    colorClass: string;
    bgClass: string;
    statuses: DerivedStatus[];
}> = [
    {
        key: 'pending',
        label: 'Pending',
        description: 'Actions awaiting work',
        icon: Clock,
        colorClass: 'text-slate-600',
        bgClass: 'bg-slate-50',
        statuses: ['pending'],
    },
    {
        key: 'active',
        label: 'Active',
        description: 'In-progress work',
        icon: Play,
        colorClass: 'text-blue-600',
        bgClass: 'bg-blue-50',
        statuses: ['active', 'blocked'],
    },
    {
        key: 'recorded',
        label: 'Recorded',
        description: 'Facts by category',
        icon: CheckCircle,
        colorClass: 'text-green-600',
        bgClass: 'bg-green-50',
        statuses: ['finished'],
    },
];

/**
 * Section header with collapse toggle
 */
function SectionHeader({
    label,
    description,
    icon: Icon,
    colorClass,
    bgClass,
    count,
    collapsed,
    onToggle,
}: {
    label: string;
    description: string;
    icon: typeof Clock;
    colorClass: string;
    bgClass: string;
    count: number;
    collapsed: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={clsx(
                'w-full flex items-center justify-between px-4 py-3 rounded-lg',
                bgClass,
                'hover:opacity-90 transition-opacity'
            )}
        >
            <div className="flex items-center gap-3">
                <div className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    colorClass,
                    'bg-white/80'
                )}>
                    <Icon size={16} />
                </div>
                <div className="text-left">
                    <h3 className={clsx('font-semibold text-sm', colorClass)}>
                        {label}
                    </h3>
                    <p className="text-xs text-slate-500">
                        {description}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="neutral" size="sm">
                    {count}
                </Badge>
                {collapsed ? (
                    <ChevronRight size={16} className="text-slate-400" />
                ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                )}
            </div>
        </button>
    );
}

/**
 * Convert API events to NarrativeEvent format
 */
function toNarrativeEvent(event: Event): NarrativeEvent {
    return {
        id: event.id,
        type: event.type,
        payload: event.payload as Record<string, unknown>,
        occurredAt: event.occurredAt instanceof Date
            ? event.occurredAt.toISOString()
            : String(event.occurredAt),
        actor: event.actorId || undefined,
    };
}

/**
 * Extract FACT_RECORDED events and convert to FactEntry format
 */
function extractFactEntries(
    events: Event[],
    actionTitleMap: Map<string, string>
): FactEntry[] {
    return events
        .filter((e) => e.type === 'FACT_RECORDED' && e.payload?.factKind)
        .map((e) => ({
            id: e.id,
            factKind: e.payload.factKind as string,
            payload: e.payload as any,
            occurredAt: e.occurredAt instanceof Date
                ? e.occurredAt.toISOString()
                : String(e.occurredAt),
            actionId: e.actionId || undefined,
            actionTitle: e.actionId ? actionTitleMap.get(e.actionId) : undefined,
        }));
}

/**
 * NarrativeStream Component
 */
export function NarrativeStream({
    contextId,
    contextType = 'subprocess',
    onActionSelect,
    className,
}: NarrativeStreamProps) {
    // Collapse state for sections
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    // Selected action
    const { selection, inspectAction } = useUIStore();
    const selectedActionId = selection?.type === 'action' ? selection.id : null;

    // Fetch action views for the context
    const { data: actionViews, isLoading: viewsLoading } = useActionViews(
        contextId ?? null,
        contextType
    );

    // Fetch events for the context
    const { data: events, isLoading: eventsLoading } = useContextEvents(contextId ?? null, contextType);

    // Build action title map for fact entries
    const actionTitleMap = useMemo(() => {
        const map = new Map<string, string>();
        if (actionViews) {
            for (const view of actionViews) {
                map.set(view.actionId, view.data.title);
            }
        }
        return map;
    }, [actionViews]);

    // Build events map by action ID
    const eventsByAction = useMemo(() => {
        const map = new Map<string, NarrativeEvent[]>();
        if (events) {
            for (const event of events) {
                if (event.actionId) {
                    const list = map.get(event.actionId) || [];
                    list.push(toNarrativeEvent(event));
                    map.set(event.actionId, list);
                }
            }
        }
        return map;
    }, [events]);

    // Group actions by status
    const groupedActions = useMemo(() => {
        type ActionViewList = NonNullable<typeof actionViews>;
        const groups: Record<'pending' | 'active' | 'recorded', ActionViewList> = {
            pending: [],
            active: [],
            recorded: [],
        };

        if (!actionViews) return groups;

        for (const view of actionViews) {
            const status = view.data.status;
            if (status === 'pending') {
                groups.pending.push(view);
            } else if (status === 'active' || status === 'blocked') {
                groups.active.push(view);
            } else if (status === 'finished') {
                groups.recorded.push(view);
            }
        }

        return groups;
    }, [actionViews]);

    // Extract facts from events
    const factEntries = useMemo(() => {
        if (!events) return [];
        return extractFactEntries(events, actionTitleMap);
    }, [events, actionTitleMap]);

    // Group facts by family
    const factsByFamily = useMemo(() => {
        return groupFactsByFamily(factEntries);
    }, [factEntries]);

    // Toggle section collapse
    const toggleSection = (key: string) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Handle action click
    const handleActionClick = (actionId: string) => {
        inspectAction(actionId);
        onActionSelect?.(actionId);
    };

    const isLoading = viewsLoading || eventsLoading;

    // Empty state
    if (!contextId) {
        return (
            <div className={clsx(
                'flex flex-col items-center justify-center h-64 text-slate-400',
                className
            )}>
                <Clock size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Select a context to view the narrative</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={clsx(
                'flex items-center justify-center h-64 text-slate-400',
                className
            )}>
                <RefreshCw size={20} className="animate-spin mr-2" />
                <span>Loading narrative...</span>
            </div>
        );
    }

    return (
        <div className={clsx('space-y-4', className)}>
            {/* Pending Section */}
            {groupedActions.pending.length > 0 && (
                <div>
                    <SectionHeader
                        {...statusGroups[0]}
                        count={groupedActions.pending.length}
                        collapsed={collapsedSections.has('pending')}
                        onToggle={() => toggleSection('pending')}
                    />
                    {!collapsedSections.has('pending') && (
                        <div className="mt-2 space-y-2 pl-4">
                            {groupedActions.pending.map((view) => (
                                <NarrativeCard
                                    key={view.actionId}
                                    id={view.actionId}
                                    title={view.data.title}
                                    type={view.viewType}
                                    status={view.data.status}
                                    events={eventsByAction.get(view.actionId)}
                                    selected={selectedActionId === view.actionId}
                                    onClick={() => handleActionClick(view.actionId)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Active Section */}
            {groupedActions.active.length > 0 && (
                <div>
                    <SectionHeader
                        {...statusGroups[1]}
                        count={groupedActions.active.length}
                        collapsed={collapsedSections.has('active')}
                        onToggle={() => toggleSection('active')}
                    />
                    {!collapsedSections.has('active') && (
                        <div className="mt-2 space-y-2 pl-4">
                            {groupedActions.active.map((view) => (
                                <NarrativeCard
                                    key={view.actionId}
                                    id={view.actionId}
                                    title={view.data.title}
                                    type={view.viewType}
                                    status={view.data.status}
                                    events={eventsByAction.get(view.actionId)}
                                    showEvents={true}
                                    selected={selectedActionId === view.actionId}
                                    onClick={() => handleActionClick(view.actionId)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Recorded Section (Facts by Family) */}
            {(groupedActions.recorded.length > 0 || factEntries.length > 0) && (
                <div>
                    <SectionHeader
                        {...statusGroups[2]}
                        count={groupedActions.recorded.length + factEntries.length}
                        collapsed={collapsedSections.has('recorded')}
                        onToggle={() => toggleSection('recorded')}
                    />
                    {!collapsedSections.has('recorded') && (
                        <div className="mt-2 space-y-3 pl-4">
                            {/* Completed Actions */}
                            {groupedActions.recorded.length > 0 && (
                                <div className="space-y-2">
                                    {groupedActions.recorded.map((view) => (
                                        <NarrativeCard
                                            key={view.actionId}
                                            id={view.actionId}
                                            title={view.data.title}
                                            type={view.viewType}
                                            status={view.data.status}
                                            events={eventsByAction.get(view.actionId)}
                                            selected={selectedActionId === view.actionId}
                                            onClick={() => handleActionClick(view.actionId)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Facts by Family */}
                            {Object.entries(factsByFamily).map(([family, facts]) => (
                                facts.length > 0 && (
                                    <FactFamilyGroup
                                        key={family}
                                        family={family as FactFamily}
                                        facts={facts}
                                    />
                                )
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {groupedActions.pending.length === 0 &&
             groupedActions.active.length === 0 &&
             groupedActions.recorded.length === 0 &&
             factEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <CheckCircle size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">No actions or facts recorded yet</p>
                    <p className="text-xs mt-1">Use the composer bar to declare your first action</p>
                </div>
            )}
        </div>
    );
}

export default NarrativeStream;
