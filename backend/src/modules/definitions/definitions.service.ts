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

    // Validate schema_config exists and is an object
    if (!taskDef.schema_config || typeof taskDef.schema_config !== 'object') {
        return { statuses: [] };
    }

    const schemaConfig = taskDef.schema_config as Record<string, unknown>;

    // Validate fields is an array
    if (!Array.isArray(schemaConfig.fields)) {
        return { statuses: [] };
    }

    // Safely find status field
    const statusField = schemaConfig.fields.find(
        (f): f is { key: string; type: string; statusConfig?: Record<string, unknown> } =>
            typeof f === 'object' &&
            f !== null &&
            'type' in f &&
            f.type === 'status'
    );

    // Validate statusConfig exists and is an object
    if (!statusField?.statusConfig || typeof statusField.statusConfig !== 'object') {
        return { statuses: [] };
    }

    // Map statusConfig to statuses array with validation
    const statuses = Object.entries(statusField.statusConfig)
        .filter(([_, config]) => {
            return (
                typeof config === 'object' &&
                config !== null &&
                'label' in config &&
                'colorClass' in config &&
                typeof config.label === 'string' &&
                typeof config.colorClass === 'string'
            );
        })
        .map(([key, config]) => {
            const validConfig = config as { label: string; colorClass: string };
            return {
                key,
                label: validConfig.label,
                colorClass: validConfig.colorClass,
            };
        });

    return { statuses };
}

/**
 * Invalidate cache (call after updates)
 */
export function invalidateCache(): void {
    actionTypesCache = null;
    cacheTimestamp = null;
}
