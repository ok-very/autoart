/**
 * Popover - A robust, accessible popover component using Radix UI.
 * 
 * Provides automatic positioning, focus management, and accessibility.
 * Use for tooltips, popovers, emoji pickers, and any floating content.
 */

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { clsx } from 'clsx';
import { forwardRef, ReactNode } from 'react';

// Re-export composable parts for advanced usage
export const PopoverRoot = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverContentProps {
    children: ReactNode;
    className?: string;
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
    ({ children, className, sideOffset = 8, align = 'center', side = 'bottom' }, ref) => (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                ref={ref}
                className={clsx(
                    'z-50 rounded-lg border border-slate-200 bg-white shadow-xl outline-none',
                    'data-[state=open]:animate-in data-[state=closed]:animate-out',
                    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                    'data-[side=bottom]:slide-in-from-top-2',
                    'data-[side=left]:slide-in-from-right-2',
                    'data-[side=right]:slide-in-from-left-2',
                    'data-[side=top]:slide-in-from-bottom-2',
                    className
                )}
                sideOffset={sideOffset}
                align={align}
                side={side}
            >
                {children}
            </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
    )
);

PopoverContent.displayName = 'PopoverContent';

// Convenience wrapper for simple use cases
export interface PopoverProps {
    trigger: ReactNode;
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    contentClassName?: string;
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Popover({
    trigger,
    children,
    open,
    onOpenChange,
    contentClassName,
    sideOffset = 8,
    align = 'center',
    side = 'bottom',
}: PopoverProps) {
    return (
        <PopoverRoot open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent
                className={contentClassName}
                sideOffset={sideOffset}
                align={align}
                side={side}
            >
                {children}
            </PopoverContent>
        </PopoverRoot>
    );
}
