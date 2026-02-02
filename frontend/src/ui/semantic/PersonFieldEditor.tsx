/**
 * PersonFieldEditor - Semantic Component for person/user selection
 *
 * Responsibilities:
 * - Displays person with avatar and name
 * - Shows dropdown for person selection
 * - Supports multiple persons if needed
 *
 * Design Rules:
 * - Pure presentational - receives person list from parent
 * - Used in table cells and inspector fields
 */

import { clsx } from 'clsx';
import { User, ChevronDown, X, Check } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';

import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '@autoart/ui';

export interface Person {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
}

export interface PersonFieldEditorProps {
    /** Current selected person(s) */
    value: Person | Person[] | null | undefined;
    /** Available persons to select from */
    options: Person[];
    /** Called when selection changes */
    onChange: (value: Person | Person[] | null) => void;
    /** Whether the field is read-only */
    readOnly?: boolean;
    /** Allow multiple selection */
    multiple?: boolean;
    /** Compact mode for table cells */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

/**
 * Avatar component with fallback
 */
function Avatar({ person, size = 'md' }: { person: Person; size?: 'sm' | 'md' }) {
    const sizeClass = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs';
    const initial = person.name?.charAt(0).toUpperCase() || '?';

    if (person.avatarUrl) {
        return (
            <img
                src={person.avatarUrl}
                alt={person.name}
                className={clsx('rounded-full object-cover', sizeClass)}
            />
        );
    }

    return (
        <div className={clsx(
            'rounded-full flex items-center justify-center font-medium text-white',
            sizeClass,
            'bg-gradient-to-br from-indigo-400 to-purple-500'
        )}>
            {initial}
        </div>
    );
}

/**
 * PersonFieldEditor - Person selector with avatars
 */
export function PersonFieldEditor({
    value,
    options,
    onChange,
    readOnly = false,
    multiple = false,
    compact = false,
    className,
}: PersonFieldEditorProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Normalize value to array
    const selectedPersons: Person[] = useMemo(() => value
        ? Array.isArray(value)
            ? value
            : [value]
        : [], [value]);

    const handleSelect = useCallback((person: Person) => {
        if (multiple) {
            const isSelected = selectedPersons.some((p) => p.id === person.id);
            if (isSelected) {
                const newValue = selectedPersons.filter((p) => p.id !== person.id);
                onChange(newValue.length > 0 ? newValue : null);
            } else {
                onChange([...selectedPersons, person]);
            }
        } else {
            onChange(person);
            setIsOpen(false);
        }
    }, [multiple, selectedPersons, onChange]);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
    }, [onChange]);

    if (readOnly) {
        return (
            <div className={clsx('relative', className)}>
                <div
                    className={clsx(
                        'flex items-center gap-2 rounded',
                        compact ? 'h-7 px-2' : 'h-9 px-3',
                        'cursor-default'
                    )}
                >
                    {selectedPersons.length === 0 ? (
                        <>
                            <User className={clsx('text-ws-muted', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                            <span className={clsx('text-ws-muted', compact ? 'text-xs' : 'text-sm')}>
                                Unassigned
                            </span>
                        </>
                    ) : selectedPersons.length === 1 ? (
                        <>
                            <Avatar person={selectedPersons[0]} size={compact ? 'sm' : 'md'} />
                            <span className={clsx('font-medium text-ws-text-secondary', compact ? 'text-xs' : 'text-sm')}>
                                {selectedPersons[0].name}
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="flex -space-x-1.5">
                                {selectedPersons.slice(0, 3).map((person) => (
                                    <Avatar key={person.id} person={person} size="sm" />
                                ))}
                            </div>
                            <span className={clsx('text-ws-text-secondary', compact ? 'text-xs' : 'text-sm')}>
                                {selectedPersons.length} people
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={clsx('relative', className)}>
            <Dropdown open={isOpen} onOpenChange={setIsOpen}>
                <DropdownTrigger asChild>
                    <button
                        type="button"
                        className={clsx(
                            'flex items-center gap-2 rounded transition-all',
                            compact ? 'h-7 px-2' : 'h-9 px-3',
                            'cursor-pointer hover:bg-slate-100'
                        )}
                    >
                        {selectedPersons.length === 0 ? (
                            <>
                                <User className={clsx('text-ws-muted', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                                <span className={clsx('text-ws-muted', compact ? 'text-xs' : 'text-sm')}>
                                    Assign...
                                </span>
                            </>
                        ) : selectedPersons.length === 1 ? (
                            <>
                                <Avatar person={selectedPersons[0]} size={compact ? 'sm' : 'md'} />
                                <span className={clsx('font-medium text-ws-text-secondary', compact ? 'text-xs' : 'text-sm')}>
                                    {selectedPersons[0].name}
                                </span>
                            </>
                        ) : (
                            <>
                                <div className="flex -space-x-1.5">
                                    {selectedPersons.slice(0, 3).map((person) => (
                                        <Avatar key={person.id} person={person} size="sm" />
                                    ))}
                                </div>
                                <span className={clsx('text-ws-text-secondary', compact ? 'text-xs' : 'text-sm')}>
                                    {selectedPersons.length} people
                                </span>
                            </>
                        )}

                        <ChevronDown
                            className={clsx(
                                'ml-auto text-ws-muted',
                                compact ? 'w-3 h-3' : 'w-4 h-4'
                            )}
                        />

                        {selectedPersons.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="p-0.5 rounded-full hover:bg-slate-200 text-ws-muted hover:text-ws-text-secondary"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </button>
                </DropdownTrigger>

                <DropdownContent align="start" className="min-w-[200px] max-h-64 overflow-auto">
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-ws-muted">
                            No people available
                        </div>
                    ) : (
                        options.map((person) => {
                            const isSelected = selectedPersons.some((p) => p.id === person.id);

                            return (
                                <DropdownItem
                                    key={person.id}
                                    onSelect={() => handleSelect(person)}
                                    className={isSelected ? 'bg-blue-50' : ''}
                                >
                                    <Avatar person={person} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-ws-text-secondary truncate">
                                            {person.name}
                                        </div>
                                        {person.email && (
                                            <div className="text-xs text-ws-muted truncate">
                                                {person.email}
                                            </div>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <Check size={14} className="text-blue-500" />
                                    )}
                                </DropdownItem>
                            );
                        })
                    )}
                </DropdownContent>
            </Dropdown>
        </div>
    );
}
