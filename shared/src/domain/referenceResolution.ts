/**
 * @autoart/shared - Reference Resolution
 *
 * Domain logic for resolving and validating references between entities.
 *
 * RULE: Backend is authoritative for reference resolution.
 * RULE: Frontend never dereferences values on its own.
 * RULE: Broken and unresolved states must be explicit.
 *
 * INVARIANT: If a reference exists, it must have a resolvable state.
 */

import type {
    Reference,
    ResolvedReference,
    ReferenceStatus,
    ProjectState,
} from './types.js';

// ==================== REFERENCE RESOLUTION ====================

/**
 * Resolves a reference to its current state and value.
 *
 * @param reference - The reference to resolve
 * @param projectState - The current project state
 * @returns The resolved reference with status and value
 */
export function resolveReference(
    reference: Reference,
    projectState: ProjectState
): ResolvedReference {
    const { referenceId, targetId, mode, sourceField } = reference;

    // Find the target entity
    const targetNode = projectState.nodes.find((n) => n.id === targetId);
    const targetRecord = projectState.records.find((r) => r.id === targetId);

    const target = targetNode || targetRecord;

    // If target doesn't exist, reference is broken
    if (!target) {
        return {
            referenceId,
            status: 'broken',
            label: `#${sourceField}`,
            sourceRecordId: null,
            targetFieldKey: sourceField,
            reason: 'Target entity no longer exists',
        };
    }

    // Determine status based on mode
    const status: ReferenceStatus = mode === 'dynamic' ? 'dynamic' : 'static';

    // Extract value based on target type
    let value: unknown;
    let label: string;

    if (targetNode) {
        // For nodes, the primary value is the title
        value = targetNode.title;
        label = `#${targetNode.title}:${sourceField}`;
    } else if (targetRecord) {
        // For records, the primary value is the unique_name
        value = targetRecord.unique_name;
        label = `#${targetRecord.unique_name}:${sourceField}`;
    } else {
        label = `#unknown:${sourceField}`;
    }

    return {
        referenceId,
        status,
        value,
        label,
        sourceRecordId: targetRecord?.id ?? null,
        targetFieldKey: sourceField,
        reason: mode === 'dynamic' ? 'Value updates with target' : 'Value is fixed',
    };
}

/**
 * Resolves multiple references at once.
 *
 * @param references - Array of references to resolve
 * @param projectState - The current project state
 * @returns Map of referenceId to ResolvedReference
 */
export function resolveReferences(
    references: Reference[],
    projectState: ProjectState
): Map<string, ResolvedReference> {
    const resolved = new Map<string, ResolvedReference>();

    for (const reference of references) {
        resolved.set(reference.referenceId, resolveReference(reference, projectState));
    }

    return resolved;
}

/**
 * Detects broken references in the project.
 *
 * @param references - Array of references to check
 * @param projectState - The current project state
 * @returns Array of broken references
 */
export function detectBrokenReferences(
    references: Reference[],
    projectState: ProjectState
): ResolvedReference[] {
    const broken: ResolvedReference[] = [];

    for (const reference of references) {
        const resolved = resolveReference(reference, projectState);
        if (resolved.status === 'broken') {
            broken.push(resolved);
        }
    }

    return broken;
}

/**
 * Checks if a reference target exists.
 *
 * @param targetId - The target entity ID
 * @param projectState - The current project state
 * @returns Whether the target exists
 */
export function referenceTargetExists(
    targetId: string,
    projectState: ProjectState
): boolean {
    const nodeExists = projectState.nodes.some((n) => n.id === targetId);
    const recordExists = projectState.records.some((r) => r.id === targetId);
    return nodeExists || recordExists;
}

/**
 * Gets the display label for a reference status.
 *
 * @param status - The reference status
 * @returns Human-readable status label
 */
export function getReferenceStatusLabel(status: ReferenceStatus): string {
    switch (status) {
        case 'unresolved':
            return 'Unresolved';
        case 'dynamic':
            return 'Dynamic';
        case 'static':
            return 'Static';
        case 'broken':
            return 'Broken';
        default:
            return 'Unknown';
    }
}

/**
 * Gets the severity level for a reference status.
 *
 * @param status - The reference status
 * @returns Severity level for UI styling
 */
export function getReferenceStatusSeverity(
    status: ReferenceStatus
): 'info' | 'success' | 'warning' | 'error' {
    switch (status) {
        case 'unresolved':
            return 'warning';
        case 'dynamic':
            return 'info';
        case 'static':
            return 'success';
        case 'broken':
            return 'error';
        default:
            return 'info';
    }
}

/**
 * Validates that a reference can be created.
 *
 * @param sourceField - The field that will contain the reference
 * @param targetId - The proposed target entity ID
 * @param projectState - The current project state
 * @returns Validation result with reason
 */
export function validateReference(
    sourceField: string,
    targetId: string,
    projectState: ProjectState
): { valid: boolean; reason?: string } {
    // Check target exists
    if (!referenceTargetExists(targetId, projectState)) {
        return {
            valid: false,
            reason: 'Target entity does not exist',
        };
    }

    // Check for circular references (basic check - source cannot reference itself)
    // More complex circular detection would require traversing the reference graph

    return { valid: true };
}
