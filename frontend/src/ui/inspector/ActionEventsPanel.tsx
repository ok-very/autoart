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
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                Loading events...
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <History className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No events yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Execution Log
                </h3>
                <span className="text-xs text-slate-500">
                    {events.length} event{events.length !== 1 ? 's' : ''}
                </span>
            </div>

            <ul className="space-y-2">
                {events.map((event) => (
                    <li
                        key={event.id}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                        <div className="flex items-start gap-2">
                            <div className="p-1.5 rounded-md bg-blue-100 text-blue-600 shrink-0">
                                <Zap size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-slate-800">
                                    {event.type}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                    {new Date(event.occurredAt).toLocaleString()}
                                </div>
                                {event.payload && Object.keys(event.payload).length > 0 && (
                                    <div className="mt-2 text-xs">
                                        <pre className="p-2 bg-white rounded border border-slate-100 overflow-x-auto text-slate-600">
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
