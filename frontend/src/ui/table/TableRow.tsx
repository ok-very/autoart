/**
 * TableRow / TableHeaderRow - Row primitives with consistent height and states
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

/** Row height variants */
export type RowSize = 'xs' | 'sm' | 'md';

const ROW_HEIGHTS: Record<RowSize, string> = {
  xs: 'h-7',  // 28px - compact headers
  sm: 'h-9',  // 36px - compact rows
  md: 'h-11', // 44px - comfortable rows
};

export interface TableHeaderRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Row height size */
  size?: RowSize;
  /** Whether header sticks to top */
  sticky?: boolean;
  /** Children (cells) */
  children: React.ReactNode;
}

export const TableHeaderRow = forwardRef<HTMLDivElement, TableHeaderRowProps>(
  function TableHeaderRow({ size = 'xs', sticky = true, className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="row"
        className={clsx(
          'flex items-center bg-slate-50 border-b border-slate-200',
          ROW_HEIGHTS[size],
          sticky && 'sticky top-0 z-10',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export interface TableRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Row height size */
  size?: RowSize;
  /** Whether row is selected */
  selected?: boolean;
  /** Whether row shows hover state */
  hoverable?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Double-click handler */
  onDoubleClick?: () => void;
  /** Children (cells) */
  children: React.ReactNode;
}

export const TableRow = forwardRef<HTMLDivElement, TableRowProps>(
  function TableRow(
    { size = 'md', selected, hoverable = true, onClick, onDoubleClick, className, children, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        role="row"
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        className={clsx(
          'flex items-center border-b border-slate-100 transition-colors',
          ROW_HEIGHTS[size],
          hoverable && 'hover:bg-slate-50',
          selected && 'bg-blue-50 hover:bg-blue-100',
          onClick && 'cursor-pointer',
          onClick && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
