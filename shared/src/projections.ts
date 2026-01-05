/**
 * Projection Presets
 *
 * A ProjectionPreset is a named, reusable interpretation contract.
 * Projections derive view models from immutable facts (actions/events/records).
 * They do NOT create or mutate data - they are pure derivation functions.
 *
 * Key Concepts:
 * - Projections are deterministic: same input → same output
 * - Projections are side-effect-free: no database writes, no API calls
 * - Multiple projections can coexist over the same data
 *
 * Examples:
 * - StageProjection: Groups actions by import.stage_name metadata
 * - HierarchyProjection: Renders a tree of process → subprocess → task
 */

// ============================================================================
// CORE INTERFACE
// ============================================================================

/**
 * ProjectionPreset: A named, reusable interpretation contract.
 *
 * @template TInput - Shape of the data going into the projection
 * @template TOutput - Shape of the derived view model
 */
export interface ProjectionPreset<TInput = unknown, TOutput = unknown> {
    /** Stable identifier (e.g., 'hierarchy-projection', 'stage-projection') */
    id: string;

    /** Human-readable label for UI */
    label: string;

    /** Optional description of what this projection emphasizes */
    description?: string;

    /** Applicability constraints (optional filtering) */
    applicability?: {
        /** Which context types this projection applies to */
        contextTypes?: string[];
        /** Tags that must be present */
        tags?: string[];
    };

    /**
     * Pure derivation function: Input → Output
     * Must be deterministic and have no side effects.
     */
    derive(input: TInput): TOutput;
}

// ============================================================================
// COMMON INPUT TYPES
// ============================================================================

/**
 * Standard input for action-based projections.
 * Actions with their event streams + metadata.
 */
export interface ActionProjectionInput {
    id: string;
    type: string;
    context_type: string;
    context_id: string;
    parent_action_id?: string | null;
    field_bindings?: Array<{ fieldKey: string; value: unknown }>;
    metadata?: Record<string, unknown>;
    events?: Array<{
        id: string;
        event_type: string;
        occurred_at: string;
        payload?: Record<string, unknown>;
    }>;
}

/**
 * Container node input (project, process, subprocess).
 */
export interface ContainerInput {
    id: string;
    type: 'project' | 'process' | 'subprocess';
    title: string;
    parent_id: string | null;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// COMMON OUTPUT TYPES
// ============================================================================

/**
 * Stage projection output: grouped view by stage labels.
 * Used for Kanban-like views without requiring stage containers.
 */
export interface StageProjectionOutput {
    stages: Array<{
        /** Derived stage identifier */
        key: string;
        /** Display name */
        label: string;
        /** Sort order */
        order: number;
        /** Actions in this stage */
        items: ActionProjectionInput[];
    }>;
}

/**
 * Hierarchy projection output: tree structure.
 * Used for tree views (like sidebar hierarchy).
 */
export interface HierarchyProjectionOutput {
    nodes: Array<{
        id: string;
        type: 'project' | 'process' | 'subprocess' | 'task' | 'subtask';
        title: string;
        parentId: string | null;
        children: string[];
        metadata?: Record<string, unknown>;
    }>;
}

/**
 * Timeline projection output: chronological view.
 * Used for Gantt-like or calendar views.
 */
export interface TimelineProjectionOutput {
    entries: Array<{
        id: string;
        title: string;
        startDate: string | null;
        endDate: string | null;
        metadata?: Record<string, unknown>;
    }>;
}

// ============================================================================
// PROJECTION REGISTRY TYPES
// ============================================================================

/**
 * Reference to a registered projection.
 */
export interface ProjectionRef {
    id: string;
    label: string;
    description?: string;
}

/**
 * Projection selection state for a surface.
 */
export interface ProjectionSelection {
    surfaceId: string;
    projectionId: string;
}
