/**
 * DateFieldEditor - Semantic Component for date editing
 *
 * Responsibilities:
 * - Displays date as readable text with calendar icon
 * - Shows relative date hints (Today, Tomorrow, etc.)
 * - Opens native date picker on click
 *
 * Design Rules:
 * - Pure presentational - no API calls
 * - Used in table cells and inspector fields
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { Calendar, X } from 'lucide-react';

export interface DateFieldEditorProps {
    /** Current date value (ISO string or Date) */
    value: string | Date | null | undefined;
    /** Called when date changes */
    onChange: (value: string | null) => void;
    /** Whether the field is read-only */
    readOnly?: boolean;
    /** Show time picker as well */
    includeTime?: boolean;
    /** Compact mode for table cells */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

/**
 * Format date for display with relative hints
 */
function formatDisplayDate(value: string | Date | null | undefined): string {
    if (!value) return '';

    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return '';

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check for relative dates
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    // Format as readable date
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
}

/**
 * Get date color class based on proximity
 */
function getDateColorClass(value: string | Date | null | undefined): string {
    if (!value) return 'text-slate-400';

    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return 'text-slate-400';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600'; // Overdue
    if (diffDays === 0) return 'text-amber-600'; // Today
    if (diffDays <= 2) return 'text-blue-600'; // Soon
    return 'text-slate-600'; // Future
}

/**
 * DateFieldEditor - Semantic date editor with relative hints
 */
export function DateFieldEditor({
    value,
    onChange,
    readOnly = false,
    includeTime = false,
    compact = false,
    className,
}: DateFieldEditorProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Format value for input
    const inputValue = useMemo(() => {
        if (!value) return '';
        const date = typeof value === 'string' ? new Date(value) : value;
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    }, [value]);

    const displayText = formatDisplayDate(value);
    const colorClass = getDateColorClass(value);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        if (newValue) {
            onChange(newValue);
        } else {
            onChange(null);
        }
    }, [onChange]);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
    }, [onChange]);

    const handleClick = useCallback(() => {
        if (!readOnly && inputRef.current) {
            inputRef.current.showPicker?.();
            inputRef.current.focus();
        }
    }, [readOnly]);

    return (
        <div className={clsx('relative', className)}>
            {/* Display button */}
            <button
                type="button"
                onClick={handleClick}
                disabled={readOnly}
                className={clsx(
                    'flex items-center gap-2 rounded transition-all',
                    compact ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
                    readOnly
                        ? 'cursor-default'
                        : 'cursor-pointer hover:bg-slate-100',
                    isFocused && 'ring-2 ring-blue-500 ring-offset-1'
                )}
            >
                <Calendar className={clsx('flex-shrink-0', compact ? 'w-3 h-3' : 'w-4 h-4', colorClass)} />
                <span className={clsx('font-medium', colorClass)}>
                    {displayText || 'Set date...'}
                </span>
                {value && !readOnly && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="ml-1 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </button>

            {/* Hidden native date input */}
            <input
                ref={inputRef}
                type={includeTime ? 'datetime-local' : 'date'}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                className="absolute inset-0 opacity-0 cursor-pointer"
            />
        </div>
    );
}
