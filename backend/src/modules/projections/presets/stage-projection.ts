/**
 * Stage Projection
 *
 * Groups actions by import.stage_name metadata (or event-derived status).
 * Does NOT require stage_id foreign keys or stage containers.
 *
 * This enables "stage-like" grouping without persisting stage nodes,
 * allowing multiple competing stage systems to coexist over the same event stream.
 */

import type {
    ProjectionPreset,
    ActionProjectionInput,
    StageProjectionOutput,
} from '@autoart/shared';

// ============================================================================
// STAGE PROJECTION PRESET
// ============================================================================

export const StageProjection: ProjectionPreset<
    { actions: ActionProjectionInput[] },
    StageProjectionOutput
> = {
    id: 'stage-projection',
    label: 'Stage View',
    description: 'Groups work items by imported stage labels or event-derived status',

    applicability: {
        contextTypes: ['process', 'subprocess'],
    },

    derive(input: { actions: ActionProjectionInput[] }) {
        const { actions } = input;
        const groups = new Map<string, StageProjectionOutput['stages'][number]>();

        for (const action of actions) {
            // Derive stage from metadata (import hint) or event predicates
            const stageName = deriveStageLabel(action);
            const stageOrder = getStageOrder(action);

            if (!groups.has(stageName)) {
                groups.set(stageName, {
                    key: stageName,
                    label: stageName,
                    order: stageOrder,
                    items: [],
                });
            }

            groups.get(stageName)!.items.push(action);
        }

        return {
            stages: Array.from(groups.values()).sort((a, b) => a.order - b.order),
        };
    },
};

// ============================================================================
// STAGE DERIVATION LOGIC
// ============================================================================

/**
 * Derive stage label from action metadata or event stream.
 *
 * Priority:
 * 1. Imported stage label (import.stage_name)
 * 2. Event-derived status (future: WORK_STARTED → "In Progress")
 * 3. Fallback to "Uncategorized"
 */
function deriveStageLabel(action: ActionProjectionInput): string {
    // Priority 1: Imported stage label
    if (action.metadata?.['import.stage_name']) {
        return action.metadata['import.stage_name'] as string;
    }

    // Priority 2: Event-derived status (future evolution)
    // const hasWorkStarted = action.events?.some(e => e.event_type === 'WORK_STARTED');
    // const hasWorkFinished = action.events?.some(e => e.event_type === 'WORK_FINISHED');
    // if (hasWorkStarted && !hasWorkFinished) return 'In Progress';
    // if (hasWorkFinished) return 'Completed';

    // Priority 3: Check field bindings for status-like field
    const statusBinding = action.field_bindings?.find(
        (fb: { fieldKey: string; value: unknown }) => fb.fieldKey === 'status' || fb.fieldKey === 'Status'
    );
    if (statusBinding?.value && typeof statusBinding.value === 'string') {
        return statusBinding.value;
    }

    // Fallback
    return 'Uncategorized';
}

/**
 * Get stage order from metadata or derive from label.
 */
function getStageOrder(action: ActionProjectionInput): number {
    // Explicit order from import
    if (typeof action.metadata?.['import.stage_order'] === 'number') {
        return action.metadata['import.stage_order'];
    }

    // Default order by common stage names
    const stageName = deriveStageLabel(action).toLowerCase();
    const knownOrder: Record<string, number> = {
        'not started': 0,
        'pending': 1,
        'to do': 1,
        'in progress': 2,
        'active': 2,
        'review': 3,
        'done': 4,
        'completed': 4,
        'uncategorized': 999,
    };

    return knownOrder[stageName] ?? 500;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default StageProjection;
