/**
 * TableCell / TableHeaderCell - Cell primitives with alignment and sizing
 */

import { forwardRef } from 'react';
import { Box, type BoxProps } from '@mantine/core';
import { clsx } from 'clsx';

// ============================================================================
// SHARED TYPES
// ============================================================================

export type CellAlign = 'left' | 'center' | 'right';

interface BaseCellProps extends Omit<BoxProps, 'component'> {
  /** Cell width in pixels, or 'flex' to fill remaining space */
  width?: number | 'flex';
  /** Minimum width for resizable columns */
  minWidth?: number;
  /** Text alignment */
  align?: CellAlign;
  /** Children */
  children?: React.ReactNode;
}

const getWidthStyle = (width?: number | 'flex', minWidth?: number) => {
  if (width === 'flex') {
    return { flex: 1, minWidth: minWidth ?? 0 };
  }
  if (typeof width === 'number') {
    return { width: `${width}px`, minWidth: minWidth ?? width };
  }
  return { flex: 1 };
};

const getAlignClass = (align?: CellAlign) => {
  switch (align) {
    case 'center': return 'text-center justify-center';
    case 'right': return 'text-right justify-end';
    default: return 'text-left justify-start';
  }
};

// ============================================================================
// TABLE HEADER CELL
// ============================================================================

export interface TableHeaderCellProps extends BaseCellProps {
  /** Whether column is sortable (shows cursor) */
  sortable?: boolean;
  /** Current sort direction */
  sortDir?: 'asc' | 'desc' | null;
  /** Sort click handler */
  onSort?: () => void;
}

export const TableHeaderCell = forwardRef<HTMLDivElement, TableHeaderCellProps>(
  function TableHeaderCell(
    { width, minWidth, align, sortable, sortDir, onSort, className, children, style, ...props },
    ref
  ) {
    return (
      <Box
        ref={ref}
        component="div"
        role="columnheader"
        onClick={sortable ? onSort : undefined}
        style={{ ...getWidthStyle(width, minWidth), ...style }}
        className={clsx(
          'relative px-3 flex items-center gap-1 overflow-hidden',
          getAlignClass(align),
          sortable && 'cursor-pointer hover:bg-slate-100 rounded-sm',
          className
        )}
        {...props}
      >
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {children}
        </span>
        {sortable && sortDir && (
          <span className="text-slate-400 text-xs">
            {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
          </span>
        )}
      </Box>
    );
  }
);

// ============================================================================
// TABLE CELL
// ============================================================================

export interface TableCellProps extends BaseCellProps {
  /** Whether cell content should truncate */
  truncate?: boolean;
  /** Click handler for the cell */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const TableCell = forwardRef<HTMLDivElement, TableCellProps>(
  function TableCell(
    { width, minWidth, align, truncate = true, className, children, style, ...props },
    ref
  ) {
    return (
      <Box
        ref={ref}
        component="div"
        role="cell"
        style={{ ...getWidthStyle(width, minWidth), ...style }}
        className={clsx(
          'px-3 flex items-center overflow-hidden text-sm text-slate-700',
          getAlignClass(align),
          truncate && 'truncate',
          className
        )}
        {...props}
      >
        {children}
      </Box>
    );
  }
);
