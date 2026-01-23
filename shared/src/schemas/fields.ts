import { z } from 'zod';
import { FieldTypeSchema, NodeTypeSchema } from './enums.js';

/**
 * RenderHint - Canonical rendering hints for field display
 * Determines which UI component to use when editing/displaying field values
 *
 * These are universal primitives. Connector-specific concepts (timeline, mirror,
 * subtasks, doc) should translate to these canonical types.
 */
export const RenderHintSchema = z.enum([
    // Text
    'text',       // Single-line text input (default)
    'richtext',   // Multi-line rich text / markdown content

    // Selection
    'status',     // Status dropdown with project-specific options
    'select',     // Generic select from options list
    'checkbox',   // Boolean checkbox
    'tags',       // Multi-select tags

    // People
    'person',     // Person/assignee selector from workspace members

    // Dates
    'date',       // Date picker with calendar

    // Numbers
    'number',     // Number input
    'currency',   // Currency input with formatting

    // Communication
    'url',        // URL input with link preview
    'email',      // Email input with validation
    'phone',      // Phone number input

    // Attachments
    'file',       // File attachment

    // Relations
    'relation',   // Link to other records
]);
export type RenderHint = z.infer<typeof RenderHintSchema>;

/**
 * FieldDescriptor - Describes a unique field path in the system
 * Used by the Fields view to present all available fields across hierarchy and records
 */
export const FieldDescriptorSchema = z.object({
    /** Unique identifier (hash of path) */
    id: z.string(),

    /** Full dotted path: "task.dueDate" or "Contact.email" */
    path: z.string(),

    /** Human-readable label: "Due Date" */
    label: z.string(),

    /** Field data type */
    type: FieldTypeSchema,

    /** Rendering hint for UI component selection */
    renderHint: RenderHintSchema.optional(),

    /** Source node type where this field appears (null for record fields) */
    sourceNodeType: NodeTypeSchema.nullable(),

    /** Source definition name for record fields (null for node metadata) */
    sourceDefinitionName: z.string().nullable(),

    /** Definition ID for record fields */
    sourceDefinitionId: z.string().uuid().nullable(),

    /** Node IDs where this field appears (for node metadata fields) */
    sourceNodeIds: z.array(z.string().uuid()),

    /** Single field or appears in many places */
    cardinality: z.enum(['single', 'many']),

    /** Number of occurrences across all sources */
    occurrenceCount: z.number().int().nonnegative(),

    /** Original field key (for editing) */
    fieldKey: z.string(),

    /** Optional field options (for select/status fields) */
    options: z.array(z.string()).optional(),
});

export type FieldDescriptor = z.infer<typeof FieldDescriptorSchema>;

/**
 * FieldCategory - Grouping container for fields
 * Represents a source type (Projects, Tasks, Records) or subcategory
 */
export type FieldCategory = {
    id: string;
    name: string;
    label: string;
    icon?: string;
    childCount: number;
    subcategories?: FieldCategory[];
    fields?: FieldDescriptor[];
};

export const FieldCategorySchema: z.ZodType<FieldCategory> = z.object({
    /** Unique identifier */
    id: z.string(),

    /** Category name (internal) */
    name: z.string(),

    /** Display label */
    label: z.string(),

    /** Icon name (optional) */
    icon: z.string().optional(),

    /** Number of fields in this category */
    childCount: z.number().int().nonnegative(),

    /** Subcategories (for nested navigation) */
    subcategories: z.array(z.lazy(() => FieldCategorySchema)).optional(),

    /** Fields in this category (leaf level) */
    fields: z.array(FieldDescriptorSchema).optional(),
});

/**
 * FieldIndex - Complete field index for exploring fields
 * Generated client-side from hierarchy nodes and record definitions
 */
export const FieldIndexSchema = z.object({
    /** Project ID this index is scoped to (optional for global) */
    projectId: z.string().uuid().nullable(),

    /** When this index was generated */
    generatedAt: z.string().datetime(),

    /** Top-level categories */
    categories: z.array(FieldCategorySchema),

    /** Total unique fields */
    totalFields: z.number().int().nonnegative(),

    /** Total field occurrences across all sources */
    totalOccurrences: z.number().int().nonnegative(),
});

export type FieldIndex = z.infer<typeof FieldIndexSchema>;
