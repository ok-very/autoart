/**
 * @autoart/shared
 *
 * Shared Zod schemas and types for AutoArt Process Management System.
 * This package serves as the single source of truth for data contracts
 * between the frontend and backend.
 *
 * Usage:
 * - Backend: Import schemas for request/response validation
 * - Frontend: Import schemas for runtime parsing + inferred types
 */

// Re-export Zod for convenience
export { z } from 'zod';

// ==================== SCHEMAS ====================
// All Zod schemas and their inferred types (authoritative source)
export * from './schemas/index.js';

// ==================== TYPES ====================
// Pure TypeScript types (projections)
export * from './types/index.js';

// ==================== DOMAIN ====================
// Domain logic: field visibility, completeness, reference resolution, etc.
// Note: ReferenceStatus and ResolvedReference are NOT re-exported here
// because they conflict with schemas. Use schema versions or import domain directly.
export type {
  ProjectState,
  FieldDefinition,
  FieldState,
  MissingField,
  PhaseProgressionResult,
  Reference,
  FieldViewModel,
  EntityContext,
} from './domain/index.js';

export {
  // Field visibility
  getFieldState,
  getFieldStates,
  getVisibleFields,
  isFieldEditable,
  getRequiredFields,
  // Completeness
  isValueMissing,
  getMissingFieldsForEntity,
  getMissingFields,
  getCompletenessPercentage,
  countMissingBySeverity,
  // Reference resolution
  resolveReference,
  resolveReferences,
  detectBrokenReferences,
  referenceTargetExists,
  getReferenceStatusLabel,
  getReferenceStatusSeverity,
  validateReference,
  // Phase progression
  canAdvancePhase,
  getMaxReachablePhase,
  getPhaseReadinessSummary,
  getPhaseBlockers,
  validatePhaseTransition,
  // Field view model
  buildFieldViewModel,
  buildFieldViewModels,
  filterVisibleViewModels,
  groupViewModelsByCategory,
  createEmptyFieldViewModel,
} from './domain/index.js';

export type { BuildFieldViewModelOptions } from './domain/index.js';

// ==================== FORMATTERS ====================
export * from './formatters/index.js';

// ==================== UTILITIES ====================
// Shared utility functions
export { generateId } from './utils.js';

// ==================== INTAKE ====================
// Form generator utilities and schemas
export * from './intake/index.js';
