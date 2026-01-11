/**
 * Hierarchy Projection
 *
 * Renders a tree of project → process → subprocess → task/subtask.
 * Does NOT include stage nodes (per architectural decision to demote stages).
 */

import type {
    ProjectionPreset,
    ActionProjectionInput,
    ContainerInput,
    HierarchyProjectionOutput,
} from '@autoart/shared';

// ============================================================================
// HIERARCHY PROJECTION PRESET
// ============================================================================

export const HierarchyProjection: ProjectionPreset<
    { actions: ActionProjectionInput[]; containers: ContainerInput[] },
    HierarchyProjectionOutput
> = {
    id: 'hierarchy-projection',
    label: 'Hierarchy Tree',
    description: 'Displays records in project/process/subprocess/task structure',

    derive(input: { actions: ActionProjectionInput[]; containers: ContainerInput[] }) {
        const { actions, containers } = input;
        const nodes: HierarchyProjectionOutput['nodes'] = [];

        // Add containers (project, process, subprocess) — skip stage nodes
        for (const container of containers) {
            // Note: type check is defensive; containers shouldn't include stage after refactor
            if (
                container.type === 'project' ||
                container.type === 'process' ||
                container.type === 'subprocess'
            ) {
                nodes.push({
                    id: container.id,
                    type: container.type,
                    title: container.title,
                    parentId: container.parent_id,
                    children: [],
                    metadata: container.metadata,
                });
            }
        }

        // Add task-like actions
        for (const action of actions) {
            // Derive title from field bindings or metadata
            const title = getTitleFromAction(action);

            // Derive type based on action.type or infer from context
            const nodeType = deriveNodeType(action);

            nodes.push({
                id: action.id,
                type: nodeType,
                title,
                parentId: action.parent_action_id ?? action.context_id,
                children: [],
                metadata: action.metadata,
            });
        }

        // Build parent-child relationships
        type NodeEntry = HierarchyProjectionOutput['nodes'][number];
        const nodeMap = new Map<string, NodeEntry>(nodes.map((n: NodeEntry) => [n.id, n]));
        for (const node of nodes) {
            if (node.parentId && nodeMap.has(node.parentId)) {
                nodeMap.get(node.parentId)!.children.push(node.id);
            }
        }

        return { nodes };
    },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract title from action field bindings or metadata.
 */
function getTitleFromAction(action: ActionProjectionInput): string {
    // Check field bindings first
    const titleBinding = action.field_bindings?.find(
        (fb: { fieldKey: string; value: unknown }) => fb.fieldKey === 'title' || fb.fieldKey === 'name'
    );
    if (titleBinding?.value && typeof titleBinding.value === 'string') {
        return titleBinding.value;
    }

    // Fall back to metadata
    if (action.metadata?.title && typeof action.metadata.title === 'string') {
        return action.metadata.title;
    }

    return 'Untitled';
}

/**
 * Derive node type from action.type field.
 */
function deriveNodeType(
    action: ActionProjectionInput
): 'task' | 'subtask' | 'project' | 'process' | 'subprocess' {
    const type = action.type.toLowerCase();

    if (type === 'subtask') return 'subtask';
    if (type === 'task') return 'task';
    if (type === 'subprocess') return 'subprocess';
    if (type === 'process') return 'process';
    if (type === 'project') return 'project';

    // Default to task for unknown action types
    return 'task';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default HierarchyProjection;
