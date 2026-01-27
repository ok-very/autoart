/**
 * CalendarContent
 *
 * Thin wrapper for embedding Calendar view as center content.
 */

import { CalendarView } from '../../composites/CalendarView';

export function CalendarContent() {
    return (
        <div className="h-full overflow-hidden bg-white">
            <CalendarView events={[]} />
        </div>
    );
}
