/**
 * Collapsible - Expandable/collapsible content section using Radix UI
 *
 * Provides accessible collapsible areas with animated height transitions.
 */

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';

// Re-export primitives for advanced usage
export const CollapsibleRoot = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
export const CollapsibleContent = CollapsiblePrimitive.Content;

export interface CollapsibleProps {
    children: React.ReactNode;
    trigger: React.ReactNode;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
    triggerClassName?: string;
    contentClassName?: string;
}

export function Collapsible({
    children,
    trigger,
    defaultOpen = false,
    open,
    onOpenChange,
    className,
    triggerClassName,
    contentClassName,
}: CollapsibleProps) {
    return (
        <CollapsiblePrimitive.Root
            defaultOpen={defaultOpen}
            open={open}
            onOpenChange={onOpenChange}
            className={className}
        >
            <CollapsiblePrimitive.Trigger asChild>
                <button
                    className={clsx(
                        'flex items-center gap-1 w-full text-left',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded',
                        triggerClassName
                    )}
                >
                    <ChevronDown
                        className="w-3 h-3 text-slate-400 transition-transform data-[state=open]:rotate-180 shrink-0"
                    />
                    {trigger}
                </button>
            </CollapsiblePrimitive.Trigger>
            <CollapsiblePrimitive.Content
                className={clsx(
                    'overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up',
                    contentClassName
                )}
            >
                {children}
            </CollapsiblePrimitive.Content>
        </CollapsiblePrimitive.Root>
    );
}

// Simplified inline collapsible for cards - just shows/hides content
export interface CollapsibleCardProps {
    summary: React.ReactNode;
    details: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
}

export const CollapsibleCard = forwardRef<HTMLDivElement, CollapsibleCardProps>(
    ({ summary, details, defaultOpen = false, className }, ref) => {
        return (
            <CollapsiblePrimitive.Root defaultOpen={defaultOpen} className={className}>
                <div ref={ref} className="flex flex-col">
                    <CollapsiblePrimitive.Trigger asChild>
                        <button className="flex items-center gap-1 w-full text-left group">
                            <ChevronDown
                                className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-all shrink-0 group-data-[state=open]:rotate-180"
                            />
                            {summary}
                        </button>
                    </CollapsiblePrimitive.Trigger>
                    <CollapsiblePrimitive.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                        <div className="pl-4 pt-1">
                            {details}
                        </div>
                    </CollapsiblePrimitive.Content>
                </div>
            </CollapsiblePrimitive.Root>
        );
    }
);

CollapsibleCard.displayName = 'CollapsibleCard';
