/**
 * AssigneeChipGroup
 *
 * Displays one or more assignees with stacked avatars.
 * Supports:
 * - Single assignee (backward compatible with existing usage)
 * - Multiple assignees with overflow indicator (+N)
 * - Hover tooltip showing all names
 *
 * Usage:
 *   <AssigneeChipGroup assignees={[{ id: '1', name: 'John Doe' }]} />
 *   <AssigneeChipGroup assignees={assigneesArray} maxVisible={3} />
 */

import { useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface Assignee {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
}

export interface AssigneeChipGroupProps {
    /** Array of assignees to display */
    assignees?: Assignee[];
    /** Single assignee (legacy support) - will be converted to array */
    assignee?: Assignee | { name?: string };
    /** Maximum number of avatars to show before overflow */
    maxVisible?: number;
    /** Show full names alongside avatars */
    showNames?: boolean;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// HELPERS
// ============================================================================

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

const AVATAR_COLORS = [
    'bg-blue-200 text-blue-700',
    'bg-green-200 text-green-700',
    'bg-purple-200 text-purple-700',
    'bg-amber-200 text-amber-700',
    'bg-pink-200 text-pink-700',
    'bg-cyan-200 text-cyan-700',
];

function getColorForName(name: string): string {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const SIZE_CLASSES = {
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-8 h-8 text-sm',
};

const OVERLAP_CLASSES = {
    sm: '-ml-1.5',
    md: '-ml-2',
    lg: '-ml-2.5',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AssigneeChipGroup({
    assignees,
    assignee,
    maxVisible = 3,
    showNames = false,
    size = 'sm',
}: AssigneeChipGroupProps) {
    // Normalize to array, supporting both single and multiple
    const normalizedAssignees = useMemo(() => {
        if (assignees && assignees.length > 0) {
            return assignees;
        }
        if (assignee) {
            // Convert legacy single assignee format
            const name = 'name' in assignee ? assignee.name : undefined;
            if (name) {
                return [{ id: 'id' in assignee ? assignee.id : 'legacy', name }];
            }
        }
        return [];
    }, [assignees, assignee]);

    if (normalizedAssignees.length === 0) {
        return <span className="text-xs text-slate-400 italic">Unassigned</span>;
    }

    const visibleAssignees = normalizedAssignees.slice(0, maxVisible);
    const overflowCount = normalizedAssignees.length - maxVisible;
    const allNames = normalizedAssignees.map((a) => a.name).join(', ');

    return (
        <div className="flex items-center gap-1.5" title={allNames}>
            {/* Stacked avatars */}
            <div className="flex items-center">
                {visibleAssignees.map((a, index) => (
                    <div
                        key={a.id}
                        className={`
                            ${SIZE_CLASSES[size]}
                            ${getColorForName(a.name)}
                            ${index > 0 ? OVERLAP_CLASSES[size] : ''}
                            rounded-full flex items-center justify-center font-semibold
                            border-2 border-white shadow-sm
                        `}
                    >
                        {getInitials(a.name)}
                    </div>
                ))}
                {overflowCount > 0 && (
                    <div
                        className={`
                            ${SIZE_CLASSES[size]}
                            ${OVERLAP_CLASSES[size]}
                            rounded-full flex items-center justify-center font-medium
                            bg-slate-300 text-slate-600 border-2 border-white shadow-sm
                        `}
                    >
                        +{overflowCount}
                    </div>
                )}
            </div>

            {/* Names (optional) */}
            {showNames && (
                <span className="text-xs text-slate-700 truncate max-w-[120px]">
                    {normalizedAssignees.length === 1
                        ? normalizedAssignees[0].name
                        : `${normalizedAssignees.length} people`}
                </span>
            )}
        </div>
    );
}

export default AssigneeChipGroup;
