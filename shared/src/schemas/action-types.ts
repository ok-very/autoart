/**
 * Action Type Definitions Schema
 *
 * Defines the schema for action type templates (TASK, BUG, STORY, etc.)
 * These are stored in the action_type_definitions table and define:
 * - The canonical type name
 * - Display label
 * - Field bindings (what fields this action type has)
 * - Default values
 *
 * This is separate from record_definitions which stores data schemas.
 */

import { z } from 'zod';

// ============================================================================
// ACTION TYPE DEFINITION
// ============================================================================

/**
 * Field binding definition for an action type.
 * Maps field keys to their types/schemas.
 */
export const ActionTypeFieldBindingSchema = z.object({
    fieldKey: z.string(),
    fieldType: z.enum(['string', 'text', 'number', 'date', 'boolean', 'enum', 'user']),
    label: z.string().optional(),
    required: z.boolean().default(false),
    defaultValue: z.unknown().optional(),
    options: z.array(z.string()).optional(), // For enum type
});
export type ActionTypeFieldBinding = z.infer<typeof ActionTypeFieldBindingSchema>;

/**
 * Action Type Definition - template for creating actions
 */
export const ActionTypeDefinitionSchema = z.object({
    id: z.string().uuid(),
    type: z.string().max(100),           // Canonical name: TASK, BUG, MEETING
    label: z.string().max(255),          // Display name
    description: z.string().nullable(),
    fieldBindings: z.array(ActionTypeFieldBindingSchema).default([]),
    defaults: z.record(z.unknown()).default({}),
    isSystem: z.boolean().default(false), // Built-in vs custom
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type ActionTypeDefinition = z.infer<typeof ActionTypeDefinitionSchema>;

// ============================================================================
// API INPUTS
// ============================================================================

/**
 * Input for creating a new action type
 */
export const CreateActionTypeInputSchema = z.object({
    type: z.string().max(100).regex(/^[A-Z][A-Z0-9_]*$/, 'Type must be UPPER_SNAKE_CASE'),
    label: z.string().max(255),
    description: z.string().optional(),
    fieldBindings: z.array(ActionTypeFieldBindingSchema).optional().default([]),
    defaults: z.record(z.unknown()).optional().default({}),
});
export type CreateActionTypeInput = z.infer<typeof CreateActionTypeInputSchema>;

/**
 * Input for updating an action type
 */
export const UpdateActionTypeInputSchema = z.object({
    label: z.string().max(255).optional(),
    description: z.string().nullable().optional(),
    fieldBindings: z.array(ActionTypeFieldBindingSchema).optional(),
    defaults: z.record(z.unknown()).optional(),
});
export type UpdateActionTypeInput = z.infer<typeof UpdateActionTypeInputSchema>;

// ============================================================================
// API RESPONSES
// ============================================================================

export const ActionTypeDefinitionResponseSchema = z.object({
    data: ActionTypeDefinitionSchema,
});
export type ActionTypeDefinitionResponse = z.infer<typeof ActionTypeDefinitionResponseSchema>;

export const ActionTypeDefinitionsResponseSchema = z.object({
    data: z.array(ActionTypeDefinitionSchema),
});
export type ActionTypeDefinitionsResponse = z.infer<typeof ActionTypeDefinitionsResponseSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Built-in system action types
 */
export const SYSTEM_ACTION_TYPES = ['TASK', 'BUG', 'STORY'] as const;
export type SystemActionType = typeof SYSTEM_ACTION_TYPES[number];

/**
 * Default field bindings for built-in types
 */
export const DEFAULT_FIELD_BINDINGS: Record<SystemActionType, ActionTypeFieldBinding[]> = {
    TASK: [
        { fieldKey: 'title', fieldType: 'string', label: 'Title', required: true },
        { fieldKey: 'description', fieldType: 'text', label: 'Description', required: false },
        { fieldKey: 'dueDate', fieldType: 'date', label: 'Due Date', required: false },
    ],
    BUG: [
        { fieldKey: 'title', fieldType: 'string', label: 'Title', required: true },
        { fieldKey: 'description', fieldType: 'text', label: 'Description', required: false },
        { fieldKey: 'severity', fieldType: 'enum', label: 'Severity', required: false, options: ['low', 'medium', 'high', 'critical'] },
    ],
    STORY: [
        { fieldKey: 'title', fieldType: 'string', label: 'Title', required: true },
        { fieldKey: 'description', fieldType: 'text', label: 'Description', required: false },
        { fieldKey: 'points', fieldType: 'number', label: 'Story Points', required: false },
    ],
};
