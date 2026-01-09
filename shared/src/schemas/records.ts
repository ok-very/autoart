import { z } from 'zod';
import { FieldTypeSchema } from './enums.js';

/**
 * Status Option Config Schema
 * Display configuration for a single status value
 */
export const StatusOptionConfigSchema = z.object({
  label: z.string(),
  colorClass: z.string(),
});

export type StatusOptionConfig = z.infer<typeof StatusOptionConfigSchema>;

/**
 * Status Config Schema
 * Maps status values to their display configuration
 */
export const StatusConfigSchema = z.record(z.string(), StatusOptionConfigSchema);

export type StatusConfig = z.infer<typeof StatusConfigSchema>;

/**
 * Field Definition Schema
 * Defines a single field in a record definition's schema
 */
export const FieldDefSchema = z.object({
  key: z.string().min(1),
  type: FieldTypeSchema,
  label: z.string().min(1),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(), // For select/status fields - list of values
  defaultValue: z.unknown().optional(),
  /**
   * Semantic hint for rendering.
   * Specifies how to interpret/display the value while keeping base type simple.
   * Examples: 'phone', 'email', 'url', 'person', 'date', 'timeline', 'file'
   */
  renderHint: z.string().optional(),
  /**
   * Whether this field allows # reference triggers.
   * Default: true for text/textarea, false for other types.
   */
  allowReferences: z.boolean().optional(),
  /**
   * Status display configuration (only for type: 'status').
   * Maps each status value to its label and color class.
   */
  statusConfig: StatusConfigSchema.optional(),
});

export type FieldDef = z.infer<typeof FieldDefSchema>;

/**
 * Schema Config Schema
 * Container for field definitions
 */
export const SchemaConfigSchema = z.object({
  fields: z.array(FieldDefSchema),
});

export type SchemaConfig = z.infer<typeof SchemaConfigSchema>;

/**
 * Styling Schema
 * Visual styling options for record definitions
 */
export const StylingSchema = z.object({
  color: z.string().optional(),
  icon: z.string().optional(), // Emoji or icon identifier
});

export type Styling = z.infer<typeof StylingSchema>;

/**
 * Record Definition Schema
 * Defines the structure of a record type
 */
export const RecordDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  derived_from_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(), // If set, belongs to project's template library
  is_template: z.boolean(),
  is_system: z.boolean(), // System definitions (Task, Subtask, etc.) - cannot be deleted
  kind: z.enum(['record', 'action_recipe', 'container']).default('record'), // Discriminator for definition types
  parent_definition_id: z.string().uuid().nullable(), // For hierarchical types (e.g., Subtask under Task)
  clone_excluded: z.boolean(),
  pinned: z.boolean(),
  schema_config: SchemaConfigSchema,
  styling: StylingSchema,
  created_at: z.string().datetime(),
});

export type RecordDefinition = z.infer<typeof RecordDefinitionSchema>;

/**
 * Data Record Schema
 * An instance of a record definition
 */
export const DataRecordSchema = z.object({
  id: z.string().uuid(),
  definition_id: z.string().uuid(),
  classification_node_id: z.string().uuid().nullable(),
  unique_name: z.string().min(1),
  data: z.record(z.unknown()),
  created_by: z.string().uuid().nullable(),
  updated_at: z.string().datetime(),
});

export type DataRecord = z.infer<typeof DataRecordSchema>;

/**
 * Create Definition Input Schema
 */
export const CreateDefinitionInputSchema = z.object({
  name: z.string().min(1),
  schemaConfig: SchemaConfigSchema,
  styling: StylingSchema.optional(),
  derivedFromId: z.string().uuid().optional(),
});

export type CreateDefinitionInput = z.infer<typeof CreateDefinitionInputSchema>;

/**
 * Update Definition Input Schema
 */
export const UpdateDefinitionInputSchema = z.object({
  name: z.string().min(1).optional(),
  schemaConfig: SchemaConfigSchema.optional(),
  styling: StylingSchema.optional(),
  pinned: z.boolean().optional(),
});

export type UpdateDefinitionInput = z.infer<typeof UpdateDefinitionInputSchema>;

/**
 * Create Record Input Schema
 */
export const CreateRecordInputSchema = z.object({
  definitionId: z.string().uuid(),
  uniqueName: z.string().min(1),
  data: z.record(z.unknown()).optional(),
  classificationNodeId: z.string().uuid().nullable().optional(),
});

export type CreateRecordInput = z.infer<typeof CreateRecordInputSchema>;

/**
 * Update Record Input Schema
 */
export const UpdateRecordInputSchema = z.object({
  uniqueName: z.string().min(1).optional(),
  data: z.record(z.unknown()).optional(),
  classificationNodeId: z.string().uuid().nullable().optional(),
});

export type UpdateRecordInput = z.infer<typeof UpdateRecordInputSchema>;

/**
 * Bulk Classify Input Schema
 */
export const BulkClassifyInputSchema = z.object({
  recordIds: z.array(z.string().uuid()),
  classificationNodeId: z.string().uuid().nullable(),
});

export type BulkClassifyInput = z.infer<typeof BulkClassifyInputSchema>;

/**
 * Bulk Delete Input Schema
 */
export const BulkDeleteInputSchema = z.object({
  recordIds: z.array(z.string().uuid()),
});

export type BulkDeleteInput = z.infer<typeof BulkDeleteInputSchema>;

/**
 * Save to Library Input Schema
 */
export const SaveToLibraryInputSchema = z.object({
  projectId: z.string().uuid(),
});

export type SaveToLibraryInput = z.infer<typeof SaveToLibraryInputSchema>;

/**
 * Toggle Clone Excluded Input Schema
 */
export const ToggleCloneExcludedInputSchema = z.object({
  excluded: z.boolean(),
});

export type ToggleCloneExcludedInput = z.infer<typeof ToggleCloneExcludedInputSchema>;

/**
 * Record Stats Schema
 */
export const RecordStatSchema = z.object({
  definitionId: z.string().uuid(),
  definitionName: z.string(),
  count: z.number().int().nonnegative(),
});

export type RecordStat = z.infer<typeof RecordStatSchema>;

/**
 * API Response Schemas
 */
export const DefinitionResponseSchema = z.object({
  definition: RecordDefinitionSchema,
});

export const DefinitionsResponseSchema = z.object({
  definitions: z.array(RecordDefinitionSchema),
});

export const RecordResponseSchema = z.object({
  record: DataRecordSchema,
});

export const RecordsResponseSchema = z.object({
  records: z.array(DataRecordSchema),
});

export const RecordStatsResponseSchema = z.object({
  stats: z.array(RecordStatSchema),
});

export const BulkOperationResponseSchema = z.object({
  updated: z.number().int().nonnegative().optional(),
  deleted: z.number().int().nonnegative().optional(),
});

/**
 * Helper to determine if a field allows references based on type and explicit setting.
 */
export function getFieldAllowReferences(fieldDef: FieldDef): boolean {
  if (fieldDef.allowReferences !== undefined) {
    return fieldDef.allowReferences;
  }
  return ['text', 'textarea'].includes(fieldDef.type);
}
