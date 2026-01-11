/**
 * Projection Presets - UI-Level Projection System
 *
 * These interfaces define UI-level projections that map records into
 * grouped, ordered, or flattened structures for presentation.
 *
 * Key principles:
 * - No persistence authority
 * - No mutation power
 * - No implied ontology
 * - A projection can suggest meaning but never enforce it
 *
 * Decision rule: "Would this belong in the Action Inspector?"
 * - If yes → projection
 * - If no → persistence
 * - If unclear → event
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * ProjectionPreset - A reusable UI-level grouping/ordering strategy
 *
 * @template TRecord - The type of records being projected
 */
export interface ProjectionPreset<TRecord = unknown> {
    /** Unique identifier for this projection */
    id: string;

    /** Human-readable label for the projection */
    label: string;

    /** Optional description for UI tooltips */
    description?: string;

    /**
     * Determines whether this projection is applicable
     * to the current dataset/context.
     */
    appliesTo: (context: ProjectionContext) => boolean;

    /**
     * Maps records into grouped, ordered, or flattened
     * structures for presentation.
     */
    project: (records: TRecord[], context: ProjectionContext) => ProjectionResult<TRecord>;

    /**
     * Optional affordances exposed by this projection.
     * Must not mutate records directly.
     */
    affordances?: ProjectionAffordance[];

    /**
     * Metadata for UI hints, not logic.
     */
    ui?: ProjectionUIHints;
}

// ============================================================================
// CONTEXT & INPUT
// ============================================================================

/**
 * ProjectionContext - Runtime context for projection execution
 */
export interface ProjectionContext {
    /** Current workspace/project ID */
    workspaceId: string;

    /** Current user ID */
    userId: string;

    /** User preferences that may affect projections */
    preferences: Record<string, unknown>;

    /** Optional filter criteria */
    filters?: Record<string, unknown>;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * ProjectionResult - The output of a projection
 *
 * Either grouped output or flat output (or both for hybrid views)
 */
export interface ProjectionResult<T> {
    /** Grouped output - records organized by some criterion */
    groups?: ProjectionGroup<T>[];

    /** Flat output - ordered list without grouping */
    flat?: T[];
}

/**
 * ProjectionGroup - A single group within a projection result
 */
export interface ProjectionGroup<T> {
    /** Unique identifier for this group */
    id: string;

    /** Human-readable label for the group */
    label: string;

    /** Items in this group */
    items: T[];

    /** Optional metadata about the group */
    meta?: Record<string, unknown>;

    /** Nested groups (for hierarchical projections) */
    children?: ProjectionGroup<T>[];
}

// ============================================================================
// AFFORDANCES
// ============================================================================

/**
 * ProjectionAffordance - Actions that a projection can suggest
 *
 * These are UI hints only - the projection cannot execute them directly.
 */
export interface ProjectionAffordance {
    /** Unique identifier */
    id: string;

    /** Human-readable label */
    label: string;

    /** Optional icon name */
    icon?: string;

    /** Intent classification */
    intent: 'navigate' | 'filter' | 'annotate' | 'group';

    /** Optional payload for the affordance */
    payload?: Record<string, unknown>;
}

// ============================================================================
// UI HINTS
// ============================================================================

/**
 * ProjectionUIHints - Visual presentation hints
 */
export interface ProjectionUIHints {
    /** Icon name for the projection selector */
    icon?: string;

    /** Whether groups should be collapsed by default */
    defaultCollapsed?: boolean;

    /** Color theme for this projection */
    colorScheme?: string;

    /** Sort order in projection selector */
    sortOrder?: number;
}

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * ProjectionRegistry - Collection of available projections
 */
export interface ProjectionRegistry<TRecord = unknown> {
    /** All registered projections */
    projections: ProjectionPreset<TRecord>[];

    /** Get applicable projections for a context */
    getApplicable: (context: ProjectionContext) => ProjectionPreset<TRecord>[];

    /** Get a projection by ID */
    getById: (id: string) => ProjectionPreset<TRecord> | undefined;
}
