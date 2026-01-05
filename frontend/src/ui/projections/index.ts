/**
 * Projections Module
 *
 * UI-level projection system for grouping and ordering records.
 *
 * Key principle: Projections are UI-level, not domain-level.
 * No persistence authority, no mutation power, no implied ontology.
 */

// Types
export type {
    ProjectionPreset,
    ProjectionContext,
    ProjectionResult,
    ProjectionGroup,
    ProjectionAffordance,
    ProjectionUIHints,
    ProjectionRegistry,
} from './types';

// Presets
export { StageProjection } from './presets';
