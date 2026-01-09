/**
 * Drawer System Types
 *
 * This file defines the contract for all drawer components.
 *
 * Rules for Drawers (Appendix B):
 * 1. Drawers may NOT mutate global state directly
 * 2. Drawers may NOT fetch initial data (data comes via context)
 * 3. Drawers may NOT resolve references (resolved data comes via context)
 * 4. Drawers MUST emit a single typed result
 * 5. Drawers MUST declare side effects explicitly
 */

// ==================== DRAWER SIZE ====================

/** Drawer size configuration */
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const DRAWER_SIZES: Record<DrawerSize, number> = {
    sm: 320,
    md: 400,
    lg: 520,
    xl: 640,
    full: 800,
};

// ==================== DRAWER SIDE EFFECTS ====================

/**
 * Explicit declaration of what side effects a drawer will trigger.
 * This prevents hidden state mutations.
 */
export type DrawerSideEffect =
    | { type: 'create'; entityType: 'record' | 'node' | 'definition' | 'link' | 'project' | 'connection' }
    | { type: 'update'; entityType: 'record' | 'node' | 'definition' | 'link' | 'project' | 'connection' }
    | { type: 'delete'; entityType: 'record' | 'node' | 'definition' | 'link' | 'project' | 'connection' }
    | { type: 'assign'; entityType: 'record' }
    /** @deprecated Use 'assign' instead */
    | { type: 'classify'; entityType: 'record' }
    | { type: 'clone'; entityType: 'definition' | 'project' }
    | { type: 'navigate'; target: string }
    | { type: 'select'; entityType: 'record' | 'node' };

// ==================== DRAWER RESULT ====================

/**
 * Result emitted when a drawer action completes.
 * All drawers must emit a result (even if just { success: false }).
 */
export interface DrawerResult<T = unknown> {
    /** Whether the action succeeded */
    success: boolean;
    /** The created/updated entity (if applicable) */
    data?: T;
    /** Error message (if failed) */
    error?: string;
    /** Which side effects were actually triggered */
    sideEffects?: DrawerSideEffect[];
}

// ==================== DRAWER CONTEXT ====================

/**
 * UI context for traceability.
 * Propagated to API calls for debugging/audit.
 */
export interface DrawerUIContext {
    /** ID of the drawer that triggered the action */
    drawerId: string;
    /** Optional parent drawer (for nested drawers) */
    parentDrawerId?: string;
    /** Timestamp when drawer was opened */
    openedAt: number;
    /** User action that triggered drawer */
    trigger?: string;
}

// ==================== DRAWER DEFINITION ====================

/**
 * DrawerDefinition - Metadata about a drawer type.
 * Used by DrawerRegistry to validate and render drawers.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface DrawerDefinition<TContext = unknown, _TResult = unknown> {
    /** Unique drawer type ID */
    id: string;
    /** Display title */
    title: string;
    /** Drawer size */
    size: DrawerSize;
    /** Declared side effects this drawer may trigger */
    sideEffects: DrawerSideEffect[];
    /** Whether drawer can be dismissed by clicking outside */
    dismissible?: boolean;
    /** Whether to show close button */
    showClose?: boolean;
    /** Validate context before opening */
    validateContext?: (context: TContext) => boolean;
}

// ==================== DRAWER PROPS ====================

/**
 * DrawerProps - Props passed to drawer view components.
 * This is the contract all drawer views must accept.
 */
export interface DrawerProps<TContext = unknown, TResult = unknown> {
    /** All data needed to render the drawer (no fetching!) */
    context: TContext;
    /** Callback to submit result and close drawer */
    onSubmit: (result: DrawerResult<TResult>) => void;
    /** Callback to close drawer without submitting */
    onClose: () => void;
    /** UI context for traceability */
    uiContext: DrawerUIContext;
}

// ==================== DRAWER REGISTRY TYPES ====================

/**
 * Map of drawer type IDs to their definitions.
 */
export type DrawerDefinitions = Record<string, DrawerDefinition<unknown, unknown>>;

/**
 * Type-safe drawer opening function.
 */
export interface OpenDrawerFn {
    <K extends keyof DrawerContextMap>(
        type: K,
        context: DrawerContextMap[K],
        uiContext?: Partial<DrawerUIContext>
    ): void;
}

// ==================== DRAWER CONTEXT MAP ====================

/**
 * Map of drawer IDs to their context types.
 * Extend this as new drawers are added.
 */
export interface DrawerContextMap {
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
    nodeType: 'process' | 'stage' | 'subprocess' | 'task';
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

/** Context for integrations management drawer */
export interface IntegrationsContext {
    /** Optional: pre-select a specific integration tab */
    activeTab?: 'monday' | 'google' | 'api';
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create a DrawerUIContext for a new drawer.
 */
export function createUIContext(drawerId: string, trigger?: string): DrawerUIContext {
    return {
        drawerId,
        openedAt: Date.now(),
        trigger,
    };
}

/**
 * Create a success result.
 */
export function successResult<T>(data?: T, sideEffects?: DrawerSideEffect[]): DrawerResult<T> {
    return { success: true, data, sideEffects };
}

/**
 * Create a failure result.
 */
export function failureResult(error: string): DrawerResult {
    return { success: false, error };
}

/**
 * Create a cancelled result (user closed without action).
 */
export function cancelledResult(): DrawerResult {
    return { success: false };
}
