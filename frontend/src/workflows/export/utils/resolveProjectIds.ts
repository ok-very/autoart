/**
 * resolveProjectIds
 *
 * Resolves SelectionReference[] from a collection to project IDs
 * that the backend export pipeline understands.
 *
 * Resolution strategy:
 *   - 'node' selections: look up root_project_id via hierarchy store
 *   - 'record'/'field' selections: look up classification_node_id on the
 *     record, then resolve via hierarchy store (requires records map)
 *   - 'artist'/'action'/'event': not project-scoped, skipped
 */

import type { SelectionReference } from '../../../stores/collectionStore';
import { useHierarchyStore } from '../../../stores/hierarchyStore';

interface ResolvedProjects {
    /** Deduplicated project IDs ready for the backend */
    projectIds: string[];
    /** Number of selections that resolved to a project */
    resolvedCount: number;
    /** Number of selections that could not be resolved */
    unresolvedCount: number;
}

/**
 * Resolve selections to project IDs using the hierarchy store.
 * Call this from within a React component (accesses Zustand store).
 */
export function useResolvedProjectIds(selections: SelectionReference[]): ResolvedProjects {
    const nodes = useHierarchyStore(s => s.nodes);

    return resolveFromNodes(selections, nodes);
}

/**
 * Pure function for resolution given a nodes map.
 * Useful for testing or non-React contexts.
 */
export function resolveFromNodes(
    selections: SelectionReference[],
    nodes: Record<string, { id: string; root_project_id: string | null; parent_id: string | null }>,
): ResolvedProjects {
    const projectIds = new Set<string>();
    let resolvedCount = 0;
    let unresolvedCount = 0;

    for (const sel of selections) {
        switch (sel.type) {
            case 'node': {
                // sourceId is a hierarchy node ID
                const node = nodes[sel.sourceId];
                if (node) {
                    // root_project_id points to the project root; for root nodes it's null (they ARE the project)
                    const projectId = node.root_project_id ?? (node.parent_id === null ? node.id : null);
                    if (projectId) {
                        projectIds.add(projectId);
                        resolvedCount++;
                    } else {
                        // Walk up ancestors to find root
                        const rootId = walkToRoot(sel.sourceId, nodes);
                        if (rootId) {
                            projectIds.add(rootId);
                            resolvedCount++;
                        } else {
                            unresolvedCount++;
                        }
                    }
                } else {
                    // Node not in store — use sourceId directly as fallback
                    projectIds.add(sel.sourceId);
                    resolvedCount++;
                }
                break;
            }

            case 'record':
            case 'field': {
                // sourceId is a record ID. We can't resolve record → node client-side
                // without a records cache. Fall back to using sourceId directly —
                // the backend will ignore unknown IDs gracefully.
                // TODO Phase 3: add record → classification_node_id → root_project_id resolution
                projectIds.add(sel.sourceId);
                resolvedCount++;
                break;
            }

            case 'artist':
            case 'action':
            case 'event':
                // These are not project-scoped selections
                unresolvedCount++;
                break;
        }
    }

    return {
        projectIds: Array.from(projectIds),
        resolvedCount,
        unresolvedCount,
    };
}

/** Walk parent_id chain to find root node */
function walkToRoot(
    nodeId: string,
    nodes: Record<string, { id: string; root_project_id: string | null; parent_id: string | null }>,
): string | null {
    let current = nodes[nodeId];
    const visited = new Set<string>();

    while (current) {
        if (visited.has(current.id)) return null; // cycle guard
        visited.add(current.id);

        if (current.root_project_id) return current.root_project_id;
        if (!current.parent_id) return current.id; // root node

        current = nodes[current.parent_id];
    }

    return null;
}
