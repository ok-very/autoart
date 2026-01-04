/**
 * Table Core Module
 *
 * A domain-agnostic table rendering engine.
 *
 * Usage:
 * - Wrappers (DataTableFlat, DataTableHierarchy) use adapters to create RowModels
 * - Wrappers provide cell() functions that return ReactNodes (e.g., EditableCell)
 * - Core handles rendering, sorting, resizing, and states
 *
 * Architecture:
 * - types.ts: Core contracts (TableRow, TableColumn, RowModel)
 * - features.ts: Plugin system for toolbar/column decoration
 * - UniversalTableCore.tsx: Main rendering component
 * - adapters/: Bridges from domain types to RowModel
 */

// Core types
export type {
    RowId,
    TableRow,
    TableColumn,
    RowModel,
    RowModelCapabilities,
    SortState,
    SortDirection,
} from './types';

// Feature system
export type { TableFeature, TableCtx } from './features';
export { applyColumnDecorators, applyRowDecorators } from './features';

// Main component
export { UniversalTableCore, type UniversalTableCoreProps } from './UniversalTableCore';

// Adapters
export * from './adapters';

