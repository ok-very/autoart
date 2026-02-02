
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
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
                    "z-50 min-w-[8rem] overflow-hidden rounded-md border border-[var(--ws-panel-border,#e2e8f0)] bg-[var(--ws-panel-bg,#fff)] p-1 font-sans text-[var(--ws-fg,#1e293b)] shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
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
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm font-sans outline-none transition-colors focus:bg-[var(--ws-row-expanded-bg,rgba(63,92,110,0.04))] focus:text-[var(--ws-fg,#1e293b)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
        >
            {children}
        </DropdownMenu.Item>
    );
}

export function DropdownLabel({ children, className }: { children: ReactNode, className?: string }) {
    return (
        <DropdownMenu.Label className={clsx("px-2 py-1.5 text-xs font-sans font-semibold text-[var(--ws-text-secondary,#5a5a57)]", className)}>
            {children}
        </DropdownMenu.Label>
    );
}

export function DropdownSeparator({ className }: { className?: string }) {
    return <DropdownMenu.Separator className={clsx("-mx-1 my-1 h-px bg-[var(--ws-panel-border,#e2e8f0)]", className)} />;
}

interface DropdownCheckboxItemProps {
    children: ReactNode;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
}

export function DropdownCheckboxItem({ children, checked, onCheckedChange, className, disabled }: DropdownCheckboxItemProps) {
    return (
        <DropdownMenu.CheckboxItem
            checked={checked}
            onCheckedChange={onCheckedChange}
            onSelect={(e) => e.preventDefault()}
            disabled={disabled}
            className={clsx(
                "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm font-sans outline-none transition-colors focus:bg-[var(--ws-row-expanded-bg,rgba(63,92,110,0.04))] focus:text-[var(--ws-fg,#1e293b)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                    <Check size={14} />
                </DropdownMenu.ItemIndicator>
            </span>
            {children}
        </DropdownMenu.CheckboxItem>
    );
}
