/**
 * Molecules - Composite UI elements built from atoms
 *
 * Rules:
 * - Receive FieldViewModel or similar view models via props
 * - Can import atoms from ../atoms
 * - No direct API calls
 * - No raw record/definition access
 * - Transform view models to atom props
 */

// Field display molecules
export { DataFieldWidget, type DataFieldKind, type StatusDisplayConfig, type DataFieldWidgetProps } from './DataFieldWidget';
export { FieldGroup } from './FieldGroup';
export { FieldRenderer, type FieldRendererProps, type FieldRendererCallbacks, type StatusConfig } from './FieldRenderer';
export { ReferenceBlock, type ReferenceBlockProps, type ReferenceStatus, type ReferenceMode } from './ReferenceBlock';
export { ReferenceStatusBadge, type ReferenceStatusBadgeProps, getStatusBgClass, getStatusTextClass } from './ReferenceStatusBadge';

// Input molecules
export { TagsInput } from './TagsInput';

// Table molecules
export { EditableCell, type EditableCellProps } from './EditableCell';
export { StatusColumnSummary, type StatusColumnSummaryProps, type StatusCount, type StatusColorConfig } from './StatusColumnSummary';
export { TableSortHeader, type TableSortHeaderProps } from './TableSortHeader';
export { TableAddRow, type TableAddRowProps } from './TableAddRow';

// Layout molecules
export { PropertySection, type PropertySectionProps } from './PropertySection';

// Navigation molecules
export { MillerColumn, type MillerColumnProps } from './MillerColumn';
