/**
 * FilterBar - Composed filter bar with search, chips, and result count
 *
 * Design matches RegistryFilterBar: h-10, panel background, bottom border,
 * search input with icon, filter chips, right-aligned result count badge.
 * Search input debounces at 150ms internally.
 */

import { Search } from 'lucide-react';
import { useRef, useCallback, type ChangeEvent } from 'react';
import { clsx } from 'clsx';
import { TextInput } from '../atoms/TextInput';
import { Badge } from '../atoms/Badge';
import { FilterChip } from '../atoms/FilterChip';

export interface FilterBarProps {
    /** Current search query */
    searchQuery: string;
    /** Called when search query changes (already debounced internally) */
    onSearchChange: (query: string) => void;
    /** Active filter chips */
    chips?: Array<{ id: string; label: string; value?: string; onRemove: () => void }>;
    /** Total result count to display */
    resultCount?: number;
    /** Placeholder for search input */
    placeholder?: string;
    /** Additional content to render (e.g. sort dropdown, column picker) */
    children?: React.ReactNode;
    className?: string;
}

export function FilterBar({
    searchQuery,
    onSearchChange,
    chips = [],
    resultCount,
    placeholder = 'Search...',
    children,
    className,
}: FilterBarProps) {
    const debounceTimerRef = useRef<number | null>(null);

    const handleSearchChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;

            if (debounceTimerRef.current !== null) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = window.setTimeout(() => {
                onSearchChange(value);
            }, 150);
        },
        [onSearchChange]
    );

    return (
        <div
            className={clsx('flex items-center gap-2 h-10 px-3 border-b', className)}
            style={{
                backgroundColor: 'var(--ws-panel-bg)',
                borderColor: 'var(--ws-panel-border)',
            }}
        >
            {/* Search input with icon */}
            <div className="relative flex-1 max-w-xs">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search size={14} style={{ color: 'var(--ws-muted-fg)' }} />
                </div>
                <TextInput
                    defaultValue={searchQuery}
                    onChange={handleSearchChange}
                    placeholder={placeholder}
                    size="sm"
                    className="pl-7"
                />
            </div>

            {/* Filter chips */}
            {chips.length > 0 && (
                <div className="flex items-center gap-1.5">
                    {chips.map((chip) => (
                        <FilterChip
                            key={chip.id}
                            label={chip.label}
                            value={chip.value}
                            onRemove={chip.onRemove}
                        />
                    ))}
                </div>
            )}

            {/* Additional controls (sort, column picker, etc.) */}
            {children}

            {/* Result count */}
            {resultCount !== undefined && (
                <div className="ml-auto">
                    <Badge variant="neutral" size="sm">
                        {resultCount}
                    </Badge>
                </div>
            )}
        </div>
    );
}
