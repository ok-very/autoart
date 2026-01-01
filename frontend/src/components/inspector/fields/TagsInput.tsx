import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface TagsInputProps {
    value: unknown;
    onChange: (value: string[]) => void;
    readOnly?: boolean;
    placeholder?: string;
}

/**
 * TagsInput - Input field for managing an array of string tags
 * 
 * Supports:
 * - Adding tags by pressing Enter or comma
 * - Removing tags with X button or backspace
 * - Visual pills for each tag
 */
export function TagsInput({
    value,
    onChange,
    readOnly = false,
    placeholder = 'Add tag...',
}: TagsInputProps) {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Parse the current value to array
    const tags = parseTags(value);

    // Add a new tag
    const addTag = useCallback((tag: string) => {
        const trimmed = tag.trim();
        if (!trimmed) return;

        // Don't add duplicates
        if (tags.includes(trimmed)) {
            setInputValue('');
            return;
        }

        onChange([...tags, trimmed]);
        setInputValue('');
    }, [tags, onChange]);

    // Remove a tag by index
    const removeTag = useCallback((index: number) => {
        const newTags = [...tags];
        newTags.splice(index, 1);
        onChange(newTags);
    }, [tags, onChange]);

    // Handle input change
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        // Check for comma to add tag
        if (val.includes(',')) {
            const parts = val.split(',');
            parts.forEach((part, i) => {
                if (i < parts.length - 1) {
                    // All parts except last are complete tags
                    const trimmed = part.trim();
                    if (trimmed && !tags.includes(trimmed)) {
                        onChange([...tags, trimmed]);
                    }
                } else {
                    // Last part is the current input
                    setInputValue(part);
                }
            });
        } else {
            setInputValue(val);
        }
    }, [tags, onChange]);

    // Handle keyboard events
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            e.preventDefault();
            removeTag(tags.length - 1);
        }
    }, [inputValue, tags, addTag, removeTag]);

    // Focus input when container clicked
    const handleContainerClick = useCallback(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div
            className={clsx(
                'flex flex-wrap gap-1.5 p-2 border rounded-md bg-white min-h-[42px] cursor-text',
                readOnly ? 'border-slate-200' : 'border-slate-300 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'
            )}
            onClick={handleContainerClick}
        >
            {/* Existing tags */}
            {tags.map((tag, index) => (
                <span
                    key={`${tag}-${index}`}
                    className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm',
                        'bg-slate-100 text-slate-700'
                    )}
                >
                    <span>{tag}</span>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTag(index);
                            }}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    )}
                </span>
            ))}

            {/* Input for new tags */}
            {!readOnly && (
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={tags.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[80px] text-sm outline-none bg-transparent"
                />
            )}

            {/* Empty state placeholder */}
            {readOnly && tags.length === 0 && (
                <span className="text-sm text-slate-400 italic">No tags</span>
            )}
        </div>
    );
}

/**
 * Parse various tag value formats into an array of strings
 */
function parseTags(value: unknown): string[] {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value.filter((t): t is string => typeof t === 'string');
    }

    if (typeof value === 'string') {
        // Could be comma-separated or JSON array
        if (value.startsWith('[')) {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
            } catch {
                return [];
            }
        }
        // Comma-separated
        return value.split(',').map(t => t.trim()).filter(Boolean);
    }

    return [];
}
