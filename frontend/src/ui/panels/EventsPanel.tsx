/**
 * EventsPanel
 *
 * Docker-compatible version of EventsPage.
 */

import type { IDockviewPanelProps } from 'dockview';
import { Activity } from 'lucide-react';
import { useState } from 'react';

import { useEventsByProject } from '../../api/hooks/projectLog';
import { useWorkspaceContextOptional } from '../../workspace/WorkspaceContext';

/**
 * Events Registry Panel
 *
 * Shows the event stream. Events are instances only (no definitions).
 * Provides basic filtering by context type and event type.
 */
export function EventsPanel(props: IDockviewPanelProps) {
    const [contextFilter, setContextFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');

    // Project binding: use workspace project when panel is bound
    const wsCtx = useWorkspaceContextOptional();
    const isBound = wsCtx?.isBound(props.api.id) ?? false;
    const projectId = isBound ? wsCtx?.boundProjectId ?? undefined : undefined;

    const { data, isLoading } = useEventsByProject(projectId, {
        types: typeFilter ? [typeFilter] : undefined,
    });

    // Client-side context type filter (API returns all context types under project)
    const events = data?.events.filter(
        (e) => !contextFilter || e.contextType === contextFilter
    ) ?? [];

    return (
        <div className="flex flex-col h-full bg-ws-bg overflow-hidden">
            {/* Page Header */}
            <div className="h-10 border-b border-ws-panel-border bg-ws-panel-bg flex items-center justify-between px-3 shrink-0">
                <h1 className="text-ws-h1 font-semibold text-ws-fg flex items-center gap-2">
                    <Activity size={20} className="text-emerald-500" />
                    Events
                </h1>
                <div className="flex items-center gap-2 text-xs text-ws-muted">
                    {data ? `${data.total} total` : 'Instances only'}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="h-8 border-b border-ws-panel-border bg-ws-bg flex items-center gap-4 px-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-ws-text-secondary">Context:</span>
                    <select
                        value={contextFilter}
                        onChange={(e) => setContextFilter(e.target.value)}
                        className="text-xs border border-ws-panel-border rounded px-2 py-1 bg-ws-panel-bg"
                    >
                        <option value="">All</option>
                        <option value="project">Project</option>
                        <option value="process">Process</option>
                        <option value="subprocess">Subprocess</option>
                        <option value="phase">Phase</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-ws-text-secondary">Type:</span>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="text-xs border border-ws-panel-border rounded px-2 py-1 bg-ws-panel-bg"
                    >
                        <option value="">All</option>
                        <option value="ACTION_DECLARED">ACTION_DECLARED</option>
                        <option value="WORK_STARTED">WORK_STARTED</option>
                        <option value="WORK_FINISHED">WORK_FINISHED</option>
                        <option value="ACTION_RETRACTED">ACTION_RETRACTED</option>
                        <option value="FACT_RECORDED">FACT_RECORDED</option>
                    </select>
                </div>
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-y-auto">
                {!projectId && (
                    <div className="flex items-center justify-center h-full text-ws-muted text-sm">
                        Bind a project to view events
                    </div>
                )}
                {projectId && isLoading && (
                    <div className="flex items-center justify-center h-full text-ws-muted text-sm">
                        Loading events…
                    </div>
                )}
                {projectId && !isLoading && events.length === 0 && (
                    <div className="flex items-center justify-center h-full text-ws-muted text-sm">
                        No events found
                    </div>
                )}
                {events.map((event) => (
                    <div
                        key={event.id}
                        className="flex items-start gap-3 px-3 py-2 border-b border-ws-panel-border hover:bg-ws-panel-bg/50 text-sm"
                    >
                        <div className="shrink-0 mt-0.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-ws-fg">{event.type}</span>
                                <span className="text-xs text-ws-muted">{event.contextType}</span>
                            </div>
                            <div className="text-xs text-ws-text-secondary mt-0.5">
                                {new Date(event.occurredAt).toLocaleString()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

