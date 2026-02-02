/**
 * TableCell / TableHeaderCell - Cell primitives with alignment and sizing
 */

import { clsx } from 'clsx';
import { forwardRef, type HTMLAttributes } from 'react';

export type CellAlign = 'left' | 'center' | 'right';

interface BaseCellProps extends HTMLAttributes<HTMLDivElement> {
  /** Cell width in pixels, or 'flex' to fill remaining space */
  width?: number | 'flex';
  /** Minimum width for resizable columns */
  minWidth?: number;
  /** Text alignment */
  align?: CellAlign;
  /** Children */
  children?: React.ReactNode;
}

const getWidthStyle = (width?: number | 'flex', minWidth?: number): React.CSSProperties => {
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
      <div
        ref={ref}
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
        <span className="text-[10px] font-semibold text-ws-text-secondary uppercase tracking-wider truncate">
          {children}
        </span>
        {sortable && sortDir && (
          <span className="text-ws-muted text-xs">
            {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
          </span>
        )}
      </div>
    );
  }
);

export interface TableCellProps extends BaseCellProps {
  /** Whether cell content should truncate */
  truncate?: boolean;
  /** Click handler for the cell */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const TableCell = forwardRef<HTMLDivElement, TableCellProps>(
  function TableCell(
    { width, minWidth, align, truncate = true, className, children, style, onClick, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        role="cell"
        onClick={onClick}
        style={{ ...getWidthStyle(width, minWidth), ...style }}
        className={clsx(
          'px-3 flex items-center overflow-hidden text-sm text-ws-text-secondary',
          getAlignClass(align),
          truncate && 'truncate',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
