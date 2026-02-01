/**
 * Menu - Dropdown menu component using Radix UI
 *
 * Refactored to use Radix DropdownMenu for reliable positioning,
 * accessibility, and keyboard navigation.
 */

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, type ElementType, type ComponentPropsWithoutRef } from 'react';

export interface MenuProps {
    children: ReactNode;
    opened?: boolean;
    onChange?: (opened: boolean) => void;
}

export function Menu({ children, opened, onChange }: MenuProps) {
    return (
        <DropdownMenu.Root open={opened} onOpenChange={onChange}>
            {children}
        </DropdownMenu.Root>
    );
}

export interface MenuTargetProps {
    children: ReactNode;
}

function MenuTarget({ children }: MenuTargetProps) {
    return (
        <DropdownMenu.Trigger asChild>
            <div className="cursor-pointer">{children}</div>
        </DropdownMenu.Trigger>
    );
}

export interface MenuDropdownProps {
    children: ReactNode;
    className?: string;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
}

function MenuDropdown({
    children,
    className,
    align = 'start',
    side = 'bottom',
    sideOffset = 4,
}: MenuDropdownProps) {
    return (
        <DropdownMenu.Portal>
            <DropdownMenu.Content
                className={clsx(
                    'z-50 min-w-[160px] py-1 bg-white rounded-lg border border-slate-200 shadow-lg font-sans',
                    'data-[state=open]:animate-in data-[state=closed]:animate-out',
                    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                    'data-[side=bottom]:slide-in-from-top-2',
                    'data-[side=left]:slide-in-from-right-2',
                    'data-[side=right]:slide-in-from-left-2',
                    'data-[side=top]:slide-in-from-bottom-2',
                    className
                )}
                align={align}
                side={side}
                sideOffset={sideOffset}
            >
                {children}
            </DropdownMenu.Content>
        </DropdownMenu.Portal>
    );
}

// Polymorphic MenuItem props
export type MenuItemProps<C extends ElementType = 'button'> = {
    children: ReactNode;
    component?: C;
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
} & Omit<ComponentPropsWithoutRef<C>, 'children' | 'className' | 'onClick' | 'disabled'>;

function MenuItem<C extends ElementType = 'button'>({
    children,
    component,
    leftSection,
    rightSection,
    disabled,
    className,
    onClick,
    ...rest
}: MenuItemProps<C>) {
    const Component = component || 'button';

    return (
        <DropdownMenu.Item
            asChild
            disabled={disabled}
            onSelect={(e) => {
                // If using a Link component, don't prevent default navigation
                if (component) {
                    e.preventDefault();
                }
                onClick?.();
            }}
        >
            <Component
                {...rest}
                className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors outline-none',
                    'focus:bg-slate-100 cursor-pointer',
                    'data-[disabled]:text-slate-400 data-[disabled]:cursor-not-allowed data-[disabled]:pointer-events-none',
                    !disabled && 'text-slate-700',
                    className
                )}
            >
                {leftSection && <span className="flex-shrink-0">{leftSection}</span>}
                <span className="flex-1">{children}</span>
                {rightSection && <span className="flex-shrink-0 text-slate-400">{rightSection}</span>}
            </Component>
        </DropdownMenu.Item>
    );
}

export interface MenuLabelProps {
    children: ReactNode;
    className?: string;
}

function MenuLabel({ children, className }: MenuLabelProps) {
    return (
        <DropdownMenu.Label
            className={clsx(
                'px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider',
                className
            )}
        >
            {children}
        </DropdownMenu.Label>
    );
}

export interface MenuDividerProps {
    className?: string;
}

function MenuDivider({ className }: MenuDividerProps) {
    return <DropdownMenu.Separator className={clsx('my-1 h-px bg-slate-200', className)} />;
}

// ---------------------------------------------------------------------------
// Submenu components
// ---------------------------------------------------------------------------

export interface MenuSubProps {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

function MenuSub({ children, open, onOpenChange }: MenuSubProps) {
    return (
        <DropdownMenu.Sub open={open} onOpenChange={onOpenChange}>
            {children}
        </DropdownMenu.Sub>
    );
}

export interface MenuSubTriggerProps {
    children: ReactNode;
    leftSection?: ReactNode;
    className?: string;
    disabled?: boolean;
}

function MenuSubTrigger({ children, leftSection, className, disabled }: MenuSubTriggerProps) {
    return (
        <DropdownMenu.SubTrigger
            disabled={disabled}
            className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors outline-none',
                'focus:bg-slate-100 cursor-pointer',
                'data-[state=open]:bg-slate-100',
                'data-[disabled]:text-slate-400 data-[disabled]:cursor-not-allowed data-[disabled]:pointer-events-none',
                !disabled && 'text-slate-700',
                className
            )}
        >
            {leftSection && <span className="flex-shrink-0">{leftSection}</span>}
            <span className="flex-1">{children}</span>
            <ChevronRight size={14} className="flex-shrink-0 text-slate-400" />
        </DropdownMenu.SubTrigger>
    );
}

export interface MenuSubContentProps {
    children: ReactNode;
    className?: string;
    sideOffset?: number;
    alignOffset?: number;
}

function MenuSubContent({ children, className, sideOffset = 2, alignOffset = -5 }: MenuSubContentProps) {
    return (
        <DropdownMenu.Portal>
            <DropdownMenu.SubContent
                className={clsx(
                    'z-50 min-w-[160px] py-1 bg-white rounded-lg border border-slate-200 shadow-lg font-sans',
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
                alignOffset={alignOffset}
            >
                {children}
            </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
    );
}

Menu.Target = MenuTarget;
Menu.Dropdown = MenuDropdown;
Menu.Item = MenuItem;
Menu.Label = MenuLabel;
Menu.Divider = MenuDivider;
Menu.Sub = MenuSub;
Menu.SubTrigger = MenuSubTrigger;
Menu.SubContent = MenuSubContent;
