import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// Enums
export type NodeType = 'project' | 'process' | 'stage' | 'subprocess' | 'task';
export type RefMode = 'static' | 'dynamic';

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
  type: NodeType;
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
export interface TaskReferencesTable {
  id: Generated<string>;
  task_id: string;
  source_record_id: string | null;
  target_field_key: string | null;
  mode: Generated<RefMode>;
  snapshot_value: unknown | null; // JSONB
  created_at: Generated<Date>;
}

export type TaskReference = Selectable<TaskReferencesTable>;
export type NewTaskReference = Insertable<TaskReferencesTable>;
export type TaskReferenceUpdate = Updateable<TaskReferencesTable>;

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

// Database Interface
export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  hierarchy_nodes: HierarchyNodesTable;
  record_definitions: RecordDefinitionsTable;
  records: RecordsTable;
  task_references: TaskReferencesTable;
  record_links: RecordLinksTable;
}
