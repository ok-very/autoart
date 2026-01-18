/**
 * Menu - Dropdown menu component using portal positioning
 *
 * Compound component pattern with context-based state management.
 * Position dropdown below target using absolute positioning.
 */

import { clsx } from 'clsx';
import {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
    useCallback,
    useLayoutEffect,
    type ReactNode,
    type ElementType,
} from 'react';
import { createPortal } from 'react-dom';

interface MenuContextValue {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    targetRef: React.RefObject<HTMLDivElement>;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext() {
    const ctx = useContext(MenuContext);
    if (!ctx) throw new Error('Menu components must be used within Menu');
    return ctx;
}

export interface MenuProps {
    children: ReactNode;
    opened?: boolean;
    onChange?: (opened: boolean) => void;
}

export function Menu({ children, opened, onChange }: MenuProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const targetRef = useRef<HTMLDivElement>(null);

    const isControlled = opened !== undefined;
    const isOpen = isControlled ? opened : internalOpen;

    const setIsOpen = useCallback(
        (open: boolean) => {
            if (isControlled) {
                onChange?.(open);
            } else {
                setInternalOpen(open);
            }
        },
        [isControlled, onChange]
    );

    return (
        <MenuContext.Provider value={{ isOpen, setIsOpen, targetRef }}>
            <div className="relative inline-block">{children}</div>
        </MenuContext.Provider>
    );
}

export interface MenuTargetProps {
    children: ReactNode;
}

function MenuTarget({ children }: MenuTargetProps) {
    const { isOpen, setIsOpen, targetRef } = useMenuContext();

    return (
        <div
            ref={targetRef}
            onClick={() => setIsOpen(!isOpen)}
            className="cursor-pointer"
        >
            {children}
        </div>
    );
}

export interface MenuDropdownProps {
    children: ReactNode;
    className?: string;
}

function MenuDropdown({ children, className }: MenuDropdownProps) {
    const { isOpen, setIsOpen, targetRef } = useMenuContext();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isAnimating, setIsAnimating] = useState(false);

    // Silence unused warning for now as it's used in effect but maybe not rendered
    void isAnimating;

    // Trigger animation after mount
    useLayoutEffect(() => {
        if (isOpen) {
            // Force reflow, then enable animation
            requestAnimationFrame(() => {
                setIsAnimating(true);
            });
        } else {
            setIsAnimating(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
            });
        }
    }, [isOpen, targetRef]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                targetRef.current &&
                !targetRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, setIsOpen, targetRef]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={dropdownRef}
            className={clsx(
                'absolute z-50 min-w-[160px] py-1 bg-white rounded-lg border border-slate-200 shadow-lg',
                className
            )}
            style={{ top: position.top, left: position.left }}
        >
            {children}
        </div>,
        document.body
    );
}

export interface MenuItemProps<C extends ElementType = 'button'> {
    children: ReactNode;
    component?: C;
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
    [key: string]: unknown;
}

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
    const { setIsOpen } = useMenuContext();
    const Component = (component || 'button') as ElementType;

    const handleClick = () => {
        if (disabled) return;
        onClick?.();
        setIsOpen(false);
    };

    return (
        <Component
            {...rest}
            onClick={handleClick}
            disabled={disabled}
            className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100 cursor-pointer',
                className
            )}
        >
            {leftSection && <span className="flex-shrink-0">{leftSection}</span>}
            <span className="flex-1">{children}</span>
            {rightSection && <span className="flex-shrink-0 text-slate-400">{rightSection}</span>}
        </Component>
    );
}

export interface MenuLabelProps {
    children: ReactNode;
    className?: string;
}

function MenuLabel({ children, className }: MenuLabelProps) {
    return (
        <div
            className={clsx(
                'px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider',
                className
            )}
        >
            {children}
        </div>
    );
}

export interface MenuDividerProps {
    className?: string;
}

function MenuDivider({ className }: MenuDividerProps) {
    return <div className={clsx('my-1 border-t border-slate-200', className)} />;
}

Menu.Target = MenuTarget;
Menu.Dropdown = MenuDropdown;
Menu.Item = MenuItem;
Menu.Label = MenuLabel;
Menu.Divider = MenuDivider;
