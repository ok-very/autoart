/**
 * RegistryFilterBar
 *
 * Unified filter/search bar shared by all registry panels (Records, Actions, Fields).
 * Provides consistent search, definition kind filtering, sort control, and result count.
 *
 * Uses --ws-* tokens only. Built from @autoart/ui atoms.
 */

import { Search } from 'lucide-react';
import { useMemo } from 'react';

import type { DefinitionKind } from '@autoart/shared';

import { Badge, Select, TextInput } from '@autoart/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegistrySortKey = 'name' | 'created' | 'updated';

export interface RegistryFilterBarProps {
    /** Current search query */
    searchQuery: string;
    /** Search query change handler */
    onSearchChange: (query: string) => void;
    /** Active definition kind filter (null = all) */
    definitionKind: DefinitionKind | null;
    /** Definition kind change handler */
    onDefinitionKindChange: (kind: DefinitionKind | null) => void;
    /** Active sort key */
    sortKey: RegistrySortKey;
    /** Sort key change handler */
    onSortChange: (key: RegistrySortKey) => void;
    /** Number of results matching current filters */
    resultCount: number;
    /** Hide the definition kind filter (e.g. when panel already scopes to one kind) */
    hideKindFilter?: boolean;
    /** Additional class names */
    className?: string;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const KIND_OPTIONS = [
    { value: '', label: 'All kinds' },
    { value: 'record', label: 'Record' },
    { value: 'action_arrangement', label: 'Action' },
    { value: 'container', label: 'Container' },
];

const SORT_OPTIONS = [
    { value: 'name', label: 'Name' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegistryFilterBar({
    searchQuery,
    onSearchChange,
    definitionKind,
    onDefinitionKindChange,
    sortKey,
    onSortChange,
    resultCount,
    hideKindFilter = false,
    className,
}: RegistryFilterBarProps) {
    const countLabel = useMemo(() => {
        if (resultCount === 1) return '1 result';
        return `${resultCount} results`;
    }, [resultCount]);

    return (
        <div
            className={`flex items-center gap-2 px-3 py-2 border-b bg-ws-panel-bg ${className ?? ''}`}
            style={{ borderColor: 'var(--ws-panel-border)' }}
        >
            {/* Search input with icon */}
            <div className="relative flex-1 min-w-[120px] max-w-[240px]">
                <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--ws-muted-fg)' }}
                />
                <TextInput
                    size="sm"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search by name..."
                    className="!pl-8"
                />
            </div>

            {/* Definition kind filter */}
            {!hideKindFilter && (
                <div className="w-[130px]">
                    <Select
                        size="sm"
                        value={definitionKind ?? ''}
                        onChange={(val) =>
                            onDefinitionKindChange(
                                val ? (val as DefinitionKind) : null
                            )
                        }
                        data={KIND_OPTIONS}
                    />
                </div>
            )}

            {/* Sort */}
            <div className="w-[110px]">
                <Select
                    size="sm"
                    value={sortKey}
                    onChange={(val) => onSortChange((val ?? 'name') as RegistrySortKey)}
                    data={SORT_OPTIONS}
                />
            </div>

            {/* Result count badge */}
            <Badge variant="neutral" size="sm">
                {countLabel}
            </Badge>
        </div>
    );
}
