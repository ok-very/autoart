import { z } from 'zod';

export const nodeTypeSchema = z.enum(['project', 'process', 'stage', 'subprocess', 'task']);

export const createNodeSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: nodeTypeSchema,
  title: z.string().min(1, 'Title is required'),
  description: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});

export const moveNodeSchema = z.object({
  newParentId: z.string().uuid().nullable(),
  position: z.number().int().min(0).optional(),
});

export const cloneNodeSchema = z.object({
  sourceNodeId: z.string().uuid(),
  targetParentId: z.string().uuid().nullable().optional(),
  overrides: z.object({
    title: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
  // Clone options for projects
  depth: z.enum(['all', 'process', 'stage', 'subprocess']).optional(), // How deep to clone
  includeTemplates: z.boolean().optional(), // Clone definition templates
  includeRecords: z.boolean().optional(), // Clone associated records
});

export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;
export type MoveNodeInput = z.infer<typeof moveNodeSchema>;
export type CloneNodeInput = z.infer<typeof cloneNodeSchema>;
