/**
 * Export Package Schemas
 *
 * Shared Zod schemas and types for the export package queue.
 * Packages are the intake/queue layer; sessions are the execution layer.
 */

import { z } from 'zod';
import { ExportFormatSchema, ExportOptionsSchema } from './exports.js';

// ============================================================================
// ENUMS
// ============================================================================

export const PackageSourceTypeSchema = z.enum([
    'project_selection',
    'collection',
    'import_handoff',
    'record_set',
    'filtered_view',
]);
export type PackageSourceType = z.infer<typeof PackageSourceTypeSchema>;

export const PackageStatusSchema = z.enum([
    'pending',
    'needs_resolution',
    'configuring',
    'ready',
    'projecting',
    'executing',
    'completed',
    'failed',
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

// ============================================================================
// PACKAGE SHAPE (API response)
// ============================================================================

export const ExportPackageSchema = z.object({
    id: z.string().uuid(),
    label: z.string(),
    sourceType: PackageSourceTypeSchema,
    sourcePayload: z.unknown(),
    resolutionState: z.object({
        totalItems: z.number(),
        resolvedItems: z.number(),
        classifications: z.array(z.unknown()),
    }).optional(),
    format: ExportFormatSchema.optional(),
    options: ExportOptionsSchema.optional(),
    targetConfig: z.record(z.string(), z.unknown()).optional(),
    status: PackageStatusSchema,
    projectionCache: z.unknown().optional(),
    outputPath: z.string().optional(),
    outputMimeType: z.string().optional(),
    error: z.string().optional(),
    exportSessionId: z.string().uuid().optional(),
    submittedBy: z.string().uuid().optional(),
    submittedAt: z.string(),
    updatedAt: z.string(),
    executedAt: z.string().optional(),
    position: z.number(),
});
export type ExportPackage = z.infer<typeof ExportPackageSchema>;

// ============================================================================
// SUBMIT BODIES
// ============================================================================

export const SubmitProjectSelectionSchema = z.object({
    sourceType: z.literal('project_selection'),
    label: z.string().optional(),
    projectIds: z.array(z.string().uuid()).min(1),
    format: ExportFormatSchema.optional(),
    options: ExportOptionsSchema.optional(),
});

// Phase 1: only project_selection. More variants added in Phase 2.
export const SubmitPackageBodySchema = z.discriminatedUnion('sourceType', [
    SubmitProjectSelectionSchema,
]);
export type SubmitPackageBody = z.infer<typeof SubmitPackageBodySchema>;

// ============================================================================
// UPDATE BODY
// ============================================================================

export const UpdatePackageBodySchema = z.object({
    label: z.string().optional(),
    format: ExportFormatSchema.optional(),
    options: ExportOptionsSchema.optional(),
    targetConfig: z.record(z.string(), z.unknown()).optional(),
});
export type UpdatePackageBody = z.infer<typeof UpdatePackageBodySchema>;
