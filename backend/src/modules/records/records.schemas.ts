import { z } from 'zod';
import {
  FieldDefSchema,
  SchemaConfigSchema,
  StylingSchema,
} from '@autoart/shared';

// Re-export from shared for local use - SINGLE SOURCE OF TRUTH
export const fieldDefSchema = FieldDefSchema;
export const schemaConfigSchema = SchemaConfigSchema;
export const stylingSchema = StylingSchema;

// Definition CRUD schemas
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

// Record CRUD schemas
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

// Type exports
export type FieldDef = z.infer<typeof fieldDefSchema>;
export type SchemaConfig = z.infer<typeof schemaConfigSchema>;
export type CreateDefinitionInput = z.infer<typeof createDefinitionSchema>;
export type UpdateDefinitionInput = z.infer<typeof updateDefinitionSchema>;
export type SaveToLibraryInput = z.infer<typeof saveToLibrarySchema>;
export type CloneDefinitionInput = z.infer<typeof cloneDefinitionSchema>;
export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
