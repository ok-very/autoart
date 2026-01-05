/**
 * ActionInspector
 *
 * Right-side inspector panel for viewing action details.
 * Placeholder component - will be implemented with full inspector surface.
 */

import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAction, useActionEvents } from '../../api/hooks';

export interface ActionInspectorProps {
    /** Width of the inspector panel */
    width?: number;
}

export function ActionInspector({ width = 360 }: ActionInspectorProps) {
    const { selection, clearSelection } = useUIStore();

    // Only show for action selections
    const actionId = selection?.type === 'action' ? selection.id : null;

    const { data: action, isLoading: actionLoading } = useAction(actionId);
    const { data: events = [], isLoading: eventsLoading } = useActionEvents(actionId);

    if (!actionId) {
        return (
            <aside
                style={{ width }}
                className="bg-slate-50 border-l border-slate-200 flex flex-col shrink-0"
            >
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    Select an action to inspect
                </div>
            </aside>
        );
    }

    const isLoading = actionLoading || eventsLoading;

    // Extract title from field bindings
    const getTitle = () => {
        if (!action) return 'Loading...';
        const bindings = action.fieldBindings;
        const titleBinding = bindings?.find((b) => b.fieldKey === 'title');
        if (titleBinding?.value && typeof titleBinding.value === 'string') {
            return titleBinding.value;
        }
        return `${action.type} ${action.id.slice(0, 8)}`;
    };

    return (
        <aside
            style={{ width }}
            className="bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden"
        >
            {/* Header */}
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-slate-800 truncate">
                        {getTitle()}
                    </h2>
                    {action && (
                        <p className="text-xs text-slate-400">{action.type}</p>
                    )}
                </div>
                <button
                    onClick={clearSelection}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                        Loading action details...
                    </div>
                ) : action ? (
                    <div className="space-y-4">
                        {/* Action Info */}
                        <section>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Action Info
                            </h3>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-slate-500">Type</dt>
                                    <dd className="font-medium text-purple-700">{action.type}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-slate-500">Context</dt>
                                    <dd className="text-slate-700 capitalize">{action.contextType}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-slate-500">Created</dt>
                                    <dd className="text-slate-700">
                                        {new Date(action.createdAt).toLocaleString()}
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        {/* Field Bindings */}
                        <section>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Field Bindings
                            </h3>
                            {action.fieldBindings && action.fieldBindings.length > 0 ? (
                                <ul className="space-y-1">
                                    {action.fieldBindings.map((binding, idx) => (
                                        <li key={idx} className="text-sm">
                                            <span className="text-slate-500">{binding.fieldKey}:</span>{' '}
                                            <span className="text-slate-700">
                                                {String(binding.value ?? '-')}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-400">No field bindings</p>
                            )}
                        </section>

                        {/* Events */}
                        <section>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Events ({events.length})
                            </h3>
                            {events.length > 0 ? (
                                <ul className="space-y-2">
                                    {events.slice(0, 10).map((event) => (
                                        <li
                                            key={event.id}
                                            className="p-2 bg-slate-50 rounded-lg text-xs"
                                        >
                                            <div className="font-medium text-slate-700">{event.type}</div>
                                            <div className="text-slate-400">
                                                {new Date(event.occurredAt).toLocaleString()}
                                            </div>
                                        </li>
                                    ))}
                                    {events.length > 10 && (
                                        <li className="text-xs text-slate-400 text-center">
                                            + {events.length - 10} more events
                                        </li>
                                    )}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-400">No events yet</p>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                        Action not found
                    </div>
                )}
            </div>

            {/* Footer placeholder for future actions */}
            <div className="border-t border-slate-200 p-3 shrink-0">
                <p className="text-xs text-slate-400 text-center">
                    Action Inspector (extended surface coming soon)
                </p>
            </div>
        </aside>
    );
}
