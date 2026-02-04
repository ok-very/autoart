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
  UpdateReferenceModeInputSchema,
  UpdateReferenceSnapshotInputSchema,
  BulkResolveInputSchema,
  LoginInputSchema,
  RegisterInputSchema,
  UserRoleSchema,
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
  role: Generated<string>; // 'user' | 'admin' | 'viewer'
  avatar_url: string | null;
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
  type: 'project' | 'process' | 'stage' | 'subprocess' | 'template';
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
  definition_kind: Generated<string>; // 'record' | 'action_arrangement' | 'container' - discriminator for definition types
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

// Action References Table (Foundational Model)
// Links Actions to Records
export interface ActionReferencesTable {
  id: Generated<string>;
  action_id: string;
  source_record_id: string | null;
  target_field_key: string | null;
  mode: Generated<'static' | 'dynamic'>;
  snapshot_value: unknown | null; // JSONB
  created_at: Generated<Date>;
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

// Record Aliases Table (Naming History)
export interface RecordAliasesTable {
  id: Generated<string>;
  record_id: string;
  name: string;
  type: string; // 'primary', 'historical', 'alias'
  created_at: Generated<Date>;
}

export type RecordAlias = Selectable<RecordAliasesTable>;
export type NewRecordAlias = Insertable<RecordAliasesTable>;
export type RecordAliasUpdate = Updateable<RecordAliasesTable>;

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
  definition_id: string | null; // Links to action arrangement definition
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
  workspace_id: string | null; // Added in migration 038
  external_board_id: string | null; // Added in migration 038
  external_group_id: string | null; // Added in migration 038
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
  output_path: string | null;
  output_mime_type: string | null;
  error: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  executed_at: Date | null;
}

export type ExportSession = Selectable<ExportSessionsTable>;
export type NewExportSession = Insertable<ExportSessionsTable>;
export type ExportSessionUpdate = Updateable<ExportSessionsTable>;

// ============================================
// MONDAY WORKSPACE TABLES (Migration 038)
// Configuration-driven Monday.com integration
// ============================================

// Monday Workspaces Table
export interface MondayWorkspacesTable {
  id: Generated<string>;
  name: string;
  provider_account_id: string | null;
  default_project_id: string | null;
  settings: Generated<unknown>; // JSONB
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type MondayWorkspace = Selectable<MondayWorkspacesTable>;
export type NewMondayWorkspace = Insertable<MondayWorkspacesTable>;
export type MondayWorkspaceUpdate = Updateable<MondayWorkspacesTable>;

// Monday Board Configs Table
export interface MondayBoardConfigsTable {
  id: Generated<string>;
  workspace_id: string;
  board_id: string;
  board_name: string;
  role: string;
  linked_project_id: string | null;
  template_scope: string | null;
  sync_direction: Generated<string>;
  sync_enabled: Generated<boolean>;
  settings: Generated<unknown>; // JSONB
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type MondayBoardConfig = Selectable<MondayBoardConfigsTable>;
export type NewMondayBoardConfig = Insertable<MondayBoardConfigsTable>;
export type MondayBoardConfigUpdate = Updateable<MondayBoardConfigsTable>;

// Monday Group Configs Table
export interface MondayGroupConfigsTable {
  id: Generated<string>;
  board_config_id: string;
  group_id: string;
  group_title: string;
  role: string;
  stage_order: number | null;
  stage_kind: string | null;
  subprocess_name_override: string | null;
  settings: Generated<unknown>; // JSONB
  created_at: Generated<Date>;
}

export type MondayGroupConfig = Selectable<MondayGroupConfigsTable>;
export type NewMondayGroupConfig = Insertable<MondayGroupConfigsTable>;
export type MondayGroupConfigUpdate = Updateable<MondayGroupConfigsTable>;

// Monday Column Configs Table
export interface MondayColumnConfigsTable {
  id: Generated<string>;
  board_config_id: string;
  column_id: string;
  column_title: string;
  column_type: string;
  semantic_role: string;
  local_field_key: string | null;
  fact_kind_id: string | null;
  render_hint: string | null;
  is_required: Generated<boolean>;
  multi_valued: Generated<boolean>;
  settings: Generated<unknown>; // JSONB
  created_at: Generated<Date>;
}

export type MondayColumnConfig = Selectable<MondayColumnConfigsTable>;
export type NewMondayColumnConfig = Insertable<MondayColumnConfigsTable>;
export type MondayColumnConfigUpdate = Updateable<MondayColumnConfigsTable>;

// Monday Sync States Table
export interface MondaySyncStatesTable {
  id: Generated<string>;
  board_config_id: string;
  last_activity_log_id: string | null;
  last_synced_at: Date | null;
  sync_cursor: unknown | null; // JSONB
  items_synced: Generated<number>;
  errors: Generated<unknown>; // JSONB
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type MondaySyncState = Selectable<MondaySyncStatesTable>;
export type NewMondaySyncState = Insertable<MondaySyncStatesTable>;
export type MondaySyncStateUpdate = Updateable<MondaySyncStatesTable>;

// ============================================
// INTAKE FORMS TABLES (Migration 041)
// Public form generator and submissions
// ============================================

export type IntakeFormStatus = 'active' | 'disabled';

export interface IntakeFormsTable {
  id: Generated<string>;
  unique_id: string;
  title: string;
  status: Generated<IntakeFormStatus>;
  sharepoint_request_url: string | null;
  created_at: Generated<Date>;
}

export type IntakeForm = Selectable<IntakeFormsTable>;
export type NewIntakeForm = Insertable<IntakeFormsTable>;
export type IntakeFormUpdate = Updateable<IntakeFormsTable>;

export interface IntakeFormPagesTable {
  id: Generated<string>;
  form_id: string;
  page_index: number;
  blocks_config: unknown; // JSONB - IntakePageConfig { blocks: FormBlock[], settings? }
}

export type IntakeFormPage = Selectable<IntakeFormPagesTable>;
export type NewIntakeFormPage = Insertable<IntakeFormPagesTable>;
export type IntakeFormPageUpdate = Updateable<IntakeFormPagesTable>;

export interface IntakeSubmissionsTable {
  id: Generated<string>;
  form_id: string;
  upload_code: string;
  metadata: unknown; // JSONB
  created_records: Generated<unknown>; // JSONB - [{ definitionId, recordId, uniqueName }]
  created_at: Generated<Date>;
}

export type IntakeSubmission = Selectable<IntakeSubmissionsTable>;
export type NewIntakeSubmission = Insertable<IntakeSubmissionsTable>;
export type IntakeSubmissionUpdate = Updateable<IntakeSubmissionsTable>;

// ============================================
// POLLS TABLES (Migration 045)
// Time-slot availability polling
// ============================================

export type PollStatus = 'active' | 'closed' | 'draft';

export interface PollsTable {
  id: Generated<string>;
  unique_id: string;
  title: string;
  description: string | null;
  status: Generated<PollStatus>;
  time_config: unknown; // JSONB - PollTimeConfig
  project_id: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  closed_at: Date | null;
}

export type Poll = Selectable<PollsTable>;
export type NewPoll = Insertable<PollsTable>;
export type PollUpdate = Updateable<PollsTable>;

export interface PollResponsesTable {
  id: Generated<string>;
  poll_id: string;
  participant_name: string;
  participant_email: string | null;
  available_slots: Generated<unknown>; // JSONB - string[]
  user_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type PollResponse = Selectable<PollResponsesTable>;
export type NewPollResponse = Insertable<PollResponsesTable>;
export type PollResponseUpdate = Updateable<PollResponsesTable>;

// ============================================
// ENGAGEMENTS TABLE (Migration 046)
// General-purpose engagement tracking
// ============================================

export interface EngagementsTable {
  id: Generated<string>;
  kind: string;
  context_type: string; // 'poll', 'form', 'page' - different from ContextType enum
  context_id: string; // poll unique_id (slug), form id, or page path
  actor_name: string | null;
  payload: unknown | null; // JSONB
  occurred_at: Date | null;
  created_at: Generated<Date>;
}

export type Engagement = Selectable<EngagementsTable>;
export type NewEngagement = Insertable<EngagementsTable>;
export type EngagementUpdate = Updateable<EngagementsTable>;

// Project Members Table (Many-to-Many: Projects <-> Users)
export interface ProjectMembersTable {
  id: Generated<string>;
  project_id: string;
  user_id: string;
  role: Generated<string>; // 'owner' | 'member' | 'viewer'
  assigned_at: Generated<Date>;
  assigned_by: string | null;
}

export type ProjectMember = Selectable<ProjectMembersTable>;
export type NewProjectMember = Insertable<ProjectMembersTable>;
export type ProjectMemberUpdate = Updateable<ProjectMembersTable>;

// ============================================
// MAIL TABLES (Migration 052)
// Promoted emails from AutoHelper + polymorphic links
// ============================================

export interface MailMessagesTable {
  id: Generated<string>;
  external_id: string;
  subject: string | null;
  sender: string | null;
  sender_name: string | null;
  received_at: Date | null;
  body_preview: string | null;
  body_html: string | null;
  metadata: Generated<unknown>; // JSONB
  project_id: string | null;
  promoted_at: Generated<Date>;
  promoted_by: string;
  created_at: Generated<Date>;
}

export type MailMessage = Selectable<MailMessagesTable>;
export type NewMailMessage = Insertable<MailMessagesTable>;
export type MailMessageUpdate = Updateable<MailMessagesTable>;

export interface MailLinksTable {
  id: Generated<string>;
  mail_message_id: string;
  target_type: string; // 'action' | 'record' | 'hierarchy_node'
  target_id: string;
  created_at: Generated<Date>;
  created_by: string;
}

export type MailLink = Selectable<MailLinksTable>;
export type NewMailLink = Insertable<MailLinksTable>;

// ============================================
// AUTOHELPER TABLES (Migration 054)
// Settings bridge for remote AutoHelper management
// ============================================

export interface AutoHelperInstancesTable {
  id: Generated<string>;
  user_id: string;
  settings: Generated<unknown>; // JSONB - AutoHelper config
  settings_version: Generated<number>;
  status: Generated<unknown>; // JSONB - cached health/status
  last_seen: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type AutoHelperInstance = Selectable<AutoHelperInstancesTable>;
export type NewAutoHelperInstance = Insertable<AutoHelperInstancesTable>;
export type AutoHelperInstanceUpdate = Updateable<AutoHelperInstancesTable>;

export type CommandStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AutoHelperCommandsTable {
  id: Generated<string>;
  user_id: string;
  command_type: string;
  payload: Generated<unknown>; // JSONB
  status: Generated<string>; // CommandStatus
  result: unknown | null; // JSONB
  created_at: Generated<Date>;
  acknowledged_at: Date | null;
}

export type AutoHelperCommand = Selectable<AutoHelperCommandsTable>;
export type NewAutoHelperCommand = Insertable<AutoHelperCommandsTable>;
export type AutoHelperCommandUpdate = Updateable<AutoHelperCommandsTable>;

// Database Interface
export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  hierarchy_nodes: HierarchyNodesTable;
  record_definitions: RecordDefinitionsTable;
  records: RecordsTable;
  action_references: ActionReferencesTable;
  record_links: RecordLinksTable;
  record_aliases: RecordAliasesTable;
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

  monday_workspaces: MondayWorkspacesTable;
  monday_board_configs: MondayBoardConfigsTable;
  monday_group_configs: MondayGroupConfigsTable;
  monday_column_configs: MondayColumnConfigsTable;
  monday_sync_states: MondaySyncStatesTable;
  intake_forms: IntakeFormsTable;
  intake_form_pages: IntakeFormPagesTable;
  intake_submissions: IntakeSubmissionsTable;
  polls: PollsTable;
  poll_responses: PollResponsesTable;
  engagements: EngagementsTable;
  project_members: ProjectMembersTable;
  mail_messages: MailMessagesTable;
  mail_links: MailLinksTable;
  autohelper_instances: AutoHelperInstancesTable;
  autohelper_commands: AutoHelperCommandsTable;
}


