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
}

