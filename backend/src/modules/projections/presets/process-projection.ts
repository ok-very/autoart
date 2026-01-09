/**
 * Process Projection
 *
 * Derives process containers from clusters of related items.
 * Implements auto-grouping logic:
 * 1. Explicit parenting is preserved (e.g., subitems with parentItemId)
 * 2. When 2+ orphan items cluster by definition or stage, wrap in process container
 * 3. Remaining orphans float unattached
 */

import type {
    ProjectionPreset,
    ActionProjectionInput,
    ProcessProjectionOutput,
} from '@autoart/shared';

// ============================================================================
// PROCESS PROJECTION PRESET
// ============================================================================

export const ProcessProjection: ProjectionPreset<
    { actions: ActionProjectionInput[] },
    ProcessProjectionOutput
> = {
    id: 'process-projection',
    label: 'Process View',
    description: 'Groups items into process containers by definition or import stage',

    applicability: {
        contextTypes: ['project', 'process'],
    },

    derive(input: { actions: ActionProjectionInput[] }) {
        const { actions } = input;
        const processes: ProcessProjectionOutput['processes'] = [];
        const floating: ActionProjectionInput[] = [];

        // Track items with explicit parents (these skip auto-grouping)
        const explicitlyParented = new Set<string>();
        for (const action of actions) {
            if (action.parent_action_id) {
                explicitlyParented.add(action.id);
            }
        }

        // Build explicit parent groups
        const explicitGroups = new Map<string, ActionProjectionInput[]>();
        for (const action of actions) {
            if (action.parent_action_id) {
                if (!explicitGroups.has(action.parent_action_id)) {
                    explicitGroups.set(action.parent_action_id, []);
                }
                explicitGroups.get(action.parent_action_id)!.push(action);
            }
        }

        // Create explicit process groups from parent items with children
        for (const [parentId, children] of explicitGroups.entries()) {
            const parent = actions.find(a => a.id === parentId);
            if (parent) {
                processes.push({
                    id: `explicit:${parentId}`,
                    title: getTitleFromAction(parent),
                    items: [parent, ...children],
                    source: 'explicit',
                });
                explicitlyParented.add(parentId);
            }
        }

        // Orphan items (no explicit parent and not a parent themselves)
        const orphans = actions.filter(a => !explicitlyParented.has(a.id));

        // Group orphans by definition
        const byDefinition = new Map<string, ActionProjectionInput[]>();
        const byStage = new Map<string, ActionProjectionInput[]>();
        const noContext: ActionProjectionInput[] = [];

        for (const action of orphans) {
            const definitionId = getDefinitionId(action);
            const stageName = getStageName(action);

            if (definitionId) {
                if (!byDefinition.has(definitionId)) {
                    byDefinition.set(definitionId, []);
                }
                byDefinition.get(definitionId)!.push(action);
            } else if (stageName) {
                if (!byStage.has(stageName)) {
                    byStage.set(stageName, []);
                }
                byStage.get(stageName)!.push(action);
            } else {
                noContext.push(action);
            }
        }

        // Promote definition clusters with 2+ items to processes
        for (const [defId, items] of byDefinition.entries()) {
            if (items.length >= 2) {
                const definitionName = getDefinitionName(items[0]) || defId;
                processes.push({
                    id: `definition:${defId}`,
                    title: definitionName,
                    items,
                    source: 'definition',
                });
            } else {
                // Single item - float it
                floating.push(...items);
            }
        }

        // Promote stage clusters with 2+ items to processes
        for (const [stage, items] of byStage.entries()) {
            if (items.length >= 2) {
                processes.push({
                    id: `stage:${stage}`,
                    title: stage,
                    items,
                    source: 'stage',
                });
            } else {
                // Single item - float it
                floating.push(...items);
            }
        }

        // Items with no context float
        floating.push(...noContext);

        return { processes, floating };
    },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTitleFromAction(action: ActionProjectionInput): string {
    const titleBinding = action.field_bindings?.find(
        (fb: { fieldKey: string; value: unknown }) => fb.fieldKey === 'title' || fb.fieldKey === 'name'
    );
    if (titleBinding?.value && typeof titleBinding.value === 'string') {
        return titleBinding.value;
    }
    if (action.metadata?.title && typeof action.metadata.title === 'string') {
        return action.metadata.title;
    }
    return 'Untitled';
}

function getDefinitionId(action: ActionProjectionInput): string | null {
    return (action.metadata?.['schemaMatch.definitionId'] as string) ?? null;
}

function getDefinitionName(action: ActionProjectionInput): string | null {
    return (action.metadata?.['schemaMatch.definitionName'] as string) ?? null;
}

function getStageName(action: ActionProjectionInput): string | null {
    return (action.metadata?.['import.stage_name'] as string) ?? null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ProcessProjection;
