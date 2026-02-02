/**
 * ActionEventsPanel
 *
 * Displays execution log (events timeline) for an action.
 * Shows all events associated with the selected action.
 */

import { History, Zap } from 'lucide-react';

import { useActionEvents } from '../../api/hooks';

interface ActionEventsPanelProps {
    actionId: string;
}

export function ActionEventsPanel({ actionId }: ActionEventsPanelProps) {
    const { data: events = [], isLoading } = useActionEvents(actionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32 text-ws-muted text-sm">
                Loading events...
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-ws-muted">
                <History className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No events yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-ws-panel-border">
                <h3 className="text-xs font-semibold text-ws-muted uppercase tracking-wider">
                    Execution Log
                </h3>
                <span className="text-xs text-ws-text-secondary">
                    {events.length} event{events.length !== 1 ? 's' : ''}
                </span>
            </div>

            <ul className="space-y-2">
                {events.map((event) => (
                    <li
                        key={event.id}
                        className="p-3 bg-ws-bg rounded-lg border border-ws-panel-border hover:border-ws-panel-border transition-colors"
                    >
                        <div className="flex items-start gap-2">
                            <div className="p-1.5 rounded-md bg-blue-100 text-blue-600 shrink-0">
                                <Zap size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-ws-fg">
                                    {event.type}
                                </div>
                                <div className="text-xs text-ws-muted mt-0.5">
                                    {new Date(event.occurredAt).toLocaleString()}
                                </div>
                                {event.payload && Object.keys(event.payload).length > 0 && (
                                    <div className="mt-2 text-xs">
                                        <pre className="p-2 bg-ws-panel-bg rounded border border-ws-panel-border overflow-x-auto text-ws-text-secondary">
                                            {JSON.stringify(event.payload, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ActionEventsPanel;
