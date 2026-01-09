/**
 * TableFrame - Scroll container for tables
 *
 * Provides consistent outer chrome: border, background, shadow, overflow handling.
 */

import { forwardRef } from 'react';
import { Box, ScrollArea, type BoxProps } from '@mantine/core';
import { clsx } from 'clsx';

export interface TableFrameProps extends Omit<BoxProps, 'component'> {
  /** Max height before scrolling (default: none) */
  maxHeight?: number | string;
  /** Whether to show subtle shadow */
  shadow?: boolean;
  /** Content */
  children: React.ReactNode;
}

export const TableFrame = forwardRef<HTMLDivElement, TableFrameProps>(
  function TableFrame({ maxHeight, shadow = true, className, children, ...props }, ref) {
    const content = (
      <Box
        ref={ref}
        className={clsx(
          'bg-white border border-slate-200 rounded-lg overflow-hidden',
          shadow && 'shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </Box>
    );

    if (maxHeight) {
      return (
        <ScrollArea.Autosize mah={maxHeight}>
          {content}
        </ScrollArea.Autosize>
      );
    }

    return content;
  }
);
