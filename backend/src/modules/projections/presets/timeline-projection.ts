/**
 * Timeline Projection
 *
 * Derives a chronological view from actions with date fields.
 * Used for Gantt charts, calendar views, and timeline visualizations.
 *
 * Date sources (priority order):
 * 1. field_bindings (startDate, dueDate)
 * 2. metadata (imported dates)
 * 3. events (ACTION_CREATED, WORK_FINISHED)
 */

import type {
    ProjectionPreset,
    ActionProjectionInput,
    TimelineProjectionOutput,
} from '@autoart/shared';
import {
    extractTitle,
    extractStartDate,
    extractDueDate,
    extractStatus,
    extractAssignee,
} from '@autoart/shared';

// ============================================================================
// TIMELINE PROJECTION PRESET
// ============================================================================

export const TimelineProjection: ProjectionPreset<
    { actions: ActionProjectionInput[] },
    TimelineProjectionOutput
> = {
    id: 'timeline-projection',
    label: 'Timeline View',
    description: 'Chronological view of actions with date ranges for Gantt/calendar display',

    applicability: {
        contextTypes: ['project', 'process', 'subprocess'],
    },

    derive(input: { actions: ActionProjectionInput[] }) {
        const { actions } = input;

        const entries = actions
            .map((action) => {
                const startDate = extractStartDate(action);
                const endDate = extractDueDate(action);

                // Skip actions without any date information
                if (!startDate && !endDate) {
                    return null;
                }

                return {
                    id: action.id,
                    title: extractTitle(action),
                    startDate,
                    endDate,
                    metadata: {
                        ...action.metadata,
                        type: action.type,
                        context_type: action.context_type,
                        context_id: action.context_id,
                        parent_action_id: action.parent_action_id,
                        status: extractStatus(action),
                        assignee: extractAssignee(action),
                    },
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        // Sort by start date (nulls last)
        entries.sort((a, b) => {
            if (!a.startDate && !b.startDate) return 0;
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });

        return { entries };
    },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TimelineProjection;
