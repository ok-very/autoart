/**
 * ActionView Row Model Adapter
 *
 * Adapts ActionView[] to RowModel for use with UniversalTableCore.
 * ActionViews are non-reified projections from the event log.
 *
 * Used when displaying tasks derived from the Actions/Events system.
 */

import type { ActionView, DerivedStatus } from '@autoart/shared';

import type { RowModel, TableRow } from '../types';

/**
 * Create a RowModel from an array of ActionViews.
 *
 * @param views - Array of ActionView objects (interpreted from event log)
 * @returns RowModel for use with UniversalTableCore
 */
export function makeActionViewRowModel(views: ActionView[]): RowModel {
    const rows: TableRow[] = views.map((v) => ({
        id: v.actionId,
        data: v.data, // TaskLikeViewPayload
        meta: {
            status: v.data.status as DerivedStatus,
            viewType: v.viewType,
            renderedAt: v.renderedAt,
        },
    }));

    const rowMap = new Map(rows.map((r) => [r.id, r]));

    return {
        getRows: () => rows,
        getRowById: (id) => rowMap.get(id),
        capabilities: {
            selectable: true,
            expandable: false, // ActionViews are flat; nesting handled differently
        },
    };
}

/**
 * Helper to extract TaskLikeViewPayload from a TableRow.
 * Use this in cell() functions to access typed data.
 */
export function getActionViewData(row: TableRow) {
    return row.data as {
        title: string;
        description?: unknown;
        status: DerivedStatus;
        assignee?: { id: string; name: string };
        dueDate?: string;
        percentComplete?: number;
    };
}
