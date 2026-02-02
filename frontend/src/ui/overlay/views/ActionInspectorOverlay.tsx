/**
 * ActionInspectorOverlay - Bottom drawer view for action inspection
 *
 * Detailed view of a single action with:
 * - Declared Intent (field bindings - potentially editable)
 * - Interpreted As (events - read-only)
 * - Current Projections (read-only)
 * - Mutation Actions (Retract/Amend buttons)
 */

import { ExternalLink, XCircle, PencilLine, Eye, EyeOff, Zap, ArrowDownRight } from 'lucide-react';
import { useState } from 'react';

import { useAction, useActionEvents, useRetractAction, useAmendAction } from '@/api/hooks';
import { useUIStore } from '@/stores';
import { EventRow } from '@/ui/primitives/EventRow';

interface ActionInspectorOverlayProps {
    actionId: string;
}

export function ActionInspectorOverlay({ actionId }: ActionInspectorOverlayProps) {
    const { closeOverlay, inspectAction, includeSystemEventsInLog, setIncludeSystemEventsInLog } = useUIStore();
    const { data: action, isLoading: actionLoading } = useAction(actionId);
    const { data: events = [], isLoading: eventsLoading } = useActionEvents(actionId);

    const [showSystemEvents, setShowSystemEvents] = useState(includeSystemEventsInLog);

    // Mutation hooks
    const retractMutation = useRetractAction();
    const amendMutation = useAmendAction();

    const isLoading = actionLoading || eventsLoading;

    // Filter events based on system events toggle
    const filteredEvents = showSystemEvents
        ? events
        : events.filter((e) => !e.type.startsWith('SYSTEM_'));

    // Extract title from field bindings
    const getTitle = (): string => {
        if (!action) return 'Loading...';
        const bindings = action.fieldBindings || [];
        const titleBinding = bindings.find((b: { fieldKey: string }) => b.fieldKey === 'title');
        if (titleBinding?.value && typeof titleBinding.value === 'string') {
            return titleBinding.value;
        }
        return `${action.type} ${action.id.slice(0, 8)}`;
    };

    const handleToggleSystemEvents = () => {
        setShowSystemEvents((v) => !v);
        setIncludeSystemEventsInLog(!showSystemEvents);
    };

    const handleOpenInInspector = () => {
        closeOverlay();
        inspectAction(actionId);
    };

    const handleRetract = () => {
        if (!action) return;
        if (confirm(`Retract action "${getTitle()}"? This cannot be undone.`)) {
            retractMutation.mutate(
                { actionId },
                {
                    onSuccess: () => {
                        closeOverlay();
                    },
                }
            );
        }
    };

    const handleAmend = () => {
        // For now, show a simple prompt for new field bindings
        // In production, this would open a modal with a form
        const newTitle = prompt('Enter new title (or cancel to abort):');
        if (newTitle && action) {
            const newBindings = [
                ...(action.fieldBindings || []).filter((b: { fieldKey: string }) => b.fieldKey !== 'title'),
                { fieldKey: 'title', value: newTitle },
            ];
            amendMutation.mutate(
                { actionId, fieldBindings: newBindings, reason: 'Title amended by user' },
                {
                    onSuccess: () => {
                        // Drawer stays open to show updated data
                    },
                }
            );
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-purple-500 rounded-full" />
            </div>
        );
    }

    if (!action) {
        return (
            <div className="p-4 text-center text-ws-muted">
                Action not found
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200 rounded uppercase">
                            ACTION
                        </span>
                        <span className="text-xs text-ws-muted font-mono">
                            {action.id.slice(0, 8)}
                        </span>
                    </div>
                    <h2 className="text-ws-h2 font-semibold text-ws-fg">{getTitle()}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Zap size={12} className="text-purple-500" />
                        <span className="text-sm text-purple-700 font-medium">{action.type}</span>
                        <span className="text-xs text-ws-muted">•</span>
                        <span className="text-xs text-ws-text-secondary capitalize">{action.contextType}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenInInspector}
                        className="p-2 text-ws-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Open in inspector"
                    >
                        <ExternalLink size={18} />
                    </button>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Declared Intent */}
                <section className="inspector-card bg-ws-panel-bg border border-ws-panel-border rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-ws-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                        Declared Intent
                    </h3>
                    <div className="card-intent space-y-2">
                        {action.fieldBindings && action.fieldBindings.length > 0 ? (
                            action.fieldBindings.map((binding, idx) => (
                                <div key={idx} className="flex items-start gap-2 py-1 border-b border-dashed border-ws-panel-border last:border-b-0">
                                    <span className="text-xs font-medium text-ws-text-secondary min-w-[80px]">
                                        {binding.fieldKey}
                                    </span>
                                    <span className="text-sm text-ws-text-secondary">
                                        {String(binding.value ?? '—')}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-ws-muted italic">No field bindings</p>
                        )}
                    </div>

                    {/* Mutation Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-ws-panel-border">
                        <button
                            onClick={handleRetract}
                            disabled={retractMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {retractMutation.isPending ? (
                                <div className="animate-spin w-3 h-3 border border-red-400 border-t-transparent rounded-full" />
                            ) : (
                                <XCircle size={12} />
                            )}
                            {retractMutation.isPending ? 'Retracting...' : 'Retract'}
                        </button>
                        <button
                            onClick={handleAmend}
                            disabled={amendMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {amendMutation.isPending ? (
                                <div className="animate-spin w-3 h-3 border border-amber-400 border-t-transparent rounded-full" />
                            ) : (
                                <PencilLine size={12} />
                            )}
                            {amendMutation.isPending ? 'Amending...' : 'Amend'}
                        </button>
                    </div>
                </section>

                {/* Right: Interpreted As (Events) */}
                <section className="inspector-card bg-ws-panel-bg border border-ws-panel-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-ws-muted uppercase tracking-wider flex items-center gap-2">
                            <ArrowDownRight size={12} className="text-ws-muted" />
                            Interpreted As
                        </h3>
                        <button
                            onClick={handleToggleSystemEvents}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${showSystemEvents
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-ws-bg text-ws-text-secondary border border-ws-panel-border hover:bg-slate-100'
                                }`}
                        >
                            {showSystemEvents ? <Eye size={10} /> : <EyeOff size={10} />}
                            {showSystemEvents ? 'sys' : 'sys'}
                        </button>
                    </div>
                    <div className="card-events max-h-[300px] overflow-y-auto custom-scroll">
                        {filteredEvents.length > 0 ? (
                            <div className="space-y-1">
                                {filteredEvents.map((event) => (
                                    <EventRow
                                        key={event.id}
                                        event={event}
                                        isSystem={event.type.startsWith('SYSTEM_')}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-ws-muted italic py-4 text-center">
                                No events {!showSystemEvents && '(system events hidden)'}
                            </p>
                        )}
                    </div>
                </section>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-ws-panel-border">
                <button
                    onClick={closeOverlay}
                    className="px-4 py-2 text-sm font-medium text-ws-text-secondary bg-ws-panel-bg border border-slate-300 rounded-md hover:bg-ws-bg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
