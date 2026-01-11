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
import { User, ChevronDown, X } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

import { PortalMenu } from '../atoms/PortalMenu';

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
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Normalize value to array
    const selectedPersons: Person[] = value
        ? Array.isArray(value)
            ? value
            : [value]
        : [];

    const handleToggle = useCallback(() => {
        if (!readOnly) {
            setIsOpen((prev) => !prev);
        }
    }, [readOnly]);

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

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <div className={clsx('relative', className)}>
            {/* Current selection button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                disabled={readOnly}
                className={clsx(
                    'flex items-center gap-2 rounded transition-all',
                    compact ? 'h-7 px-2' : 'h-9 px-3',
                    readOnly
                        ? 'cursor-default'
                        : 'cursor-pointer hover:bg-slate-100'
                )}
            >
                {selectedPersons.length === 0 ? (
                    <>
                        <User className={clsx('text-slate-400', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                        <span className={clsx('text-slate-400', compact ? 'text-xs' : 'text-sm')}>
                            Assign...
                        </span>
                    </>
                ) : selectedPersons.length === 1 ? (
                    <>
                        <Avatar person={selectedPersons[0]} size={compact ? 'sm' : 'md'} />
                        <span className={clsx('font-medium text-slate-700', compact ? 'text-xs' : 'text-sm')}>
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
                        <span className={clsx('text-slate-600', compact ? 'text-xs' : 'text-sm')}>
                            {selectedPersons.length} people
                        </span>
                    </>
                )}

                {!readOnly && (
                    <ChevronDown
                        className={clsx(
                            'ml-auto text-slate-400 transition-transform',
                            compact ? 'w-3 h-3' : 'w-4 h-4',
                            isOpen && 'rotate-180'
                        )}
                    />
                )}

                {selectedPersons.length > 0 && !readOnly && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </button>

            {/* Dropdown menu */}
            <PortalMenu
                isOpen={isOpen}
                anchorRef={buttonRef}
                onClose={handleClose}
                placement="bottom-start"
                className="py-1 min-w-[200px] max-h-64 overflow-auto"
            >
                {options.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">
                        No people available
                    </div>
                ) : (
                    options.map((person) => {
                        const isSelected = selectedPersons.some((p) => p.id === person.id);

                        return (
                            <button
                                key={person.id}
                                type="button"
                                onClick={() => handleSelect(person)}
                                className={clsx(
                                    'w-full px-3 py-2 text-left flex items-center gap-3 transition-colors',
                                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                )}
                            >
                                <Avatar person={person} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-700 truncate">
                                        {person.name}
                                    </div>
                                    {person.email && (
                                        <div className="text-xs text-slate-400 truncate">
                                            {person.email}
                                        </div>
                                    )}
                                </div>
                                {isSelected && (
                                    <span className="text-blue-500 text-sm">✓</span>
                                )}
                            </button>
                        );
                    })
                )}
            </PortalMenu>
        </div>
    );
}
