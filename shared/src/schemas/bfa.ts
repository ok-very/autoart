/**
 * BFA (Ballard Fine Art) Program Schemas
 *
 * Zod schemas for BFA-specific domain types used across frontend and backend.
 * These define the 12-phase canonical system, field authority rules,
 * sync diff reports, and program configuration.
 *
 * Ported from ~/dev/BFA-todo/bfa_pipeline/config.py and differ.py
 */

import { z } from 'zod';

// ============================================================================
// BFA PHASES
// ============================================================================

/**
 * The 12-phase canonical system used by the BFA program.
 * Monday.com is the ground truth for phase assignments.
 */
export const BFA_PHASES = [
  '1. Project Initiation',
  '2. PPAP',
  '3. DPAP',
  '4.1. Artist Selection SP#1',
  '4.2. Artist Selection SP#2',
  '5. Artist Contract',
  '6. Detailed Design',
  '7. Fabrication Start',
  '8. 50% Fabrication',
  '9. 100% Fabrication/Install',
  '10. Final Documents',
  '11. Photo',
  'TBC',
] as const;

export const BfaPhaseSchema = z.enum(BFA_PHASES);
export type BfaPhase = z.infer<typeof BfaPhaseSchema>;

/**
 * Legacy 9-phase system from the Google Docs era.
 * Kept for backward compatibility during migration.
 */
export const BFA_PHASES_LEGACY = [
  'Intake/Scoping',
  'EOI/Shortlist',
  'Artist selected',
  'Contracting',
  'Design development',
  'Approvals',
  'Fabrication',
  'Install',
  'Closeout',
  'TBC',
] as const;

export const BfaPhaseLegacySchema = z.enum(BFA_PHASES_LEGACY);
export type BfaPhaseLegacy = z.infer<typeof BfaPhaseLegacySchema>;

// ============================================================================
// FIELD AUTHORITY
// ============================================================================

/**
 * Who owns a field during sync reconciliation.
 * - 'monday': Monday.com overwrites local value unconditionally
 * - 'local': Local (doc/manual) value is preserved, Monday changes ignored
 * - 'merge': Both sources contribute; conflicts presented for review
 */
export const BfaFieldAuthoritySchema = z.enum(['monday', 'local', 'merge']);
export type BfaFieldAuthority = z.infer<typeof BfaFieldAuthoritySchema>;

// ============================================================================
// PROJECT STATE
// ============================================================================

/**
 * Project health states as tracked in Monday.com.
 * Ordered by severity (worst first) for rollup group resolution.
 */
export const BFA_PROJECT_STATES = [
  'Trouble',
  'Issues',
  'Receivership',
  'On Hold',
  'Low Activity',
  'On Track',
  'TBC',
] as const;

export const BfaProjectStateSchema = z.enum(BFA_PROJECT_STATES);
export type BfaProjectState = z.infer<typeof BfaProjectStateSchema>;

// ============================================================================
// SYNC DIFF TYPES
// ============================================================================

/**
 * Severity of a field change detected during sync.
 */
export const BfaDiffSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type BfaDiffSeverity = z.infer<typeof BfaDiffSeveritySchema>;

/**
 * A single field-level change detected between Monday data and local state.
 */
export const BfaFieldChangeSchema = z.object({
  /** Local entity ID (hierarchy node or record) */
  entityId: z.string().uuid(),
  /** Human-readable project label */
  projectLabel: z.string(),
  /** Dot-path to the field being changed (e.g. 'fields.total_budget') */
  field: z.string(),
  /** Source field name from Monday */
  sourceField: z.string(),
  /** Previous value */
  oldValue: z.string(),
  /** New value from Monday */
  newValue: z.string(),
  /** Change severity */
  severity: BfaDiffSeveritySchema,
  /** Field authority rule that applies */
  authority: BfaFieldAuthoritySchema,
});
export type BfaFieldChange = z.infer<typeof BfaFieldChangeSchema>;

/**
 * A warning or anomaly detected during sync diff.
 */
export const BfaSyncWarningSchema = z.object({
  entityId: z.string().uuid().optional(),
  message: z.string(),
  severity: BfaDiffSeveritySchema,
});
export type BfaSyncWarning = z.infer<typeof BfaSyncWarningSchema>;

/**
 * Rollup group merge result — multiple Monday rows collapsed into one project.
 */
export const BfaRollupResultSchema = z.object({
  entityId: z.string().uuid(),
  label: z.string(),
  strategy: z.string(),
  sourceRowCount: z.number().int(),
  mergedPhase: BfaPhaseSchema,
  mergedBudget: z.string(),
  mergedState: BfaProjectStateSchema,
  mergedArtists: z.array(z.string()),
  changes: z.array(BfaFieldChangeSchema),
});
export type BfaRollupResult = z.infer<typeof BfaRollupResultSchema>;

/**
 * User decision on a field change during reconciliation.
 */
export const BfaSyncDecisionSchema = z.enum(['accept', 'reject', 'defer']);
export type BfaSyncDecision = z.infer<typeof BfaSyncDecisionSchema>;

/**
 * Complete sync diff report for a BFA reconciliation run.
 */
export const BfaSyncDiffReportSchema = z.object({
  /** Unique report ID */
  id: z.string().uuid(),
  /** When the diff was computed */
  createdAt: z.string().datetime(),
  /** Monday board ID that was synced */
  boardId: z.string(),
  /** Field-level changes detected */
  fieldChanges: z.array(BfaFieldChangeSchema),
  /** Rollup group results */
  rollups: z.array(BfaRollupResultSchema),
  /** Warnings and anomalies */
  warnings: z.array(BfaSyncWarningSchema),
  /** Summary statistics */
  stats: z.object({
    totalChanges: z.number().int(),
    projectsAffected: z.number().int(),
    autoAccepted: z.number().int(),
    pendingReview: z.number().int(),
    warnings: z.number().int(),
  }),
});
export type BfaSyncDiffReport = z.infer<typeof BfaSyncDiffReportSchema>;

// ============================================================================
// PROGRAM CONFIGURATION TYPE
// ============================================================================

/**
 * Field authority mapping — which fields Monday.com owns vs local.
 */
export const BfaFieldAuthorityMapSchema = z.record(z.string(), BfaFieldAuthoritySchema);
export type BfaFieldAuthorityMap = z.infer<typeof BfaFieldAuthorityMapSchema>;

/**
 * Column semantic mapping — Monday column to local field path.
 */
export const BfaColumnMappingSchema = z.object({
  /** Monday column ID or title */
  columnKey: z.string(),
  /** Local field path (dot notation) */
  localField: z.string(),
  /** Semantic role for this column */
  semanticRole: z.string(),
  /** Authority for this field */
  authority: BfaFieldAuthoritySchema,
});
export type BfaColumnMapping = z.infer<typeof BfaColumnMappingSchema>;

/**
 * Full BFA program configuration.
 * Defines how the BFA program interprets Monday.com data,
 * which fields have which authority, and phase system rules.
 */
export const BfaProgramConfigSchema = z.object({
  /** Program identifier */
  programId: z.literal('bfa'),
  /** Display name */
  name: z.string(),
  /** Valid phases in the canonical 12-phase system */
  phases: z.array(BfaPhaseSchema),
  /** Phase ordering for regression detection (phase -> index) */
  phaseOrder: z.record(z.string(), z.number()),
  /** Legacy phase migration map (old 9-phase -> new 12-phase) */
  phaseMigration: z.record(z.string(), BfaPhaseSchema),
  /** Excel/Monday phase text normalization (variant text -> canonical) */
  phaseNormalization: z.record(z.string(), BfaPhaseSchema),
  /** Field authority rules */
  fieldAuthority: BfaFieldAuthorityMapSchema,
  /** Column mappings from Monday to local fields */
  columnMappings: z.array(BfaColumnMappingSchema),
  /** Project state severity ordering (state -> priority, lower = worse) */
  statePriority: z.record(z.string(), z.number()),
});
export type BfaProgramConfig = z.infer<typeof BfaProgramConfigSchema>;

// ============================================================================
// SYNC DECISION INPUT/OUTPUT
// ============================================================================

/**
 * A single decision submitted by a user for a field change.
 */
export const BfaSubmitDecisionSchema = z.object({
  entityId: z.string().uuid(),
  field: z.string(),
  decision: BfaSyncDecisionSchema,
  assignedTo: z.string().uuid().optional(),
});
export type BfaSubmitDecision = z.infer<typeof BfaSubmitDecisionSchema>;

/**
 * Batch decision submission input.
 */
export const BfaSubmitDecisionsInputSchema = z.object({
  decisions: z.array(BfaSubmitDecisionSchema),
});
export type BfaSubmitDecisionsInput = z.infer<typeof BfaSubmitDecisionsInputSchema>;

/**
 * Result of applying decisions to local entities.
 */
export const BfaApplyResultSchema = z.object({
  applied: z.number().int(),
  rejected: z.number().int(),
  deferred: z.number().int(),
  errors: z.array(z.object({
    entityId: z.string(),
    field: z.string(),
    error: z.string(),
  })),
});
export type BfaApplyResult = z.infer<typeof BfaApplyResultSchema>;

/**
 * A persisted decision record returned from the API.
 */
export const BfaSyncDecisionRecordSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  entityId: z.string().uuid(),
  field: z.string(),
  sourceField: z.string(),
  oldValue: z.string(),
  newValue: z.string(),
  authority: BfaFieldAuthoritySchema,
  severity: BfaDiffSeveritySchema,
  decision: BfaSyncDecisionSchema.nullable(),
  decidedBy: z.string().uuid().nullable(),
  decidedAt: z.string().datetime().nullable(),
  assignedTo: z.string().uuid().nullable(),
  appliedAt: z.string().datetime().nullable(),
});
export type BfaSyncDecisionRecord = z.infer<typeof BfaSyncDecisionRecordSchema>;
