
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { ReactNode } from 'react';

export const Dropdown = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;
export const DropdownPortal = DropdownMenu.Portal;
export const DropdownGroup = DropdownMenu.Group;

interface DropdownContentProps {
    children: ReactNode;
    className?: string;
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
}

export function DropdownContent({ children, className, sideOffset = 5, align = 'start', side = 'bottom' }: DropdownContentProps) {
    return (
        <DropdownMenu.Portal>
            <DropdownMenu.Content
                className={clsx(
                    "z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-slate-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                    className
                )}
                sideOffset={sideOffset}
                align={align}
                side={side}
            >
                {children}
            </DropdownMenu.Content>
        </DropdownMenu.Portal>
    );
}

interface DropdownItemProps {
    children: ReactNode;
    onSelect?: (event: Event) => void;
    className?: string;
    disabled?: boolean;
}

export function DropdownItem({ children, onSelect, className, disabled }: DropdownItemProps) {
    return (
        <DropdownMenu.Item
            onSelect={onSelect}
            disabled={disabled}
            className={clsx(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
        >
            {children}
        </DropdownMenu.Item>
    );
}

export function DropdownLabel({ children, className }: { children: ReactNode, className?: string }) {
    return (
        <DropdownMenu.Label className={clsx("px-2 py-1.5 text-xs font-semibold text-slate-500", className)}>
            {children}
        </DropdownMenu.Label>
    );
}

export function DropdownSeparator({ className }: { className?: string }) {
    return <DropdownMenu.Separator className={clsx("-mx-1 my-1 h-px bg-slate-100", className)} />;
}
