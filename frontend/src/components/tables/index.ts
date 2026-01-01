/**
 * Tables Module
 * Modular, schema-driven table components for data display and editing
 *
 * Components:
 * - EditableCell: Single editable cell with inline editing
 * - DataTable: Generic schema-driven table with sorting, expansion, editing
 * - TaskDataTable: Specialized table for HierarchyNode tasks
 * - RecordDataTable: Specialized table for DataRecord items
 * - UniversalTableView: Full-featured view for any record type (the "Unified Visualization")
 *
 * Usage:
 * - Use TaskDataTable for task nodes in workflow views
 * - Use RecordDataTable for floating record tables
 * - Use UniversalTableView for the Records page or any standalone table view
 * - Use DataTable directly for custom data structures
 * - Use fieldsToColumns() to convert FieldDef[] to TableColumn[]
 */

export { EditableCell, type EditableCellProps } from './EditableCell';
export {
    DataTable,
    fieldsToColumns,
    type TableColumn,
    type DataTableProps,
} from './DataTable';
export { TaskDataTable, type TaskDataTableProps } from './TaskDataTable';
export { RecordDataTable, type RecordDataTableProps } from './RecordDataTable';
export { UniversalTableView, type UniversalTableViewProps } from './UniversalTableView';
