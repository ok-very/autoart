/**
 * @autoart/shared - Schemas Module
 *
 * Barrel export for all Zod schemas and their inferred types.
 * Organized by functional area for clear module boundaries.
 */

// ==================== ENUMS ====================
export {
    NodeTypeSchema,
    RefModeSchema,
    ReferenceStatusSchema,
    FieldTypeSchema,
    ProjectViewModeSchema,
    RecordsViewModeSchema,
    FieldsViewModeSchema,
    ViewModeSchema,
    PROJECT_VIEW_MODE_LABELS,
    RECORDS_VIEW_MODE_LABELS,
    FIELDS_VIEW_MODE_LABELS,
    type NodeType,
    type RefMode,
    type ReferenceStatus,
    type FieldType,
    type ProjectViewMode,
    type RecordsViewMode,
    type FieldsViewMode,
    type ViewMode,
} from './enums.js';

// ==================== FIELDS ====================
export {
    FieldDescriptorSchema,
    FieldCategorySchema,
    FieldIndexSchema,
    type FieldDescriptor,
    type FieldCategory,
    type FieldIndex,
} from './fields.js';

// ==================== HIERARCHY ====================
export {
    HierarchyNodeSchema,
    CreateNodeInputSchema,
    UpdateNodeInputSchema,
    MoveNodeInputSchema,
    CloneNodeInputSchema,
    NodeResponseSchema,
    NodesResponseSchema,
    ProjectsResponseSchema,
    type HierarchyNode,
    type CreateNodeInput,
    type UpdateNodeInput,
    type MoveNodeInput,
    type CloneNodeInput,
} from './hierarchy.js';

// ==================== RECORDS & DEFINITIONS ====================
export {
    StatusOptionConfigSchema,
    StatusConfigSchema,
    FieldDefSchema,
    SchemaConfigSchema,
    StylingSchema,
    RecordDefinitionSchema,
    DataRecordSchema,
    CreateDefinitionInputSchema,
    UpdateDefinitionInputSchema,
    CreateRecordInputSchema,
    UpdateRecordInputSchema,
    BulkClassifyInputSchema,
    BulkDeleteInputSchema,
    SaveToLibraryInputSchema,
    ToggleCloneExcludedInputSchema,
    RecordStatSchema,
    DefinitionResponseSchema,
    DefinitionsResponseSchema,
    RecordResponseSchema,
    RecordsResponseSchema,
    RecordStatsResponseSchema,
    BulkOperationResponseSchema,
    getFieldAllowReferences,
    type StatusOptionConfig,
    type StatusConfig,
    type FieldDef,
    type SchemaConfig,
    type Styling,
    type RecordDefinition,
    type DataRecord,
    type CreateDefinitionInput,
    type UpdateDefinitionInput,
    type CreateRecordInput,
    type UpdateRecordInput,
    type BulkClassifyInput,
    type BulkDeleteInput,
    type SaveToLibraryInput,
    type ToggleCloneExcludedInput,
    type RecordStat,
} from './records.js';

// ==================== REFERENCES ====================
export {
    ActionReferenceSchema,
    CreateActionReferenceInputSchema,
    ActionReferenceResponseSchema,
    ActionReferencesResponseSchema,
    type ActionReference,
    type CreateActionReferenceInput,
    TaskReferenceSchema,
    CreateReferenceInputSchema,
    ReferenceResponseSchema,
    ReferencesResponseSchema,
    type TaskReference,
    type CreateReferenceInput,
    ResolvedReferenceSchema,
    UpdateReferenceModeInputSchema,
    UpdateReferenceSnapshotInputSchema,
    BulkResolveInputSchema,
    ResolvedReferenceResponseSchema,
    DriftCheckResponseSchema,
    type ResolvedReference,
    type UpdateReferenceModeInput,
    type UpdateReferenceSnapshotInput,
    type BulkResolveInput,
} from './references.js';

// ==================== AUTH ====================
export {
    UserSchema,
    LoginInputSchema,
    RegisterInputSchema,
    AuthResponseSchema,
    RefreshResponseSchema,
    type User,
    type LoginInput,
    type RegisterInput,
    type AuthResponse,
    type RefreshResponse,
} from './auth.js';

// ==================== SEARCH ====================
export {
    SearchResultSchema,
    SearchQueryInputSchema,
    SearchResponseSchema,
    type SearchResult,
    type SearchQueryInput,
} from './search.js';

// ==================== LINKS ====================
export {
    RecordLinkSchema,
    CreateLinkInputSchema,
    LinkResponseSchema,
    LinksResponseSchema,
    type RecordLink,
    type CreateLinkInput,
} from './links.js';

// ==================== TASKS ====================
export {
    TaskStatusSchema,
    TaskMetadataSchema,
    TaskFieldDefSchema,
    TASK_STATUS_CONFIG,
    DEFAULT_TASK_FIELDS,
    parseTaskMetadata,
    deriveTaskStatus,
    coercePercentComplete,
    isActiveStatus,
    getStatusConfig,
    getStatusDisplay,
    type TaskStatus,
    type TaskMetadata,
    type TaskFieldDef,
} from './tasks.js';

// ==================== ACTIONS & EVENTS ====================
export {
    ContextTypeSchema,
    type ContextType,
    EventTypeSchema,
    type EventType,
    FieldBindingSchema,
    ActionSchema,
    CreateActionInputSchema,
    type FieldBinding,
    type Action,
    type CreateActionInput,
    EventSchema,
    CreateEventInputSchema,
    type Event,
    type CreateEventInput,
    ActionViewTypeSchema,
    DerivedStatusSchema,
    TaskLikeViewPayloadSchema,
    ActionViewSchema,
    type ActionViewType,
    type DerivedStatus,
    type TaskLikeViewPayload,
    type ActionView,
    WorkflowSurfaceNodeFlagsSchema,
    WorkflowSurfaceNodeSchema,
    WorkflowSurfaceResponseSchema,
    DependencyEventPayloadSchema,
    WorkflowRowMovedPayloadSchema,
    DependencyInputSchema,
    MoveWorkflowRowInputSchema,
    type WorkflowSurfaceNodeFlags,
    type WorkflowSurfaceNode,
    type WorkflowSurfaceResponse,
    type DependencyEventPayload,
    type WorkflowRowMovedPayload,
    type DependencyInput,
    type MoveWorkflowRowInput,
    ActionReferenceAddedPayloadSchema,
    ActionReferenceRemovedPayloadSchema,
    AddActionReferenceInputSchema,
    RemoveActionReferenceInputSchema,
    type ActionReferenceAddedPayload,
    type ActionReferenceRemovedPayload,
    type AddActionReferenceInput,
    type RemoveActionReferenceInput,
    ActionResponseSchema,
    ActionsResponseSchema,
    EventResponseSchema,
    EventsResponseSchema,
    ActionViewsResponseSchema,
    type ActionResponse,
    type ActionsResponse,
    type EventResponse,
    type EventsResponse,
    type ActionViewsResponse,
} from './actions.js';

// ==================== COMPOSER ====================
export {
    ComposerFieldValueSchema,
    ComposerInputSchema,
    ComposerResponseSchema,
    ActionTypeConfigSchema,
    KNOWN_ACTION_TYPES,
    type ComposerFieldValue,
    type ComposerInput,
    type ComposerResponse,
    type ActionTypeConfig,
} from './composer.js';

// ==================== DOMAIN EVENTS ====================
export {
    KnownFactKind,
    BaseFactPayloadSchema,
    FactRecordedPayloadSchema,
    FactPayloadSchemas,
    validateFactPayload,
    renderFact,
    InformationSentPayloadSchema,
    DocumentPreparedPayloadSchema,
    DocumentSubmittedPayloadSchema,
    MeetingScheduledPayloadSchema,
    MeetingHeldPayloadSchema,
    MeetingCancelledPayloadSchema,
    DecisionRecordedPayloadSchema,
    InvoicePreparedPayloadSchema,
    PaymentRecordedPayloadSchema,
    ContractExecutedPayloadSchema,
    ProcessInitiatedPayloadSchema,
    ProcessCompletedPayloadSchema,
    type KnownFactKind as FactKind,
    type BaseFactPayload,
    type FactRecordedPayload,
    type InformationSentPayload,
    type DocumentPreparedPayload,
    type MeetingHeldPayload,
    type DecisionRecordedPayload,
    type ContractExecutedPayload,
} from './domain-events.js';

// ==================== CLASSIFICATION ====================
export {
    ClassificationOutcomeSchema,
    ClassificationResultSchema,
    EXECUTION_LOG_OUTCOMES,
    IMPORT_WORKBENCH_ONLY,
    INTERNAL_WORK_PATTERNS,
    isInternalWork,
    type ClassificationOutcome,
    type ClassificationResult,
} from './classification.js';

// ==================== EXPORTS ====================
export {
    ExportFormatSchema,
    ExportSessionStatusSchema,
    ExportOptionsSchema,
    DEFAULT_EXPORT_OPTIONS,
    BfaBudgetValueSchema,
    BfaPhaseBudgetSchema,
    BfaMilestoneSchema,
    BfaNextStepBulletSchema,
    BfaProjectExportModelSchema,
    ExportSessionSchema,
    ExportResultSchema,
    type ExportFormat,
    type ExportSessionStatus,
    type ExportOptions,
    type BfaBudgetValue,
    type BfaPhaseBudget,
    type BfaMilestone,
    type BfaNextStepBullet,
    type BfaProjectExportModel,
    type ExportSession,
    type ExportResult,
} from './exports.js';
