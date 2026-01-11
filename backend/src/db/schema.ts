import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// Re-export shared types and schemas for use across the backend
export {
  // Types
  type NodeType,
  type RefMode,
  type FieldType,
  type FieldDef,
  type SchemaConfig,
  type Styling,
  type ResolvedReference,
  type SearchResult,

  // Schemas for validation
  NodeTypeSchema,
  RefModeSchema,
  FieldDefSchema,
  SchemaConfigSchema,
  StylingSchema,
  CreateNodeInputSchema,
  UpdateNodeInputSchema,
  MoveNodeInputSchema,
  CloneNodeInputSchema,
  CreateDefinitionInputSchema,
  UpdateDefinitionInputSchema,
  CreateRecordInputSchema,
  UpdateRecordInputSchema,
  BulkClassifyInputSchema,
  BulkDeleteInputSchema,
  SaveToLibraryInputSchema,
  ToggleCloneExcludedInputSchema,
  CreateReferenceInputSchema,
  UpdateReferenceModeInputSchema,
  UpdateReferenceSnapshotInputSchema,
  BulkResolveInputSchema,
  LoginInputSchema,
  RegisterInputSchema,
  CreateLinkInputSchema,
  SearchQueryInputSchema,
} from '@autoart/shared';

// ============================================
// KYSELY TABLE DEFINITIONS
// These are database-specific and include Generated<> types
// ============================================

// Users Table
export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  name: string;
  created_at: Generated<Date>;
  deleted_at: Date | null;
  deleted_by: string | null;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

// Sessions Table
export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  refresh_token: string;
  expires_at: Date;
  created_at: Generated<Date>;
}

export type Session = Selectable<SessionsTable>;
export type NewSession = Insertable<SessionsTable>;

// Hierarchy Nodes Table
export interface HierarchyNodesTable {
  id: Generated<string>;
  parent_id: string | null;
  root_project_id: string | null;
  type: 'project' | 'process' | 'stage' | 'subprocess' | 'task' | 'subtask';
  title: string;
  description: unknown | null; // TipTap JSON document
  position: Generated<number>;
  default_record_def_id: string | null;
  metadata: Generated<unknown>; // JSONB
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type HierarchyNode = Selectable<HierarchyNodesTable>;
export type NewHierarchyNode = Insertable<HierarchyNodesTable>;
export type HierarchyNodeUpdate = Updateable<HierarchyNodesTable>;

// Record Definitions Table
export interface RecordDefinitionsTable {
  id: Generated<string>;
  name: string;
  derived_from_id: string | null;
  project_id: string | null; // If set, belongs to project's template library
  is_template: Generated<boolean>; // Marks as reusable template
  is_system: Generated<boolean>; // System definitions (Task, Subtask, etc.) - cannot be deleted
  definition_kind: Generated<string>; // 'record' | 'action_recipe' | 'container' - discriminator for definition types
  parent_definition_id: string | null; // For hierarchical types (e.g., Subtask under Task)
  clone_excluded: Generated<boolean>; // If true, definition is NOT cloned when cloning projects
  pinned: Generated<boolean>; // If true, appears in quick create menu
  schema_config: unknown; // JSONB - field definitions
  styling: Generated<unknown>; // JSONB - visual styling
  created_at: Generated<Date>;
}

export type RecordDefinition = Selectable<RecordDefinitionsTable>;
export type NewRecordDefinition = Insertable<RecordDefinitionsTable>;
export type RecordDefinitionUpdate = Updateable<RecordDefinitionsTable>;

// Records Table
export interface RecordsTable {
  id: Generated<string>;
  definition_id: string;
  classification_node_id: string | null;
  unique_name: string;
  data: unknown; // JSONB
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// Named DataRecord to avoid conflict with TypeScript's built-in Record<K,V>
export type DataRecord = Selectable<RecordsTable>;
export type NewDataRecord = Insertable<RecordsTable>;
export type DataRecordUpdate = Updateable<RecordsTable>;

// Task References Table
// DEPRECATED: Read-only after migration 022. Use ActionReferencesTable instead.
// Kept for migration period traceability. Do not write new rows.
export interface TaskReferencesTable {
  id: Generated<string>;
  task_id: string;
  source_record_id: string | null;
  target_field_key: string | null;
  mode: Generated<'static' | 'dynamic'>;
  snapshot_value: unknown | null; // JSONB
  created_at: Generated<Date>;
}

/** @deprecated Use ActionReference instead */
export type TaskReference = Selectable<TaskReferencesTable>;
/** @deprecated Do not create new TaskReferences - use action_references */
export type NewTaskReference = Insertable<TaskReferencesTable>;
/** @deprecated TaskReferences are read-only */
export type TaskReferenceUpdate = Updateable<TaskReferencesTable>;

// Action References Table (Foundational Model)
// Links Actions to Records - replaces TaskReferences
export interface ActionReferencesTable {
  id: Generated<string>;
  action_id: string;
  source_record_id: string | null;
  target_field_key: string | null;
  mode: Generated<'static' | 'dynamic'>;
  snapshot_value: unknown | null; // JSONB
  created_at: Generated<Date>;
  legacy_task_reference_id: string | null; // Traceability back to deprecated task_references
}

export type ActionReference = Selectable<ActionReferencesTable>;
export type NewActionReference = Insertable<ActionReferencesTable>;
export type ActionReferenceUpdate = Updateable<ActionReferencesTable>;

// Record Links Table (Many-to-Many)
export interface RecordLinksTable {
  id: Generated<string>;
  source_record_id: string;
  target_record_id: string;
  link_type: string;
  metadata: Generated<unknown>; // JSONB
  created_by: string | null;
  created_at: Generated<Date>;
}

export type RecordLink = Selectable<RecordLinksTable>;
export type NewRecordLink = Insertable<RecordLinksTable>;
export type RecordLinkUpdate = Updateable<RecordLinksTable>;

// ============================================
// FOUNDATIONAL MODEL TABLES
// Actions hold intent, Events hold truth
// ============================================

/** Context type for scoping actions and events */
export type ContextType = 'subprocess' | 'stage' | 'process' | 'project' | 'record';

// Actions Table - Intent Declarations
// Actions declare that something should or could happen
// NO status, progress, completed_at, or assignee - outcomes are derived from Events
export interface ActionsTable {
  id: Generated<string>;
  context_id: string;
  context_type: ContextType;
  parent_action_id: string | null; // Self-referential for container hierarchy
  definition_id: string | null; // Links to action recipe definition
  type: string;
  field_bindings: Generated<unknown>; // JSONB - bindings to Field definitions
  created_at: Generated<Date>;
}

export type Action = Selectable<ActionsTable>;
export type NewAction = Insertable<ActionsTable>;
// No ActionUpdate - Actions are immutable once created

// Events Table - Immutable Fact Log
// Events record what occurred, never what is
// Append-only: NO UPDATE, NO DELETE
export interface EventsTable {
  id: Generated<string>;
  context_id: string;
  context_type: ContextType;
  action_id: string | null;
  type: string;
  payload: Generated<unknown>; // JSONB - event-specific data
  actor_id: string | null;
  occurred_at: Generated<Date>;
}

export type Event = Selectable<EventsTable>;
export type NewEvent = Insertable<EventsTable>;
// No EventUpdate - Events are immutable (append-only)

// ============================================
// PROJECTION TABLES
// Materialized views of interpreted data - NOT authoritative
// ============================================

// Workflow Surface Nodes Table - Materialized Projection
// Re-computed from Actions + Events whenever events are emitted
// The projector calls interpreter (pure) and writes only UI-facing cached fields
export interface WorkflowSurfaceNodesTable {
  id: Generated<string>;
  surface_type: string;
  context_id: string;
  context_type: ContextType;
  action_id: string;
  parent_action_id: string | null;
  depth: Generated<number>;
  position: Generated<number>;
  payload: Generated<unknown>; // JSONB - cached TaskLikeViewPayload
  flags: Generated<unknown>; // JSONB - { cycleDetected, hasChildren }
  rendered_at: Generated<Date>;
  last_event_occurred_at: Generated<Date>;
}

export type WorkflowSurfaceNode = Selectable<WorkflowSurfaceNodesTable>;
export type NewWorkflowSurfaceNode = Insertable<WorkflowSurfaceNodesTable>;
export type WorkflowSurfaceNodeUpdate = Updateable<WorkflowSurfaceNodesTable>;

// ============================================
// IMPORT TABLES (Migration 025)
// ============================================

// Import Sessions Table
export interface ImportSessionsTable {
  id: Generated<string>;
  parser_name: string;
  status: string;
  raw_data: string;
  parser_config: Generated<unknown>;
  target_project_id: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ImportSession = Selectable<ImportSessionsTable>;
export type NewImportSession = Insertable<ImportSessionsTable>;
export type ImportSessionUpdate = Updateable<ImportSessionsTable>;

// Import Plans Table
export interface ImportPlansTable {
  id: Generated<string>;
  session_id: string;
  plan_data: unknown;
  validation_issues: Generated<unknown>;
  created_at: Generated<Date>;
}

export type ImportPlan = Selectable<ImportPlansTable>;
export type NewImportPlan = Insertable<ImportPlansTable>;
export type ImportPlanUpdate = Updateable<ImportPlansTable>;

// Import Executions Table
export interface ImportExecutionsTable {
  id: Generated<string>;
  session_id: string;
  plan_id: string;
  status: string;
  results: unknown | null;
  started_at: Generated<Date>;
  completed_at: Date | null;
}

export type ImportExecution = Selectable<ImportExecutionsTable>;
export type NewImportExecution = Insertable<ImportExecutionsTable>;
export type ImportExecutionUpdate = Updateable<ImportExecutionsTable>;

// ============================================
// FACT KIND DEFINITIONS TABLE (Migration 028)
// Tracks discovered fact kinds from imports
// ============================================

export interface FactKindDefinitionsTable {
  id: Generated<string>;
  fact_kind: string;
  display_name: string;
  description: string | null;
  payload_schema: Generated<unknown>; // JSONB
  example_payload: unknown | null; // First-seen payload for reference
  source: string; // 'csv-import' | 'manual' | 'system'
  confidence: string; // 'low' | 'medium' | 'high'
  needs_review: Generated<boolean>;
  is_known: Generated<boolean>;
  first_seen_at: Generated<Date>;
  reviewed_at: Date | null;
  reviewed_by: string | null;
}

export type FactKindDefinition = Selectable<FactKindDefinitionsTable>;
export type NewFactKindDefinition = Insertable<FactKindDefinitionsTable>;
export type FactKindDefinitionUpdate = Updateable<FactKindDefinitionsTable>;

// ============================================
// EXTERNAL SYNC TABLES (Migration 032)
// ============================================

// Connection Credentials Table
export interface ConnectionCredentialsTable {
  id: Generated<string>;
  user_id: string | null;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: Date | null;
  scopes: Generated<unknown>;
  metadata: Generated<unknown>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ConnectionCredential = Selectable<ConnectionCredentialsTable>;
export type NewConnectionCredential = Insertable<ConnectionCredentialsTable>;
export type ConnectionCredentialUpdate = Updateable<ConnectionCredentialsTable>;

// External Source Mappings Table
export interface ExternalSourceMappingsTable {
  id: Generated<string>;
  provider: string;
  external_id: string;
  external_type: string;
  local_entity_type: string;
  local_entity_id: string;
  sync_enabled: Generated<boolean>;
  column_mappings: Generated<unknown>;
  last_synced_at: Date | null;
  last_sync_hash: string | null;
  created_at: Generated<Date>;
}

export type ExternalSourceMapping = Selectable<ExternalSourceMappingsTable>;
export type NewExternalSourceMapping = Insertable<ExternalSourceMappingsTable>;
export type ExternalSourceMappingUpdate = Updateable<ExternalSourceMappingsTable>;

// User Settings Table
export interface UserSettingsTable {
  id: Generated<string>;
  user_id: string;
  setting_key: string;
  setting_value: unknown;
  updated_at: Generated<Date>;
}

export type UserSetting = Selectable<UserSettingsTable>;
export type NewUserSetting = Insertable<UserSettingsTable>;
export type UserSettingUpdate = Updateable<UserSettingsTable>;

// Inference Learnings Table
export interface InferenceLearningsTable {
  id: Generated<string>;
  source_type: string;
  input_signature: unknown;
  suggested_mapping: unknown | null;
  user_mapping: unknown;
  project_id: string | null;
  definition_id: string | null;
  applied_count: Generated<number>;
  created_at: Generated<Date>;
}

export type InferenceLearning = Selectable<InferenceLearningsTable>;
export type NewInferenceLearning = Insertable<InferenceLearningsTable>;
export type InferenceLearningUpdate = Updateable<InferenceLearningsTable>;

// ============================================
// EXPORT TABLES (Migration 033)
// ============================================

// Export Sessions Table
export interface ExportSessionsTable {
  id: Generated<string>;
  format: string;
  status: string;
  project_ids: unknown; // JSONB
  options: unknown; // JSONB
  target_config: Generated<unknown>; // JSONB
  projection_cache: unknown | null; // JSONB
  output_url: string | null;
  error: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  executed_at: Date | null;
}

export type ExportSession = Selectable<ExportSessionsTable>;
export type NewExportSession = Insertable<ExportSessionsTable>;
export type ExportSessionUpdate = Updateable<ExportSessionsTable>;

// Database Interface
export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  hierarchy_nodes: HierarchyNodesTable;
  record_definitions: RecordDefinitionsTable;
  records: RecordsTable;
  /** @deprecated Read-only after migration 022 */
  task_references: TaskReferencesTable;
  action_references: ActionReferencesTable;
  record_links: RecordLinksTable;
  actions: ActionsTable;
  events: EventsTable;
  workflow_surface_nodes: WorkflowSurfaceNodesTable;
  import_sessions: ImportSessionsTable;
  import_plans: ImportPlansTable;
  import_executions: ImportExecutionsTable;
  fact_kind_definitions: FactKindDefinitionsTable;
  connection_credentials: ConnectionCredentialsTable;
  external_source_mappings: ExternalSourceMappingsTable;
  user_settings: UserSettingsTable;
  inference_learnings: InferenceLearningsTable;
  export_sessions: ExportSessionsTable;
}


