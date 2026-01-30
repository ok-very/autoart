/**
 * Action Types Service
 *
 * Manages Action Type Definitions - templates for creating actions.
 * These are stored in the action_type_definitions table.
 *
 * Action types define:
 * - The canonical type name (TASK, BUG, STORY, etc.)
 * - Display label
 * - Field bindings (what fields this action type has)
 * - Default values
 */

import { sql } from 'kysely';

import { db } from '../../db/client.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionTypeDefinition {
    id: string;
    type: string;
    label: string;
    description: string | null;
    field_bindings: unknown;
    defaults: unknown;
    is_system: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateActionTypeInput {
    type: string;
    label: string;
    description?: string;
    fieldBindings?: unknown[];
    defaults?: Record<string, unknown>;
}

export interface UpdateActionTypeInput {
    label?: string;
    description?: string | null;
    fieldBindings?: unknown[];
    defaults?: Record<string, unknown>;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all action type definitions.
 */
export async function getActionTypeDefinitions(): Promise<ActionTypeDefinition[]> {
    return db
        .selectFrom('action_type_definitions')
        .selectAll()
        .orderBy('is_system', 'desc')
        .orderBy('label', 'asc')
        .execute();
}

/**
 * Get a single action type definition by type.
 */
export async function getActionTypeDefinition(
    type: string
): Promise<ActionTypeDefinition | undefined> {
    return db
        .selectFrom('action_type_definitions')
        .selectAll()
        .where('type', '=', type)
        .executeTakeFirst();
}

/**
 * Get a single action type definition by ID.
 */
export async function getActionTypeDefinitionById(
    id: string
): Promise<ActionTypeDefinition | undefined> {
    return db
        .selectFrom('action_type_definitions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
}

/**
 * Count actions using a specific action type.
 */
export async function countActionsByType(type: string): Promise<number> {
    const result = await db
        .selectFrom('actions')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('type', '=', type)
        .executeTakeFirst();

    return parseInt(result?.count || '0', 10);
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new action type definition.
 */
export async function createActionTypeDefinition(
    input: CreateActionTypeInput
): Promise<ActionTypeDefinition> {
    // Validate type format (UPPER_SNAKE_CASE)
    if (!/^[A-Z][A-Z0-9_]*$/.test(input.type)) {
        throw new Error('Action type must be UPPER_SNAKE_CASE (e.g., MY_ACTION)');
    }

    // Check for duplicate
    const existing = await getActionTypeDefinition(input.type);
    if (existing) {
        throw new Error(`Action type already exists: ${input.type}`);
    }

    const result = await db
        .insertInto('action_type_definitions')
        .values({
            type: input.type,
            label: input.label,
            description: input.description || null,
            field_bindings: JSON.stringify(input.fieldBindings || []),
            defaults: JSON.stringify(input.defaults || {}),
            is_system: false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Update an action type definition.
 * System types can have their field bindings and defaults updated,
 * but their type and is_system flag cannot be changed.
 */
export async function updateActionTypeDefinition(
    type: string,
    input: UpdateActionTypeInput
): Promise<ActionTypeDefinition> {
    const existing = await getActionTypeDefinition(type);
    if (!existing) {
        throw new Error(`Action type not found: ${type}`);
    }

    const updates: Record<string, unknown> = {
        updated_at: sql`now()`,
    };

    if (input.label !== undefined) {
        updates.label = input.label;
    }
    if (input.description !== undefined) {
        updates.description = input.description;
    }
    if (input.fieldBindings !== undefined) {
        updates.field_bindings = JSON.stringify(input.fieldBindings);
    }
    if (input.defaults !== undefined) {
        updates.defaults = JSON.stringify(input.defaults);
    }

    const result = await db
        .updateTable('action_type_definitions')
        .set(updates)
        .where('type', '=', type)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Delete an action type definition.
 * System types cannot be deleted.
 * Types with existing actions cannot be deleted.
 */
export async function deleteActionTypeDefinition(type: string): Promise<void> {
    const existing = await getActionTypeDefinition(type);
    if (!existing) {
        throw new Error(`Action type not found: ${type}`);
    }

    if (existing.is_system) {
        throw new Error('Cannot delete system action type');
    }

    // Check for existing actions using this type
    const actionCount = await countActionsByType(type);
    if (actionCount > 0) {
        throw new Error(
            `Cannot delete action type with ${actionCount} existing action(s). ` +
            'Migrate or delete the actions first.'
        );
    }

    await db
        .deleteFrom('action_type_definitions')
        .where('type', '=', type)
        .execute();
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Get stats for all action types.
 */
export async function getActionTypeStats(): Promise<
    Array<{ type: string; count: number }>
> {
    const result = await db
        .selectFrom('actions')
        .select(['type'])
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .groupBy('type')
        .orderBy('count', 'desc')
        .execute();

    return result.map((r) => ({
        type: r.type,
        count: parseInt(r.count, 10),
    }));
}
