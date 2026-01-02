/**
 * @autoart/shared - Domain Module
 *
 * Canonical domain logic for AutoArt's business rules.
 * This module is the single source of truth for:
 * - Field visibility and editability
 * - Data completeness
 * - Reference resolution
 * - Phase progression
 * - FieldViewModel construction
 *
 * RULES:
 * - This module has ZERO UI dependencies
 * - Backend services MUST import from here, not reimplement
 * - Frontend may wrap these, but must not redefine them
 */

// ==================== TYPES ====================

export type {
    ProjectState,
    FieldDefinition,
    FieldState,
    MissingField,
    PhaseProgressionResult,
    ReferenceStatus,
    Reference,
    ResolvedReference,
    FieldViewModel,
    EntityContext,
} from './types';

// ==================== FIELD VISIBILITY ====================

export {
    getFieldState,
    getFieldStates,
    getVisibleFields,
    isFieldEditable,
    getRequiredFields,
} from './fieldVisibility';

// ==================== COMPLETENESS ====================

export {
    isValueMissing,
    getMissingFieldsForEntity,
    getMissingFields,
    getCompletenessPercentage,
    countMissingBySeverity,
} from './completeness';

// ==================== REFERENCE RESOLUTION ====================

export {
    resolveReference,
    resolveReferences,
    detectBrokenReferences,
    referenceTargetExists,
    getReferenceStatusLabel,
    getReferenceStatusSeverity,
    validateReference,
} from './referenceResolution';

// ==================== PHASE PROGRESSION ====================

export {
    canAdvancePhase,
    getMaxReachablePhase,
    getPhaseReadinessSummary,
    getPhaseBlockers,
    validatePhaseTransition,
} from './phaseProgression';

// ==================== FIELD VIEW MODEL ====================

export type { BuildFieldViewModelOptions } from './fieldViewModel';

export {
    buildFieldViewModel,
    buildFieldViewModels,
    filterVisibleViewModels,
    groupViewModelsByCategory,
    createEmptyFieldViewModel,
} from './fieldViewModel';
