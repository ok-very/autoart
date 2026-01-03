import { z } from 'zod';
import { FieldTypeSchema, NodeTypeSchema } from './enums';

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
