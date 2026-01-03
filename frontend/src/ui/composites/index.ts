/**
 * Composites - High-level UI components that orchestrate molecules
 *
 * Rules:
 * - ONLY composites invoke domain factories (buildFieldViewModel, etc.)
 * - Can access API hooks
 * - Compose molecules and atoms
 * - Handle layout and data flow
 * - No direct field/value manipulation (delegate to domain)
 * 
 * Migration Strategy:
 * These components will be migrated once molecules are wired to domain.
 * Each composite will:
 * 1. Fetch data via API hooks
 * 2. Invoke domain factories (buildFieldViewModel, etc.)
 * 3. Pass view models to molecules
 * 4. Handle user interactions and mutations
 *
 * Components to migrate (in order):
 * 
 * 1. RecordPropertiesView - displays record fields
 *    - Should use buildFieldViewModels() from domain
 *    - Pass FieldViewModels to FieldRenderer molecules
 * 
 * 2. RecordInspector - inspector shell/router
 *    - Thin shell, routes to views
 *    - Accesses stores for selection state
 * 
 * 3. UniversalTableView - dynamic table for any definition
 *    - Uses buildFieldViewModels() for column data
 *    - Renders DataFieldWidget molecules
 * 
 * 4. ProjectWorkflowView - project workflow display
 *    - Uses canAdvancePhase(), getCompletenessPercentage()
 *    - Shows progress via ProgressBar atoms
 * 
 * 5. MillerColumnsView - hierarchy browser
 *    - Tree navigation, less domain-heavy
 */

// Domain-bridging hooks for composites
export * from './hooks';

// Field Input Composites (use API hooks)
export { UserMentionInput, type UserMentionInputProps } from './UserMentionInput';

// View Composites (orchestrate molecules with domain data)
export { RecordPropertiesView } from './RecordPropertiesView';
export { RecordInspector } from './RecordInspector';

// Reusable Table Composites (UI Patterns)
export { DataTableFlat, type DataTableFlatProps, type TableColumn } from './DataTableFlat';
export { DataTableHierarchy, type DataTableHierarchyProps, type HierarchyFieldDef } from './DataTableHierarchy';

// Reusable Record/Hierarchy View Composites
export { RecordList } from './RecordList';
export { ProjectView, type ProjectViewProps } from './ProjectView';
export { MillerColumnsView, type MillerColumnsViewProps } from './MillerColumnsView';

// Ingestion/Import View
export { IngestionView } from './IngestionView';

// Fields View Composites
export { FieldsMillerColumnsView, type FieldsMillerColumnsViewProps } from './FieldsMillerColumnsView';

