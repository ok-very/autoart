/**
 * CalendarContent
 *
 * Thin wrapper for embedding Calendar view as center content.
 */

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

import { useActionViews } from '../../../api/hooks';
import { useUIStore } from '../../../stores/uiStore';
import { CalendarView, type CalendarEvent } from '../../composites/CalendarView';

export function CalendarContent() {
    const { activeProjectId } = useUIStore();

    // Fetch action views for the current project context
    const { data: actionViews, isLoading } = useActionViews(
        activeProjectId ?? null,
        'project'
    );

    // Transform action views into calendar events
    const events: CalendarEvent[] = useMemo(() => {
        if (!actionViews) return [];

        return actionViews
            .filter((view) => view.data.dueDate || view.data.startDate)
            .map((view) => ({
                id: view.actionId,
                title: view.data.title || 'Untitled',
                start: view.data.startDate
                    ? new Date(view.data.startDate)
                    : new Date(view.data.dueDate!),
                end: view.data.dueDate
                    ? new Date(view.data.dueDate)
                    : undefined,
                allDay: !view.data.startDate,
            }));
    }, [actionViews]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-white">
                <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
        );
    }

    return (
        <div className="h-full overflow-hidden bg-white">
            <CalendarView events={events} />
        </div>
    );
}
