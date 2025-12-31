import { z } from 'zod';

// Field definition schema for record definitions
export const fieldDefSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['text', 'number', 'email', 'url', 'textarea', 'select', 'date', 'checkbox', 'link']),
  label: z.string().min(1),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(), // For select type
  defaultValue: z.unknown().optional(),
});

export const schemaConfigSchema = z.object({
  fields: z.array(fieldDefSchema),
});

export const stylingSchema = z.object({
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const createDefinitionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  schemaConfig: schemaConfigSchema,
  styling: stylingSchema.optional(),
  projectId: z.string().uuid().optional(), // Link to project's template library
  isTemplate: z.boolean().optional(), // Mark as reusable template
});

export const updateDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  schemaConfig: schemaConfigSchema.optional(),
  styling: stylingSchema.optional(),
  projectId: z.string().uuid().nullable().optional(),
  isTemplate: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const saveToLibrarySchema = z.object({
  projectId: z.string().uuid(),
});

export const cloneDefinitionSchema = z.object({
  newName: z.string().min(1, 'New name is required'),
  schemaOverrides: schemaConfigSchema.partial().optional(),
});

export const createRecordSchema = z.object({
  definitionId: z.string().uuid(),
  classificationNodeId: z.string().uuid().nullable().optional(),
  uniqueName: z.string().min(1, 'Unique name is required'),
  data: z.record(z.unknown()),
});

export const updateRecordSchema = z.object({
  uniqueName: z.string().min(1).optional(),
  classificationNodeId: z.string().uuid().nullable().optional(),
  data: z.record(z.unknown()).optional(),
});

export const listRecordsQuerySchema = z.object({
  definitionId: z.string().uuid().optional(),
  classificationNodeId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

export type FieldDef = z.infer<typeof fieldDefSchema>;
export type SchemaConfig = z.infer<typeof schemaConfigSchema>;
export type CreateDefinitionInput = z.infer<typeof createDefinitionSchema>;
export type UpdateDefinitionInput = z.infer<typeof updateDefinitionSchema>;
export type SaveToLibraryInput = z.infer<typeof saveToLibrarySchema>;
export type CloneDefinitionInput = z.infer<typeof cloneDefinitionSchema>;
export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
