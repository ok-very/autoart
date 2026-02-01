/**
 * RadixSelect - A robust, accessible select component using Radix UI.
 * 
 * Replaces PortalSelect and Select with a battle-tested implementation
 * that handles positioning, accessibility, and focus management automatically.
 */

import * as SelectPrimitive from '@radix-ui/react-select';
import { clsx } from 'clsx';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { forwardRef } from 'react';

// Re-export composable parts for advanced usage
export const SelectRoot = SelectPrimitive.Root;
export const SelectTrigger = SelectPrimitive.Trigger;
export const SelectValue = SelectPrimitive.Value;
export const SelectIcon = SelectPrimitive.Icon;
export const SelectPortal = SelectPrimitive.Portal;
export const SelectGroup = SelectPrimitive.Group;
export const SelectLabel = SelectPrimitive.Label;
export const SelectSeparator = SelectPrimitive.Separator;

interface RadixSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface RadixSelectProps {
    value: string | null;
    onChange: (value: string | null) => void;
    data: RadixSelectOption[];
    placeholder?: string;
    label?: string;
    description?: string;
    disabled?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    clearable?: boolean;
}

export function RadixSelect({
    value,
    onChange,
    data,
    placeholder = 'Select...',
    label,
    description,
    disabled = false,
    className,
    size = 'md',
    clearable = false,
}: RadixSelectProps) {
    return (
        <div className={clsx('flex flex-col gap-1', className)}>
            {label && (
                <label className="text-sm font-medium text-slate-700">{label}</label>
            )}
            {description && (
                <p className="text-xs text-slate-500">{description}</p>
            )}

            <SelectPrimitive.Root
                value={value ?? undefined}
                onValueChange={(val) => onChange(val === '' ? null : val)}
                disabled={disabled}
            >
                <SelectPrimitive.Trigger
                    className={clsx(
                        'w-full flex items-center justify-between text-left border rounded-lg transition-all bg-white font-sans',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                        'data-[disabled]:bg-slate-50 data-[disabled]:text-slate-400 data-[disabled]:cursor-not-allowed',
                        'data-[placeholder]:text-slate-500',
                        {
                            'px-2 py-1 text-xs min-h-[26px]': size === 'sm',
                            'px-3 py-2 text-sm min-h-[38px]': size === 'md',
                            'px-4 py-2.5 text-base min-h-[46px]': size === 'lg',
                        }
                    )}
                >
                    <SelectPrimitive.Value placeholder={placeholder} />
                    <SelectPrimitive.Icon asChild>
                        <ChevronDown size={size === 'sm' ? 14 : 16} className="shrink-0 text-slate-400" />
                    </SelectPrimitive.Icon>
                </SelectPrimitive.Trigger>

                <SelectPrimitive.Portal>
                    <SelectPrimitive.Content
                        className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
                        position="popper"
                        sideOffset={4}
                    >
                        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-6 bg-white cursor-default">
                            <ChevronUp size={14} />
                        </SelectPrimitive.ScrollUpButton>

                        <SelectPrimitive.Viewport className="p-1 max-h-60">
                            {clearable && value && (
                                <>
                                    <SelectPrimitive.Item
                                        value=""
                                        className="relative flex items-center px-2 py-1.5 text-sm text-slate-400 rounded-sm select-none cursor-pointer outline-none focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    >
                                        <SelectPrimitive.ItemText>Clear selection</SelectPrimitive.ItemText>
                                    </SelectPrimitive.Item>
                                    <SelectPrimitive.Separator className="h-px bg-slate-100 my-1" />
                                </>
                            )}

                            {data.length === 0 ? (
                                <div className="px-2 py-1.5 text-sm text-slate-400 italic">No options</div>
                            ) : (
                                data.map((option) => (
                                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                                        {option.label}
                                    </SelectItem>
                                ))
                            )}
                        </SelectPrimitive.Viewport>

                        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-6 bg-white cursor-default">
                            <ChevronDown size={14} />
                        </SelectPrimitive.ScrollDownButton>
                    </SelectPrimitive.Content>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
        </div>
    );
}

// Reusable SelectItem for composable patterns
export const SelectItem = forwardRef<HTMLDivElement, SelectPrimitive.SelectItemProps>(
    ({ children, className, ...props }, ref) => (
        <SelectPrimitive.Item
            ref={ref}
            className={clsx(
                'relative flex items-center px-2 py-1.5 pr-8 text-sm font-sans rounded-sm select-none cursor-pointer outline-none',
                'focus:bg-slate-100 focus:text-slate-900',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                'data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700',
                className
            )}
            {...props}
        >
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center justify-center">
                <Check size={14} />
            </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
    )
);

SelectItem.displayName = 'SelectItem';
