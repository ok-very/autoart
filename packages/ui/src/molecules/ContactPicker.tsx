import { clsx } from 'clsx';
import { User, X, ChevronDown } from 'lucide-react';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

import { useClickOutside } from '../hooks/useClickOutside';

// ============================================================================
// TYPES
// ============================================================================

export interface ContactOption {
    id: string;
    name: string;
    company?: string;
    group?: string;
}

export interface ContactPickerProps {
    /** Available contacts to pick from */
    contacts: ContactOption[];
    /** Currently selected contact ID */
    value?: string | null;
    /** Called with the selected contact ID (or null to clear) */
    onChange: (contactId: string | null) => void;
    /** Label above the picker */
    label?: string;
    /** Placeholder when nothing selected */
    placeholder?: string;
    /** Whether the field is required */
    required?: boolean;
    /** Error message */
    error?: string;
    /** Whether the picker is disabled */
    disabled?: boolean;
    /** Whether contacts are loading */
    isLoading?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContactPicker({
    contacts,
    value,
    onChange,
    label,
    placeholder = 'Select contact',
    required,
    error,
    disabled,
    isLoading,
}: ContactPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useClickOutside([containerRef], () => setIsOpen(false));

    useEffect(() => { if (disabled) setIsOpen(false); }, [disabled]);

    const selectedContact = useMemo(
        () => contacts.find((c) => c.id === value) ?? null,
        [contacts, value],
    );

    const filteredContacts = useMemo(() => {
        if (!query.trim()) return contacts;
        const lower = query.toLowerCase();
        return contacts.filter(
            (c) =>
                c.name.toLowerCase().includes(lower) ||
                (c.company && c.company.toLowerCase().includes(lower)),
        );
    }, [contacts, query]);

    const handleSelect = useCallback(
        (contactId: string) => {
            onChange(contactId);
            setIsOpen(false);
            setQuery('');
        },
        [onChange],
    );

    const handleClear = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange(null);
        },
        [onChange],
    );

    const handleToggle = useCallback(() => {
        if (disabled) return;
        setIsOpen((prev) => {
            if (!prev) {
                setTimeout(() => inputRef.current?.focus(), 0);
            }
            return !prev;
        });
    }, [disabled]);

    return (
        <div ref={containerRef} className="relative flex flex-col gap-1">
            {label && (
                <label className="text-sm font-medium text-slate-700">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}

            <button
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm font-sans transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
                    error
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-slate-300',
                )}
            >
                <User size={14} className="text-slate-400 shrink-0" />
                {selectedContact ? (
                    <span className="flex-1 truncate text-slate-700">
                        {selectedContact.name}
                        {selectedContact.company && (
                            <span className="text-slate-400 ml-1">
                                ({selectedContact.company})
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="flex-1 text-slate-400">{placeholder}</span>
                )}
                {selectedContact && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                    >
                        <X size={12} />
                    </button>
                )}
                <ChevronDown
                    size={14}
                    className={clsx(
                        'text-slate-400 transition-transform shrink-0',
                        isOpen && 'rotate-180',
                    )}
                />
            </button>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="p-2 border-b border-slate-100">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search contacts..."
                            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-3 text-center text-sm text-slate-400">
                                Loading...
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="p-3 text-center text-sm text-slate-400">
                                {query ? 'No matches' : 'No contacts'}
                            </div>
                        ) : (
                            filteredContacts.map((contact) => (
                                <button
                                    key={contact.id}
                                    type="button"
                                    onClick={() => handleSelect(contact.id)}
                                    className={clsx(
                                        'w-full text-left px-3 py-2 text-sm transition-colors',
                                        'hover:bg-slate-50',
                                        contact.id === value && 'bg-blue-50',
                                    )}
                                >
                                    <div className="font-medium text-slate-700 truncate">
                                        {contact.name}
                                    </div>
                                    {contact.company && (
                                        <div className="text-xs text-slate-400 truncate">
                                            {contact.company}
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
