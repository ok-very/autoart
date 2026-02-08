/**
 * Overlay System Types
 *
 * This file defines the contract for all overlay components.
 *
 * Rules for Overlays (Appendix B):
 * 1. Overlays may NOT mutate global state directly
 * 2. Overlays may NOT fetch initial data (data comes via context)
 * 3. Overlays may NOT resolve references (resolved data comes via context)
 * 4. Overlays MUST emit a single typed result
 * 5. Overlays MUST declare side effects explicitly
 */

// ==================== OVERLAY SIZE ====================

/** Overlay size configuration */
export type OverlaySize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const OVERLAY_SIZES: Record<OverlaySize, number> = {
    sm: 320,
    md: 400,
    lg: 520,
    xl: 640,
    full: 800,
};

// ==================== OVERLAY SIDE EFFECTS ====================

/**
 * Explicit declaration of what side effects an overlay will trigger.
 * This prevents hidden state mutations.
 */
export type OverlaySideEffect =
    | { type: 'create'; entityKind: 'record' | 'node' | 'definition' | 'link' | 'project' | 'connection' }
    | { type: 'update'; entityKind: 'record' | 'node' | 'definition' | 'link' | 'project' | 'connection' }
    | { type: 'delete'; entityKind: 'record' | 'node' | 'definition' | 'link' | 'project' | 'connection' }
    | { type: 'assign'; entityKind: 'record' }
    /** @deprecated Use 'assign' instead */
    | { type: 'classify'; entityKind: 'record' }
    | { type: 'clone'; entityKind: 'definition' | 'project' }
    | { type: 'navigate'; target: string }
    | { type: 'select'; entityKind: 'record' | 'node' };

// ==================== OVERLAY RESULT ====================

/**
 * Result emitted when an overlay action completes.
 * All overlays must emit a result (even if just { success: false }).
 */
export interface OverlayResult<T = unknown> {
    /** Whether the action succeeded */
    success: boolean;
    /** The created/updated entity (if applicable) */
    data?: T;
    /** Error message (if failed) */
    error?: string;
    /** Which side effects were actually triggered */
    sideEffects?: OverlaySideEffect[];
}

// ==================== OVERLAY CONTEXT ====================

/**
 * UI context for traceability.
 * Propagated to API calls for debugging/audit.
 */
export interface OverlayUIContext {
    /** ID of the overlay that triggered the action */
    overlayId: string;
    /** Optional parent overlay (for nested overlays) */
    parentOverlayId?: string;
    /** Timestamp when overlay was opened */
    openedAt: number;
    /** User action that triggered overlay */
    trigger?: string;
}

// ==================== OVERLAY DEFINITION ====================

/**
 * OverlayDefinition - Metadata about an overlay type.
 * Used by OverlayRegistry to validate and render overlays.
 */

export interface OverlayDefinition<TContext = unknown, _TResult = unknown> {
    /** Unique overlay type ID */
    id: string;
    /** Display title */
    title: string;
    /** Overlay size */
    size: OverlaySize;
    /** Declared side effects this overlay may trigger */
    sideEffects: OverlaySideEffect[];
    /** Whether overlay can be dismissed by clicking outside */
    dismissible?: boolean;
    /** Whether to show close button */
    showClose?: boolean;
    /** Validate context before opening */
    validateContext?: (context: TContext) => boolean;
}

// ==================== OVERLAY PROPS ====================

/**
 * OverlayProps - Props passed to overlay view components.
 * This is the contract all overlay views must accept.
 */
export interface OverlayProps<TContext = unknown, TResult = unknown> {
    /** All data needed to render the overlay (no fetching!) */
    context: TContext;
    /** Callback to submit result and close overlay */
    onSubmit: (result: OverlayResult<TResult>) => void;
    /** Callback to close overlay without submitting */
    onClose: () => void;
    /** UI context for traceability */
    uiContext: OverlayUIContext;
}

// ==================== OVERLAY REGISTRY TYPES ====================

/**
 * Map of overlay type IDs to their definitions.
 */
export type OverlayDefinitions = Record<string, OverlayDefinition<unknown, unknown>>;

/**
 * Type-safe overlay opening function.
 */
export interface OpenOverlayFn {
    <K extends keyof OverlayContextMap>(
        type: K,
        context: OverlayContextMap[K],
        uiContext?: Partial<OverlayUIContext>
    ): void;
}

// ==================== OVERLAY CONTEXT MAP ====================

/**
 * Map of overlay IDs to their context types.
 * Extend this as new overlays are added.
 */
export interface OverlayContextMap {
    'create-record': CreateRecordContext;
    'create-node': CreateNodeContext;
    'create-project': CreateProjectContext;
    'create-definition': CreateDefinitionContext;
    'create-link': CreateLinkContext;
    'add-field': AddFieldContext;
    'assign-records': AssignRecordsContext;
    /** @deprecated Use 'assign-records' instead */
    'classify-records': AssignRecordsContext;
    'clone-definition': CloneDefinitionContext;
    'clone-project': CloneProjectContext;
    'confirm-delete': ConfirmDeleteContext;
    'view-record': ViewRecordContext;
    'view-definition': ViewDefinitionContext;
    'project-library': ProjectLibraryContext;
    'ingestion': IngestionContext;
    'integrations': IntegrationsContext;
    'monday-boards': MondayBoardsContext;
    'classification': ClassificationContext;
    'confirm-unlink': ConfirmUnlinkContext;
}

// ==================== CONTEXT TYPES ====================

export interface CreateRecordContext {
    definitionId: string;
    classificationNodeId?: string | null;
    /** Pre-resolved definition (optional - avoids fetch) */
    definition?: {
        id: string;
        name: string;
        styling?: { icon?: string };
        schema_config?: { fields?: Array<{ key: string; label: string; type: string; options?: string[] }> };
    };
}

export interface CreateNodeContext {
    parentId: string;
    nodeType: 'process' | 'stage' | 'subprocess';
    /** Pre-resolved parent info */
    parent?: {
        id: string;
        title: string;
        type: string;
    };
}

export interface CreateProjectContext {
    /** Optional template project to clone from */
    templateId?: string;
}

export interface CreateDefinitionContext {
    /** Optional base definition to copy from */
    copyFromId?: string;
}

export interface CreateLinkContext {
    /** Source record ID */
    sourceRecordId: string;
    /** Pre-resolved source record info */
    sourceRecord?: {
        id: string;
        unique_name: string;
        definition_id: string;
    };
}

export interface AddFieldContext {
    definitionId: string;
    /** Pre-resolved definition */
    definition?: {
        id: string;
        name: string;
        schema_config?: { fields?: Array<{ key: string; label: string; type: string }> };
    };
}

/**
 * Context for hierarchy assignment (formerly "classification").
 * This is for placing records into the hierarchy, not semantic interpretation.
 */
export interface AssignRecordsContext {
    recordIds: string[];
    /** Pre-resolved records info */
    records?: Array<{
        id: string;
        unique_name: string;
    }>;
    /** Success callback */
    onSuccess?: () => void;
}

/** @deprecated Use AssignRecordsContext instead */
export type ClassifyRecordsContext = AssignRecordsContext;

export interface CloneDefinitionContext {
    definitionId: string;
    /** Pre-resolved definition */
    definition?: {
        id: string;
        name: string;
    };
}

export interface CloneProjectContext {
    projectId: string;
    /** Pre-resolved project info */
    project?: {
        id: string;
        title: string;
    };
}

export interface ConfirmDeleteContext {
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning';
}

export interface ViewRecordContext {
    recordId: string;
    /** Pre-resolved record data */
    record?: {
        id: string;
        unique_name: string;
        definition_id: string;
        data: Record<string, unknown>;
    };
}

export interface ViewDefinitionContext {
    definitionId?: string;
    recordId?: string;
}

export interface ProjectLibraryContext {
    projectId?: string;
    projectTitle?: string;
}

export interface IngestionContext {
    /** Target definition for imported records */
    targetDefinitionId?: string;
    /** Target classification node */
    targetNodeId?: string;
}

/** Context for integrations management overlay */
export interface IntegrationsContext {
    /** Optional: pre-select a specific integration tab */
    activeTab?: 'monday' | 'google' | 'api';
}

/** Context for Monday boards selection overlay */
export interface MondayBoardsContext {
    /** Callback when board(s) are selected for import */
    onBoardImport: (boardIds: string[]) => Promise<void>;
    /** Whether import is currently in progress */
    isImporting?: boolean;
}

/** Context for classification resolution overlay */
export interface ClassificationContext {
    /** Import session ID */
    sessionId: string;
    /** Import plan with classifications */
    plan: {
        id: string;
        items: Array<{ tempId: string; title: string }>;
        classifications?: Array<{
            itemTempId: string;
            outcome: string;
            confidence: string;
            rationale: string;
            resolution?: { resolvedOutcome: string };
        }>;
    };
    /** Callback when resolutions are saved */
    onResolutionsSaved: (plan: ClassificationContext['plan']) => void;
}

/** Context for confirm unlink overlay */
export interface ConfirmUnlinkContext {
    /** Type of the source entity */
    sourceType: string;
    /** ID of the source entity */
    sourceId: string;
    /** Type of the target entity being unlinked */
    targetType: string;
    /** ID of the target entity being unlinked */
    targetId: string;
    /** Display title of the target entity */
    targetTitle: string;
    /** Callback when unlink is confirmed */
    onConfirm: () => Promise<void>;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create an OverlayUIContext for a new overlay.
 */
export function createUIContext(overlayId: string, trigger?: string): OverlayUIContext {
    return {
        overlayId,
        openedAt: Date.now(),
        trigger,
    };
}

/**
 * Create a success result.
 */
export function successResult<T>(data?: T, sideEffects?: OverlaySideEffect[]): OverlayResult<T> {
    return { success: true, data, sideEffects };
}

/**
 * Create a failure result.
 */
export function failureResult(error: string): OverlayResult {
    return { success: false, error };
}

/**
 * Create a cancelled result (user closed without action).
 */
export function cancelledResult(): OverlayResult {
    return { success: false };
}
