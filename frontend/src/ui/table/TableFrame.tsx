/**
 * TableFrame - Scroll container for tables
 *
 * Provides consistent outer chrome: border, background, shadow, overflow handling.
 */

import { clsx } from 'clsx';
import { forwardRef, type HTMLAttributes } from 'react';

export interface TableFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** Max height before scrolling (default: none) */
  maxHeight?: number | string;
  /** Whether to show subtle shadow */
  shadow?: boolean;
  /** Content */
  children: React.ReactNode;
}

export const TableFrame = forwardRef<HTMLDivElement, TableFrameProps>(
  function TableFrame({ maxHeight, shadow = true, className, children, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={clsx(
          'bg-white border border-slate-200 rounded-lg overflow-hidden',
          shadow && 'shadow-sm',
          maxHeight && 'overflow-y-auto',
          className
        )}
        style={{
          ...style,
          ...(maxHeight ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight } : {}),
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
