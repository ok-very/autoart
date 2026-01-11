/**
 * Composer Schemas
 *
 * The Composer is a first-class module that lets the codebase create
 * any "task-like" work item WITHOUT ever touching the legacy task table.
 *
 * It:
 * 1. Creates an Action (the intent of the work item)
 * 2. Emits the minimal set of Events (ACTION_DECLARED, FIELD_VALUE_RECORDED, etc.)
 * 3. Creates ActionReferences that bind the action to existing records
 * 4. Returns a view (computed by the interpreter) for immediate rendering
 */

import { z } from 'zod';
import {
    ActionSchema,
    CreateActionInputSchema,
    EventSchema,
    CreateEventInputSchema,
    ActionViewSchema,
} from './actions.js';
import {
    ActionReferenceSchema,
    CreateActionReferenceInputSchema,
} from './references.js';

// ============================================================================
// COMPOSER FIELD VALUE
// ============================================================================

/**
 * Minimal "field value" payload that the Composer can turn into a
 * FIELD_VALUE_RECORDED event.
 */
export const ComposerFieldValueSchema = z.object({
    /** Name of the field as defined in the Action's fieldBindings (e.g. "title", "dueDate") */
    fieldName: z.string(),
    /** Any JSON-serializable value - validation is delegated to the Action's schema at runtime */
    value: z.unknown(),
});

export type ComposerFieldValue = z.infer<typeof ComposerFieldValueSchema>;

// ============================================================================
// COMPOSER INPUT
// ============================================================================

/**
 * Public contract for a Composer request.
 *
 * 1. `action` - the Action you want to declare (type + optional fieldBindings)
 * 2. `fieldValues` - list of initial field values that become FIELD_VALUE_RECORDED events
 * 3. `references` - optional ActionReferences to existing Records (e.g. projectId, sprintId)
 * 4. `emitExtraEvents` - advanced escape-hatch for callers that need arbitrary events
 *    (e.g. WORK_STARTED right after creation)
 */
export const ComposerInputSchema = z.object({
    /** The action to declare */
    action: CreateActionInputSchema,

    /** Initial field values - each becomes a FIELD_VALUE_RECORDED event */
    fieldValues: z.array(ComposerFieldValueSchema).optional(),

    /** Links to existing records */
    references: z.array(
        z.object({
            sourceRecordId: z.string().uuid(),
            targetFieldKey: z.string().optional(),
            mode: z.enum(['static', 'dynamic']).optional().default('dynamic'),
        })
    ).optional(),

    /** Advanced: emit additional events after ACTION_DECLARED */
    emitExtraEvents: z.array(
        z.object({
            type: z.string().max(100),
            payload: z.record(z.unknown()).optional().default({}),
        })
    ).optional(),
});

export type ComposerInput = z.infer<typeof ComposerInputSchema>;

// ============================================================================
// COMPOSER RESPONSE
// ============================================================================

/**
 * What the Composer returns - the created Action, all Events that were written,
 * and the computed ActionView (optional, filled by the service).
 */
export const ComposerResponseSchema = z.object({
    /** The created action */
    action: ActionSchema,

    /** All events that were emitted */
    events: z.array(EventSchema),

    /** Any action references that were created */
    references: z.array(ActionReferenceSchema).optional(),

    /** The computed view (optional - filled by interpreter) */
    view: ActionViewSchema.optional(),
});

export type ComposerResponse = z.infer<typeof ComposerResponseSchema>;

// ============================================================================
// COMPOSER CONFIG (Optional - for action type definitions)
// ============================================================================

/**
 * Defines an action type with its expected field bindings.
 * Used for validation and documentation.
 */
export const ActionTypeConfigSchema = z.object({
    /** The action type name (e.g., 'TASK', 'BUG', 'STORY') */
    type: z.string(),
    /** Human-readable label */
    label: z.string(),
    /** Field bindings schema */
    fieldBindings: z.record(z.enum(['string', 'text', 'date', 'number', 'boolean', 'enum', 'uuid'])),
    /** Default values for fields */
    defaults: z.record(z.unknown()).optional(),
});

export type ActionTypeConfig = z.infer<typeof ActionTypeConfigSchema>;

/**
 * Registry of known action types - can be extended by the application.
 */
export const KNOWN_ACTION_TYPES: ActionTypeConfig[] = [
    {
        type: 'TASK',
        label: 'Task',
        fieldBindings: {
            title: 'string',
            description: 'text',
            dueDate: 'date',
        },
    },
    {
        type: 'BUG',
        label: 'Bug',
        fieldBindings: {
            title: 'string',
            description: 'text',
            severity: 'enum',
        },
    },
    {
        type: 'STORY',
        label: 'Story',
        fieldBindings: {
            title: 'string',
            description: 'text',
            points: 'number',
        },
    },
];
