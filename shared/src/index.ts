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

// Enums
export {
  NodeTypeSchema,
  RefModeSchema,
  ReferenceStatusSchema,
  FieldTypeSchema,
  // UI View Mode Schemas
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
} from './schemas/enums.js';

// Fields
export {
  FieldDescriptorSchema,
  FieldCategorySchema,
  FieldIndexSchema,
  type FieldDescriptor,
  type FieldCategory,
  type FieldIndex,
} from './schemas/fields.js';

// Hierarchy
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
} from './schemas/hierarchy.js';

// Records & Definitions
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
} from './schemas/records.js';

// References (Action-based - Foundational Model)
export {
  // New Action References
  ActionReferenceSchema,
  CreateActionReferenceInputSchema,
  ActionReferenceResponseSchema,
  ActionReferencesResponseSchema,
  type ActionReference,
  type CreateActionReferenceInput,

  // Deprecated Task References (read-only after migration 022)
  TaskReferenceSchema,
  CreateReferenceInputSchema,
  ReferenceResponseSchema,
  ReferencesResponseSchema,
  type TaskReference,
  type CreateReferenceInput,

  // Shared types
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
} from './schemas/references.js';

// Auth
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
} from './schemas/auth.js';

// Search
export {
  SearchResultSchema,
  SearchQueryInputSchema,
  SearchResponseSchema,
  type SearchResult,
  type SearchQueryInput,
} from './schemas/search.js';

// Links
export {
  RecordLinkSchema,
  CreateLinkInputSchema,
  LinkResponseSchema,
  LinksResponseSchema,
  type RecordLink,
  type CreateLinkInput,
} from './schemas/links.js';

// Tasks
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
} from './schemas/tasks.js';

// Actions & Events (Foundational Model)
export {
  // Context
  ContextTypeSchema,
  type ContextType,

  // Event types
  EventTypeSchema,
  type EventType,

  // Actions
  FieldBindingSchema,
  ActionSchema,
  CreateActionInputSchema,
  type FieldBinding,
  type Action,
  type CreateActionInput,

  // Events
  EventSchema,
  CreateEventInputSchema,
  type Event,
  type CreateEventInput,

  // Action Views (non-reified)
  ActionViewTypeSchema,
  DerivedStatusSchema,
  TaskLikeViewPayloadSchema,
  ActionViewSchema,
  type ActionViewType,
  type DerivedStatus,
  type TaskLikeViewPayload,
  type ActionView,

  // Workflow Surface (materialized projection)
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

  // Action Reference Events
  ActionReferenceAddedPayloadSchema,
  ActionReferenceRemovedPayloadSchema,
  AddActionReferenceInputSchema,
  RemoveActionReferenceInputSchema,
  type ActionReferenceAddedPayload,
  type ActionReferenceRemovedPayload,
  type AddActionReferenceInput,
  type RemoveActionReferenceInput,

  // API Responses
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
} from './schemas/actions.js';

// Composer (Task Builder on Actions + Events)
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
} from './schemas/composer.js';

// Projections (Interpretive Views over Actions/Events)
export {
  type ProjectionPreset,
  type ActionProjectionInput,
  type ContainerInput,
  type StageProjectionOutput,
  type HierarchyProjectionOutput,
  type TimelineProjectionOutput,
  type ProjectionRef,
  type ProjectionSelection,
} from './projections/index.js';

// Domain Events (7 Canonical Families)
export {
  KnownFactKind,
  BaseFactPayloadSchema,
  FactRecordedPayloadSchema,
  FactPayloadSchemas,
  validateFactPayload,
  renderFact,
  // Communication
  InformationSentPayloadSchema,
  // Artifacts
  DocumentPreparedPayloadSchema,
  DocumentSubmittedPayloadSchema,
  // Meetings
  MeetingScheduledPayloadSchema,
  MeetingHeldPayloadSchema,
  MeetingCancelledPayloadSchema,
  // Decisions
  DecisionRecordedPayloadSchema,
  // Financial
  InvoicePreparedPayloadSchema,
  PaymentRecordedPayloadSchema,
  // Contracts
  ContractExecutedPayloadSchema,
  // Process
  ProcessInitiatedPayloadSchema,
  ProcessCompletedPayloadSchema,
  // Types
  type KnownFactKind as FactKind,
  type BaseFactPayload,
  type FactRecordedPayload,
  type InformationSentPayload,
  type DocumentPreparedPayload,
  type MeetingHeldPayload,
  type DecisionRecordedPayload,
  type ContractExecutedPayload,
} from './schemas/domain-events.js';

// Classification Framework
export {
  ClassificationOutcomeSchema,
  ClassificationResultSchema,
  EXECUTION_LOG_OUTCOMES,
  IMPORT_WORKBENCH_ONLY,
  INTERNAL_WORK_PATTERNS,
  isInternalWork,
  type ClassificationOutcome,
  type ClassificationResult,
} from './schemas/classification.js';
