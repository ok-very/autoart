/**
 * Tables Module
 * Modular, schema-driven table components for data display and editing
 *
 * Components:
 * - EditableCell: Single editable cell with inline editing
 * - DataTable: Generic schema-driven table with sorting, expansion, editing
 * - UniversalTableView: Full-featured view for any record type (the "Unified Visualization")
 *
 * Usage:
 * - Use DataTableHierarchy (from ui/composites) for task nodes in workflow views
 * - Use DataTableFlat (from ui/composites) for record tables
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
export { UniversalTableView, type UniversalTableViewProps } from './UniversalTableView';
