import { z } from 'zod';
import { NodeTypeSchema } from './enums.js';

/**
 * Hierarchy Node Schema
 * Represents a node in the 5-level hierarchy (project → process → stage → subprocess → task)
 */
export const HierarchyNodeSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  root_project_id: z.string().uuid().nullable(),
  type: NodeTypeSchema,
  title: z.string().min(1),
  description: z.unknown().nullable(), // TipTap JSON document
  position: z.number().int().nonnegative(),
  default_record_def_id: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).default({}),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type HierarchyNode = z.infer<typeof HierarchyNodeSchema>;

/**
 * Create Node Input Schema
 */
export const CreateNodeInputSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: NodeTypeSchema,
  title: z.string().min(1),
  description: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  position: z.number().int().nonnegative().optional(),
});

export type CreateNodeInput = z.infer<typeof CreateNodeInputSchema>;

/**
 * Update Node Input Schema
 */
export const UpdateNodeInputSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  position: z.number().int().nonnegative().optional(),
  default_record_def_id: z.string().uuid().nullable().optional(),
});

export type UpdateNodeInput = z.infer<typeof UpdateNodeInputSchema>;

/**
 * Move Node Input Schema
 */
export const MoveNodeInputSchema = z.object({
  newParentId: z.string().uuid().nullable(),
  position: z.number().int().nonnegative(),
});

export type MoveNodeInput = z.infer<typeof MoveNodeInputSchema>;

/**
 * Clone Node Input Schema
 */
export const CloneNodeInputSchema = z.object({
  sourceNodeId: z.string().uuid(),
  targetParentId: z.string().uuid().nullable().optional(),
  overrides: z.object({
    title: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
  depth: z.enum(['all', 'process', 'stage', 'subprocess']).optional(),
  includeTemplates: z.boolean().optional(),
  includeRecords: z.boolean().optional(),
});

export type CloneNodeInput = z.infer<typeof CloneNodeInputSchema>;

/**
 * API Response Schemas
 */
export const NodeResponseSchema = z.object({
  node: HierarchyNodeSchema,
});

export const NodesResponseSchema = z.object({
  nodes: z.array(HierarchyNodeSchema),
});

export const ProjectsResponseSchema = z.object({
  projects: z.array(HierarchyNodeSchema),
});
