/**
 * EventsPanel
 *
 * Docker-compatible version of EventsPage.
 */

import { Activity, Filter } from 'lucide-react';
import { useState } from 'react';

/**
 * Events Registry Panel
 *
 * Shows the event stream. Events are instances only (no definitions).
 * Provides basic filtering by context type and event type.
 */
export function EventsPanel() {
    const [contextFilter, setContextFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');

    return (
        <div className="flex flex-col h-full bg-ws-bg overflow-hidden">
            {/* Page Header */}
            <div className="h-10 border-b border-ws-panel-border bg-ws-panel-bg flex items-center justify-between px-3 shrink-0">
                <h1 className="text-ws-h1 font-semibold text-ws-fg flex items-center gap-2">
                    <Activity size={20} className="text-emerald-500" />
                    Events
                </h1>
                <div className="flex items-center gap-2 text-xs text-ws-muted">
                    <Filter size={14} />
                    Instances only
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
                        <option value="subprocess">Subprocess</option>
                        <option value="stage">Stage</option>
                        <option value="record">Record</option>
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
                    </select>
                </div>
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-hidden" />
        </div>
    );
}
