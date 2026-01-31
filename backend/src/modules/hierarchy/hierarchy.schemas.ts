import { z } from 'zod';

// ============================================================================
// NODE TYPE SCHEMAS
// ============================================================================

/**
 * Primary node type schema (stage removed from new creations).
 * Stage is demoted to projection-only - see projections module.
 */
export const nodeTypeSchema = z.enum(['project', 'process', 'subprocess']);

// ============================================================================
// CREATE/UPDATE SCHEMAS
// ============================================================================

export const createNodeSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: nodeTypeSchema, // No longer accepts 'stage' for new creations
  title: z.string().min(1, 'Title is required'),
  description: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  // Clone options for projects
  depth: z.enum(['all', 'process', 'stage', 'subprocess']).optional(), // Controls how deep to clone
  includeTemplates: z.boolean().optional(), // Clone definition templates
  includeRecords: z.boolean().optional(), // Clone associated records
});

// ============================================================================
// TYPES
// ============================================================================

export type NodeType = z.infer<typeof nodeTypeSchema>;
export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;
export type MoveNodeInput = z.infer<typeof moveNodeSchema>;
export type CloneNodeInput = z.infer<typeof cloneNodeSchema>;
