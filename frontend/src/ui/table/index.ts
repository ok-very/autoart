/**
 * TableKit - Unified table primitives built on Mantine
 *
 * Provides consistent visual grammar for all table/grid surfaces:
 * - TableFrame: Scroll container with border and background
 * - TableHeaderRow, TableRow: Row containers with consistent height
 * - TableHeaderCell, TableCell: Cell primitives with alignment
 * - Shared tokens for hover, selected, focus states
 *
 * Usage:
 *   import { TableFrame, TableHeaderRow, TableRow, TableCell } from '@/ui/table';
 */

export { TableFrame } from './TableFrame';
export { TableHeaderRow, TableRow } from './TableRow';
export { TableHeaderCell, TableCell } from './TableCell';
export type { TableFrameProps } from './TableFrame';
export type { TableRowProps, TableHeaderRowProps } from './TableRow';
export type { TableCellProps, TableHeaderCellProps } from './TableCell';
