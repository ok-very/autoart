// Node Types
export type NodeType = 'project' | 'process' | 'stage' | 'subprocess' | 'task';
export type RefMode = 'static' | 'dynamic';

// Hierarchy Node
export interface HierarchyNode {
  id: string;
  parent_id: string | null;
  root_project_id: string | null;
  type: NodeType;
  title: string;
  description: unknown | null;
  position: number;
  default_record_def_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Record Definition
export interface FieldDef {
  key: string;
  type: 'text' | 'number' | 'email' | 'url' | 'textarea' | 'select' | 'date' | 'checkbox' | 'link';
  label: string;
  required?: boolean;
  options?: string[];
  defaultValue?: unknown;
  /**
   * Whether this field allows # reference triggers.
   * Default: true for text/textarea, false for other types.
   * Can be explicitly set to override the default.
   */
  allowReferences?: boolean;
}

/**
 * Helper to determine if a field allows references based on type and explicit setting.
 */
export function getFieldAllowReferences(fieldDef: FieldDef): boolean {
  // Explicit setting takes precedence
  if (fieldDef.allowReferences !== undefined) {
    return fieldDef.allowReferences;
  }
  // Default: only text and textarea fields allow references
  return ['text', 'textarea'].includes(fieldDef.type);
}

export interface RecordDefinition {
  id: string;
  name: string;
  derived_from_id: string | null;
  project_id: string | null; // If set, belongs to a project's template library
  is_template: boolean; // Marks as reusable template
  clone_excluded: boolean; // If true, not included when cloning projects
  pinned: boolean; // If true, appears in quick create menu
  schema_config: { fields: FieldDef[] };
  styling: { color?: string; icon?: string };
  created_at: string;
}

// Data Record (named to avoid conflict with TypeScript's built-in Record<K,V>)
export interface DataRecord {
  id: string;
  definition_id: string;
  classification_node_id: string | null;
  unique_name: string;
  data: Record<string, unknown>;
  created_by: string | null;
  updated_at: string;
}

// Task Reference
export interface TaskReference {
  id: string;
  task_id: string;
  source_record_id: string | null;
  target_field_key: string | null;
  mode: RefMode;
  snapshot_value: unknown | null;
  created_at: string;
}

// Resolved Reference
export interface ResolvedReference {
  referenceId: string;
  mode: RefMode;
  value: unknown;
  drift: boolean;
  liveValue?: unknown;
  sourceRecordId: string | null;
  targetFieldKey: string | null;
  label: string;
}

// Search Result
export interface SearchResult {
  id: string;
  type: 'record' | 'node';
  name: string;
  path?: string; // Full hierarchy path e.g. "Project.Stage.Subprocess"
  nodeType?: string;
  definitionId?: string;
  definitionName?: string;
  fields?: { key: string; label: string }[];
}

// User
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

// Auth Response
export interface AuthResponse {
  user: User;
  accessToken: string;
}
