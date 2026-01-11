/**
 * StageProjection - Groups records by imported stage metadata
 *
 * This is a NON-PRIMITIVE projection that derives stages from
 * imported metadata only. Stages are historical hints, not structural truth.
 *
 * What this explicitly does NOT do:
 * - ❌ No stage_id persisted
 * - ❌ No container mutation
 * - ❌ No ordering guarantees
 * - ❌ No lifecycle semantics
 */

import type { ProjectionPreset, ProjectionContext, ProjectionResult } from '../types';

// Generic record type for stage projection
interface StageableRecord {
    id: string;
    metadata?: {
        import?: {
            stage_name?: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export const StageProjection: ProjectionPreset<StageableRecord> = {
    id: 'stage-projection',
    label: 'Group by Imported Stage',
    description: 'Groups work by stage metadata imported from external sources.',

    appliesTo: ({ preferences }: ProjectionContext) => {
        // Only applicable when stage-like views are enabled
        return preferences.enableStageLikeViews === true;
    },

    project: (records: StageableRecord[]): ProjectionResult<StageableRecord> => {
        const groups = new Map<string, StageableRecord[]>();

        records.forEach((record) => {
            const stageName = record.metadata?.import?.stage_name ?? 'Unlabeled';

            if (!groups.has(stageName)) {
                groups.set(stageName, []);
            }

            groups.get(stageName)!.push(record);
        });

        return {
            groups: Array.from(groups.entries()).map(([label, items]) => ({
                id: label.toLowerCase().replace(/\s+/g, '-'),
                label,
                items,
                meta: {
                    derived: true,
                    source: 'import.stage_name',
                },
            })),
        };
    },

    affordances: [
        {
            id: 'filter-by-stage',
            label: 'Filter by Stage',
            icon: 'filter',
            intent: 'filter',
        },
    ],

    ui: {
        icon: 'layers',
        defaultCollapsed: false,
        sortOrder: 10,
    },
};
