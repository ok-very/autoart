import { z } from 'zod';

/**
 * Node type enum - defines the hierarchy levels
 * Includes the 5-level project hierarchy plus subtask for nested tasks
 */
export const NodeTypeSchema = z.enum(['project', 'process', 'stage', 'subprocess', 'task', 'subtask']);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/**
 * Reference mode enum - static vs dynamic references
 * Used for input when creating/updating references
 */
export const RefModeSchema = z.enum(['static', 'dynamic']);
export type RefMode = z.infer<typeof RefModeSchema>;

/**
 * Reference status enum - the 4 possible states of a resolved reference
 * - unresolved: Target record/field not set
 * - dynamic: Live value from source
 * - static: Fixed snapshot value
 * - broken: Target record/field no longer exists
 */
export const ReferenceStatusSchema = z.enum(['unresolved', 'dynamic', 'static', 'broken']);
export type ReferenceStatus = z.infer<typeof ReferenceStatusSchema>;

/**
 * Field type enum - supported field types in record definitions
 */
export const FieldTypeSchema = z.enum([
  'text',
  'number',
  'email',
  'url',
  'textarea',
  'select',
  'date',
  'checkbox',
  'link',
  'status',
  'percent',
  'user',
  'tags',
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

// ============================================================================
// UI VIEW MODE SCHEMAS
// ============================================================================

/**
 * Project view mode enum - views available when viewing a project
 * - log: Event log / execution ledger view (default)
 * - workflow: Kanban-style workflow view
 * - columns: Miller columns hierarchical navigation
 * - grid: Spreadsheet-style data grid
 * - calendar: Calendar view for dated items
 */
export const ProjectViewModeSchema = z.enum(['log', 'workflow', 'columns', 'grid', 'calendar']);
export type ProjectViewMode = z.infer<typeof ProjectViewModeSchema>;

/**
 * Records view mode enum - views available on the records page
 * - list: Standard list/table view of records
 * - ingest: Data ingestion/import interface
 */
export const RecordsViewModeSchema = z.enum(['list', 'ingest']);
export type RecordsViewMode = z.infer<typeof RecordsViewModeSchema>;

/**
 * Fields view mode enum - views available on the fields page
 * - browse: Miller columns browser for field exploration
 * - aggregate: Aggregated field statistics view
 */
export const FieldsViewModeSchema = z.enum(['browse', 'aggregate']);
export type FieldsViewMode = z.infer<typeof FieldsViewModeSchema>;

/**
 * Combined view mode - union of all view modes
 */
export const ViewModeSchema = z.union([ProjectViewModeSchema, RecordsViewModeSchema, FieldsViewModeSchema]);
export type ViewMode = z.infer<typeof ViewModeSchema>;

/**
 * View mode labels for UI display
 */
export const PROJECT_VIEW_MODE_LABELS: Record<ProjectViewMode, string> = {
  log: 'Log',
  workflow: 'Workflow',
  columns: 'Columns',
  grid: 'Data Grid',
  calendar: 'Calendar',
};

export const RECORDS_VIEW_MODE_LABELS: Record<RecordsViewMode, string> = {
  list: 'List',
  ingest: 'Ingest',
};

export const FIELDS_VIEW_MODE_LABELS: Record<FieldsViewMode, string> = {
  browse: 'Browse',
  aggregate: 'Aggregate',
};
