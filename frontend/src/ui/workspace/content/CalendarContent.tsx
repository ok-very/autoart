/**
 * CalendarContent
 *
 * Thin wrapper for embedding Calendar view as center content.
 */

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

import { useAllActions } from '../../../api/hooks/actions/actions';
import { CalendarView } from '../../composites/CalendarView';
import type { CalendarEvent } from '../../../utils/calendar-adapter';

export function CalendarContent() {
    // Fetch all actions with scheduling data
    const { data: actionsData, isLoading } = useAllActions({
        limit: 200,
        refetch: true,
    });

    // Transform actions into calendar events
    const events: CalendarEvent[] = useMemo(() => {
        const actions = actionsData?.actions;
        if (!actions) return [];

        return actions
            .filter((action) => {
                const bindings = action.fieldBindings || [];
                const dueDate = bindings.find((b: { fieldKey: string }) => b.fieldKey === 'dueDate')?.value as string | undefined;
                const startDate = bindings.find((b: { fieldKey: string }) => b.fieldKey === 'startDate')?.value as string | undefined;
                if (!dueDate && !startDate) return false;
                // Validate at least one date is valid
                const startValid = startDate ? !isNaN(new Date(startDate).getTime()) : false;
                const dueValid = dueDate ? !isNaN(new Date(dueDate).getTime()) : false;
                return startValid || dueValid;
            })
            .map((action) => {
                const bindings = action.fieldBindings || [];
                const title = bindings.find((b: { fieldKey: string }) => b.fieldKey === 'title')?.value as string | undefined;
                const dueDate = bindings.find((b: { fieldKey: string }) => b.fieldKey === 'dueDate')?.value as string | undefined;
                const startDate = bindings.find((b: { fieldKey: string }) => b.fieldKey === 'startDate')?.value as string | undefined;

                const start = startDate ? new Date(startDate) : new Date(dueDate!);
                const end = dueDate ? new Date(dueDate) : start;

                return {
                    actionId: action.id,
                    title: title || action.type || 'Untitled',
                    start,
                    end,
                    allDay: !startDate,
                };
            });
    }, [actionsData]);

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
