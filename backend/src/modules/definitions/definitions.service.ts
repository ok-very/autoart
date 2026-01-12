/**
 * Definitions Service
 *
 * Provides access to soft-intrinsic system definitions:
 * - Action types (TASK, BUG, STORY, etc.)
 * - Workflow statuses (from Task definition schema)
 * - Field templates
 */

import { db } from '../../db/client.js';
import type { ActionTypeDefinition } from '../../db/schema.js';

// In-memory cache for definitions (they rarely change)
let actionTypesCache: ActionTypeDefinition[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get all action type definitions
 */
export async function getActionTypes(): Promise<ActionTypeDefinition[]> {
    // Check cache
    if (actionTypesCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
        return actionTypesCache;
    }

    const types = await db
        .selectFrom('action_type_definitions')
        .selectAll()
        .orderBy('label', 'asc')
        .execute();

    actionTypesCache = types;
    cacheTimestamp = Date.now();

    return types;
}

/**
 * Get action type by type key
 */
export async function getActionTypeByKey(typeKey: string): Promise<ActionTypeDefinition | undefined> {
    const types = await getActionTypes();
    return types.find((t) => t.type === typeKey);
}

/**
 * Get workflow statuses from the Task system definition
 */
export async function getWorkflowStatuses(): Promise<{
    statuses: Array<{ key: string; label: string; colorClass: string }>;
}> {
    // Workflow statuses are stored in the Task definition's status field
    const taskDef = await db
        .selectFrom('record_definitions')
        .selectAll()
        .where('name', '=', 'Task')
        .where('is_system', '=', true)
        .executeTakeFirst();

    if (!taskDef) {
        return { statuses: [] };
    }

    const schemaConfig = taskDef.schema_config as { fields?: Array<{ key: string; type: string; statusConfig?: Record<string, { label: string; colorClass: string }> }> };
    const statusField = schemaConfig?.fields?.find((f) => f.type === 'status');

    if (!statusField?.statusConfig) {
        return { statuses: [] };
    }

    const statuses = Object.entries(statusField.statusConfig).map(([key, config]) => ({
        key,
        label: config.label,
        colorClass: config.colorClass,
    }));

    return { statuses };
}

/**
 * Invalidate cache (call after updates)
 */
export function invalidateCache(): void {
    actionTypesCache = null;
    cacheTimestamp = null;
}
