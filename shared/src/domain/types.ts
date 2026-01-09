/**
 * @autoart/shared - Domain Types
 *
 * Core domain interfaces for AutoArt's business logic.
 * These types define the contracts between UI and backend
 * for field visibility, completeness, references, and phase progression.
 *
 * RULE: This module has ZERO UI dependencies.
 * RULE: Backend services MUST import from here, not reimplement.
 */

import type { FieldDef, RecordDefinition, DataRecord } from '../schemas/records.js';
import type { HierarchyNode } from '../schemas/hierarchy.js';

// ==================== PROJECT STATE ====================

/**
 * ProjectState - The complete state of a project for domain rule evaluation.
 *
 * This is the primary input to all domain functions. It contains everything
 * needed to compute field visibility, completeness, and phase progression.
 */
export interface ProjectState {
    /** The project node ID */
    projectId: string;

    /** Current phase (0-indexed) */
    phase: number;

    /** All hierarchy nodes in the project (processes, stages, subprocesses, tasks) */
    nodes: HierarchyNode[];

    /** All records associated with this project */
    records: DataRecord[];

    /** All record definitions available to this project */
    definitions: RecordDefinition[];

    /** Project-level metadata */
    metadata: Record<string, unknown>;
}

// ==================== FIELD DEFINITION ====================

/**
 * FieldDefinition - Extended field metadata for domain rule evaluation.
 *
 * Extends the base FieldDef with phase and deprecation info.
 */
export interface FieldDefinition extends FieldDef {
    /** The phase at which this field becomes relevant (0-indexed) */
    phase?: number;

    /** Whether this field is deprecated (blocks new writes) */
    deprecated?: boolean;

    /** Category for grouping in UI */
    category?: string;
}

// ==================== FIELD STATE ====================

/**
 * FieldState - The computed state of a field given project context.
 *
 * Determines whether a field should be visible, editable, or required.
 * No UI component should compute these rules directly.
 */
export interface FieldState {
    /** The field identifier */
    fieldId: string;

    /** Whether the field should be shown in UI */
    visible: boolean;

    /** Whether the field can be edited */
    editable: boolean;

    /** Whether the field is required for phase completion */
    required: boolean;

    /** Human-readable reason for this state (for tooltips/logs) */
    reason?: string;
}

// ==================== MISSING FIELDS ====================

/**
 * MissingField - A field that is incomplete or missing.
 *
 * Used for progress indicators, notifications, and export readiness.
 */
export interface MissingField {
    /** The field identifier */
    fieldId: string;

    /** The phase that requires this field */
    phase: number;

    /** Whether this blocks progression or is just a warning */
    severity: 'blocking' | 'warning';

    /** Human-readable label for display */
    label?: string;

    /** The entity (node/record) that has the missing field */
    entityId?: string;

    /** The type of entity */
    entityType?: 'node' | 'record';
}

// ==================== PHASE PROGRESSION ====================

/**
 * PhaseProgressionResult - Whether a project can advance to the next phase.
 */
export interface PhaseProgressionResult {
    /** Whether advancement is allowed */
    allowed: boolean;

    /** Fields that block advancement */
    blockers: MissingField[];

    /** Fields that are warnings but don't block */
    warnings: MissingField[];
}

// ==================== REFERENCES ====================

/**
 * ReferenceStatus - The resolution state of a reference.
 *
 * - unresolved: Reference exists but target not yet determined
 * - dynamic: Reference resolves to a live computed value
 * - static: Reference resolves to a fixed snapshot value
 * - broken: Reference target no longer exists or is inaccessible
 *
 * Note: This type is also defined as a Zod schema in schemas/enums.ts.
 * Both must stay in sync.
 */
export type ReferenceStatus = 'unresolved' | 'dynamic' | 'static' | 'broken';

/**
 * Reference - A link from a field to another entity.
 */
export interface Reference {
    /** Unique reference identifier */
    referenceId: string;

    /** The field that contains the reference */
    sourceField: string;

    /** The target entity ID */
    targetId: string;

    /** Resolution mode */
    mode: 'dynamic' | 'static';
}

/**
 * ResolvedReference - A reference with its computed state.
 *
 * Frontend never resolves values directly - backend is authoritative.
 * This domain type describes the contract for resolved references.
 *
 * Note: The Zod schema in schemas/references.ts is the source of truth
 * for API serialization. This type documents the domain invariants.
 */
export interface ResolvedReference {
    /** The reference identifier */
    referenceId: string;

    /** Current resolution status - determines how value is interpreted */
    status: ReferenceStatus;

    /** The resolved value (populated when status is dynamic or static) */
    value?: unknown;

    /** Human-readable label for display */
    label: string;

    /** Source record ID (if resolvable) */
    sourceRecordId: string | null;

    /** Target field key (if resolvable) */
    targetFieldKey: string | null;

    /** 
     * @deprecated Use status instead. Kept for backward compatibility.
     * True if static snapshot differs from live value.
     */
    drift?: boolean;

    /** Live value from source (for drift detection in static mode) */
    liveValue?: unknown;

    /** Human-readable reason for the status (especially for broken/unresolved) */
    reason?: string;
}

// ==================== FIELD VIEW MODEL ====================

/**
 * FieldViewModel - The complete view model for rendering a field.
 *
 * This is the sole input to field rendering components.
 * Composites build these from domain functions; molecules/atoms only consume.
 */
export interface FieldViewModel {
    /** Unique field identifier */
    fieldId: string;

    /** Display label */
    label: string;

    /** Current value */
    value: unknown;

    /** Field type for rendering */
    type: string;

    /** Semantic hint for specialized rendering (e.g., 'email', 'phone', 'person') */
    renderHint?: string;

    /** Whether field is visible */
    visible: boolean;

    /** Whether field is editable */
    editable: boolean;

    /** Whether field is required */
    required: boolean;

    /** Validation error message (if any) */
    error?: string;

    /** Options for select/status fields */
    options?: string[];

    /** Placeholder text */
    placeholder?: string;

    /** Help text */
    helpText?: string;

    /** Width hint for layout */
    width?: number | 'flex';
}

// ==================== ENTITY CONTEXT ====================

/**
 * EntityContext - Context about the entity being edited.
 *
 * Provides additional context for field state computation.
 */
export interface EntityContext {
    /** The entity ID (node or record) */
    entityId: string;

    /** Type of entity */
    entityType: 'node' | 'record';

    /** The entity's definition ID (for records) */
    definitionId?: string;

    /** The entity's parent ID (for nodes) */
    parentId?: string;

    /** The entity's type (for nodes) */
    nodeType?: string;
}
