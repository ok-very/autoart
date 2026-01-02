/**
 * UserMentionInput - Composite for selecting users with @mention autocomplete
 * 
 * This is a composite because it:
 * - Uses API hooks (useSearchUsers)
 * - Manages complex async search state
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { User, X, AtSign } from 'lucide-react';
import { useSearchUsers } from '../../api/hooks/auth';
import { useDebounce } from '../../hooks/useDebounce';
import { UserChip } from '../atoms/UserChip';
import type { User as UserType } from '../../types';

export interface UserMentionInputProps {
    /** Current value - string (user ID or name) or { id: string, name: string } */
    value: unknown;
    /** Callback when user is selected or cleared */
    onChange: (value: unknown) => void;
    /** Whether the input is read-only */
    readOnly?: boolean;
    /** Placeholder text */
    placeholder?: string;
}

/**
 * Parse various user value formats into a normalized structure
 */
function parseUserValue(value: unknown): { id?: string; name?: string; email?: string } | null {
    if (!value) return null;

    if (typeof value === 'string') {
        // Could be a user ID or a name
        return { name: value };
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        return {
            id: obj.id as string | undefined,
            name: obj.name as string | undefined,
            email: obj.email as string | undefined,
        };
    }

    return null;
}

/**
 * UserMentionInput - Input field for selecting a user with @mention autocomplete
 * 
 * Supports:
 * - Typing to search users
 * - @ trigger for autocomplete
 * - Displaying selected user as a pill
 */
export function UserMentionInput({
    value,
    onChange,
    readOnly = false,
    placeholder = 'Type @ to mention a user...',
}: UserMentionInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse the current value
    const selectedUser = parseUserValue(value);

    // Debounce search query
    const debouncedQuery = useDebounce(inputValue.replace(/^@/, ''), 200);

    // Search users when we have a query
    const { data: users = [], isLoading } = useSearchUsers(debouncedQuery, isOpen && debouncedQuery.length >= 1);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Handle input change
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        // Open dropdown when @ is typed or when there's a query
        if (val.startsWith('@') || val.length > 0) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, []);

    // Handle selecting a user
    const handleSelectUser = useCallback((user: UserType) => {
        onChange({ id: user.id, name: user.name, email: user.email });
        setInputValue('');
        setIsOpen(false);
    }, [onChange]);

    // Handle clearing the selected user
    const handleClear = useCallback(() => {
        onChange(null);
        setInputValue('');
        inputRef.current?.focus();
    }, [onChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            e.preventDefault();
        }
        if (e.key === 'Backspace' && inputValue === '' && selectedUser) {
            handleClear();
            e.preventDefault();
        }
    }, [inputValue, selectedUser, handleClear]);

    // If there's a selected user, show as a pill with context menu
    if (selectedUser && !isOpen) {
        return (
            <div
                ref={containerRef}
                className={clsx(
                    'flex items-center gap-2 px-3 py-2 border rounded-md bg-white',
                    readOnly ? 'border-slate-300' : 'border-slate-300 hover:border-blue-300'
                )}
            >
                <div className="flex items-center gap-2 flex-1">
                    <UserChip
                        value={selectedUser}
                        onUnlink={!readOnly ? (text) => {
                            // Convert to plain text
                            onChange(text);
                        } : undefined}
                    />
                </div>
                {!readOnly && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => inputValue.length > 0 && setIsOpen(true)}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    className={clsx(
                        'w-full text-sm border rounded-md shadow-sm pl-9 pr-3 py-2 transition-colors',
                        readOnly
                            ? 'border-slate-300 bg-white cursor-default'
                            : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    )}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-blue-400">
                    <AtSign size={16} />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && !readOnly && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {isLoading ? (
                        <div className="px-3 py-2 text-sm text-slate-500">Searching...</div>
                    ) : users.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500">
                            {debouncedQuery.length < 1 ? 'Type to search users...' : 'No users found'}
                        </div>
                    ) : (
                        users.map((user) => (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() => handleSelectUser(user)}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                                    <User size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-800 truncate">{user.name}</div>
                                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
