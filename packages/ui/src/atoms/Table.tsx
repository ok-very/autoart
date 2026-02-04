/**
 * Table — Compound component for semantic HTML tables
 *
 * Minimal API: no sorting, no resize, no inline editing.
 * Caller owns all state. Size flows through React context.
 *
 * Expandable rows use grid-rows-[0fr] → grid-rows-[1fr] for smooth
 * height transitions without JS measurement.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { clsx } from 'clsx';

// =============================================================================
// CONTEXT
// =============================================================================

type TableSize = 'sm' | 'md' | 'lg';

interface TableContextValue {
    size: TableSize;
    hoverable: boolean;
}

const TableContext = createContext<TableContextValue>({
    size: 'md',
    hoverable: false,
});

function useTableContext() {
    return useContext(TableContext);
}

// =============================================================================
// SIZE CONFIG
// =============================================================================

const cellPadding: Record<TableSize, string> = {
    sm: 'px-2 py-1.5',
    md: 'px-4 py-3',
    lg: 'px-4 py-4',
};

const cellText: Record<TableSize, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm',
};

// =============================================================================
// TABLE ROOT
// =============================================================================

interface TableProps {
    children: ReactNode;
    size?: TableSize;
    hoverable?: boolean;
    stickyHeader?: boolean;
    className?: string;
}

function TableRoot({
    children,
    size = 'md',
    hoverable = false,
    stickyHeader = false,
    className,
}: TableProps) {
    return (
        <TableContext.Provider value={{ size, hoverable }}>
            <table
                className={clsx(
                    'w-full border-collapse',
                    stickyHeader && '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10',
                    className,
                )}
            >
                {children}
            </table>
        </TableContext.Provider>
    );
}

// =============================================================================
// HEADER / BODY
// =============================================================================

interface TableSectionProps {
    children: ReactNode;
    className?: string;
}

function Header({ children, className }: TableSectionProps) {
    return (
        <thead className={clsx('bg-ws-bg border-b border-ws-panel-border', className)}>
            {children}
        </thead>
    );
}

function Body({ children, className }: TableSectionProps) {
    return <tbody className={className}>{children}</tbody>;
}

// =============================================================================
// ROW
// =============================================================================

interface RowProps {
    children: ReactNode;
    selected?: boolean;
    expanded?: boolean;
    onClick?: () => void;
    className?: string;
}

function Row({ children, selected, expanded, onClick, className }: RowProps) {
    const { hoverable } = useTableContext();

    return (
        <tr
            className={clsx(
                'border-b border-ws-panel-border transition-colors duration-75',
                hoverable && 'hover:bg-ws-bg',
                selected && 'bg-ws-row-expanded-bg',
                expanded && 'bg-ws-row-expanded-bg',
                onClick && 'cursor-pointer',
                className,
            )}
            onClick={onClick}
        >
            {children}
        </tr>
    );
}

// =============================================================================
// EXPANDABLE DETAIL ROW
// =============================================================================

interface ExpandedRowProps {
    children: ReactNode;
    expanded: boolean;
    colSpan: number;
    className?: string;
}

/**
 * Detail row that sits below a Row with `expanded` set.
 * Uses CSS grid for smooth height animation.
 */
function ExpandedRow({ children, expanded, colSpan, className }: ExpandedRowProps) {
    return (
        <tr className={clsx(!expanded && 'border-0', className)}>
            <td colSpan={colSpan} className="p-0">
                <div
                    className={clsx(
                        'grid transition-[grid-template-rows] duration-150 ease-out',
                        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                >
                    <div
                        className={clsx(
                            'overflow-hidden transition-opacity duration-150 ease-out',
                            expanded ? 'opacity-100' : 'opacity-0',
                        )}
                    >
                        {children}
                    </div>
                </div>
            </td>
        </tr>
    );
}

// =============================================================================
// HEADER CELL
// =============================================================================

type Align = 'left' | 'center' | 'right';

interface HeaderCellProps {
    children?: ReactNode;
    align?: Align;
    width?: string;
    className?: string;
}

const alignClass: Record<Align, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

function HeaderCell({ children, align = 'left', width, className }: HeaderCellProps) {
    const { size } = useTableContext();

    return (
        <th
            className={clsx(
                cellPadding[size],
                alignClass[align],
                'text-xs font-medium text-ws-text-secondary uppercase tracking-wider',
                className,
            )}
            style={width ? { width } : undefined}
        >
            {children}
        </th>
    );
}

// =============================================================================
// CELL
// =============================================================================

interface CellProps {
    children?: ReactNode;
    align?: Align;
    colSpan?: number;
    mono?: boolean;
    className?: string;
}

function Cell({ children, align = 'left', colSpan, mono, className }: CellProps) {
    const { size } = useTableContext();

    return (
        <td
            className={clsx(
                cellPadding[size],
                cellText[size],
                alignClass[align],
                mono && 'font-mono text-ws-mono-fg',
                className,
            )}
            colSpan={colSpan}
        >
            {children}
        </td>
    );
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const Table = Object.assign(TableRoot, {
    Header,
    Body,
    Row,
    ExpandedRow,
    HeaderCell,
    Cell,
});
